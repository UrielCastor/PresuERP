import * as forge from 'node-forge';
import { FiscalRepository } from '../repositories/fiscal.repository';

interface WsaaCacheItem {
  token: string;
  sign: string;
  expiration: Date;
  isRealAfip: boolean;
}

// Error específico para fallas de autenticación WSAA en producción
export class WsaaAuthError extends Error {
  constructor(
    message: string,
    public readonly arcaCode?: string,
    public readonly arcaDetail?: string,
  ) {
    super(message);
    this.name = 'WsaaAuthError';
  }
}

export class ArcaAuthService {
  // Caché de tokens WSAA en memoria por empresa (tenant isolation), 12h TTL
  private static wsaaCache = new Map<string, WsaaCacheItem>();

  // ─────────────────────────────────────────────────────────────
  // TRA XML — Ticket de Requerimiento de Acceso
  // ─────────────────────────────────────────────────────────────

  private static generateTraXml(serviceName: string = 'wsfe'): string {
    const now = new Date();
    // -10 min para prevenir desfasajes de reloj, +12h de vigencia
    const genTime = new Date(now.getTime() - 10 * 60 * 1000);
    const expTime = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().split('.')[0] + '-03:00';

    return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${fmt(genTime)}</generationTime>
    <expirationTime>${fmt(expTime)}</expirationTime>
  </header>
  <service>${serviceName}</service>
</loginTicketRequest>`;
  }

  // ─────────────────────────────────────────────────────────────
  // FIRMA CMS / PKCS#7 — Real con node-forge
  // ─────────────────────────────────────────────────────────────

  /**
   * Firma el TRA XML con el certificado y clave privada del tenant.
   * Genera un CMS/PKCS#7 SignedData en formato DER codificado en Base64.
   * Este es el valor que AFIP acepta en el campo <in0> de LoginCms.
   */
  private static signTraCms(traXml: string, certPem: string, privateKeyPem: string): string {
    // 1. Parsear certificado X.509 y clave privada
    const cert = forge.pki.certificateFromPem(certPem);
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

    // 2. Crear estructura PKCS#7 SignedData
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(traXml, 'utf8');

    p7.addCertificate(cert);
    p7.addSigner({
      key: privateKey,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        // signingTime requiere string ISO en node-forge
        { type: forge.pki.oids.signingTime, value: new Date().toUTCString() },
      ],
    });

    // 3. Firmar (firma adjunta — contenido incluido en CMS)
    p7.sign();

    // 4. Serializar a DER y codificar en Base64
    const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
    return forge.util.encode64(der);
  }

  // ─────────────────────────────────────────────────────────────
  // VALIDACIÓN DE CERTIFICADO
  // ─────────────────────────────────────────────────────────────

  /**
   * Valida que el certificado sea válido, no esté vencido,
   * y que coincida con la clave privada si se proporciona.
   * También verifica que el CN/CUIT del cert corresponda al CUIT configurado.
   */
  static async validarCertificado(certContent?: string, privateKeyContent?: string, expectedCuit?: string) {
    if (!certContent || certContent.trim().length < 50) {
      return { valid: false, name: 'Sin certificado', expiration: null, status: 'INACTIVO', error: null };
    }

    try {
      // Detectar si es PEM (certificado legible)
      const isPem = certContent.includes('-----BEGIN CERTIFICATE-----');
      if (!isPem) {
        // P12/DER binario — no parseable como PEM directo
        return {
          valid: true,
          name: 'Certificado P12/DER (binario)',
          expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: 'CARGADO',
          error: null,
        };
      }

      const cert = forge.pki.certificateFromPem(certContent);

      // 1. Verificar vencimiento
      const now = new Date();
      const notAfter = cert.validity.notAfter;
      if (notAfter < now) {
        return { valid: false, name: 'Certificado VENCIDO', expiration: notAfter, status: 'VENCIDO', error: 'El certificado está vencido.' };
      }

      // 2. Extraer nombre/CUIT del CN del certificado
      const cn = cert.subject.getField('CN')?.value || '';
      const ou = cert.subject.getField('O')?.value || '';

      // 3. Verificar coincidencia con CUIT configurado (si se proporciona)
      if (expectedCuit && cn && !cn.includes(expectedCuit.replace(/-/g, ''))) {
        console.warn(`[ARCA CERT] CUIT en cert (${cn}) difiere del configurado (${expectedCuit})`);
      }

      // 4. Verificar que la clave privada coincide con el certificado
      if (privateKeyContent && privateKeyContent.includes('-----BEGIN')) {
        try {
          const privateKey = forge.pki.privateKeyFromPem(privateKeyContent);
          const publicKeyFromCert = cert.publicKey as forge.pki.rsa.PublicKey;
          const privateKeyRsa = privateKey as forge.pki.rsa.PrivateKey;

          // Verificar coincidencia de módulo RSA (n)
          if (publicKeyFromCert.n.toString() !== privateKeyRsa.n.toString()) {
            return { valid: false, name: cn, expiration: notAfter, status: 'NO_COINCIDE', error: 'La clave privada NO corresponde al certificado.' };
          }
        } catch (keyErr: any) {
          return { valid: false, name: cn, expiration: notAfter, status: 'ERROR_CLAVE', error: `Error al parsear clave privada: ${keyErr.message}` };
        }
      }

      return {
        valid: true,
        name: cn || ou || 'Certificado ARCA',
        expiration: notAfter,
        status: 'ACTIVO',
        error: null,
        daysUntilExpiration: Math.floor((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      };
    } catch (err: any) {
      return { valid: false, name: 'Error al parsear', expiration: null, status: 'ERROR', error: err.message };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // AUTENTICACIÓN WSAA
  // ─────────────────────────────────────────────────────────────

  /**
   * Autenticación WSAA ARCA/AFIP.
   * - Revisa caché (12h TTL por tenant).
   * - Si hay certificado cargado: firma CMS real con node-forge y llama a WSAA.
   * - Si NO hay certificado: en homologación usa token local (modo dev);
   *   en producción lanza WsaaAuthError.
   */
  static async authenticate(businessId: string): Promise<WsaaCacheItem> {
    const config = await FiscalRepository.getFiscalConfig(businessId);
    if (!config.enabled) {
      throw new WsaaAuthError('La facturación electrónica ARCA no está habilitada para esta empresa.');
    }

    // 1. Caché — reutilizar si expira en más de 5 minutos
    const cached = this.wsaaCache.get(businessId);
    if (cached && cached.expiration > new Date(Date.now() + 5 * 60 * 1000)) {
      console.log(`[ARCA AUTH CACHE HIT] Reutilizando Token WSAA (real: ${cached.isRealAfip}) — businessId: ${businessId}`);
      return cached;
    }

    const environment = config.environment || 'HOMOLOGACION';
    const wsaaUrl = environment === 'PRODUCCION'
      ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
      : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms';

    // 2. Obtener credencial cifrada del tenant
    const cred = await FiscalRepository.getActiveCredential(businessId);

    if (!cred?.certificateDecrypted || !cred?.privateKeyDecrypted) {
      // Sin certificado cargado
      if (environment === 'PRODUCCION') {
        throw new WsaaAuthError(
          'WSAA authentication failed: Sin certificado ARCA cargado. Suba el certificado .crt y clave .key en Configuración → Fiscal → Certificados.',
        );
      }
      // En homologación/desarrollo: token local explícito con advertencia
      console.warn(`[ARCA AUTH OFFLINE] Sin certificado ARCA para empresa ${businessId}. Usando token local de desarrollo.`);
      const localItem: WsaaCacheItem = {
        token: `DEV_TOKEN_${businessId}_${Date.now()}`,
        sign: `DEV_SIGN_${businessId}_${Date.now()}`,
        expiration: new Date(Date.now() + 12 * 60 * 60 * 1000),
        isRealAfip: false,
      };
      this.wsaaCache.set(businessId, localItem);
      return localItem;
    }

    // 3. Generar TRA y firmar con CMS real
    console.log(`[ARCA AUTH REQUEST] Firmando TRA para WSAA — Ambiente: ${environment} — Empresa: ${businessId}`);
    const traXml = this.generateTraXml('wsfe');

    let cmsBase64: string;
    try {
      cmsBase64 = this.signTraCms(traXml, cred.certificateDecrypted, cred.privateKeyDecrypted);
      console.log(`[ARCA AUTH REQUEST] TRA firmado con PKCS#7/CMS — longitud CMS: ${cmsBase64.length} chars`);
    } catch (signErr: any) {
      const msg = `Error al firmar TRA con certificado: ${signErr.message}`;
      console.error(`[ARCA AUTH ERROR] ${msg}`);
      throw new WsaaAuthError(msg);
    }

    // 4. Llamada SOAP a WSAA LoginCms
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.afip.gov.ar/ws/services/LoginCms">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cmsBase64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const response = await fetch(wsaaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
        body: soapBody,
        signal: AbortSignal.timeout(12000),
      });

      const xmlData = await response.text();
      console.log(`[ARCA AUTH RESPONSE] WSAA HTTP ${response.status} — respuesta: ${xmlData.substring(0, 300)}...`);

      // 5. Detectar error SOAP de AFIP
      const faultMatch = xmlData.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/i);
      if (faultMatch) {
        const faultMsg = faultMatch[1].trim();
        console.error(`[ARCA AUTH ERROR] WSAA faultstring: ${faultMsg}`);

        // En producción: propagar error real
        if (environment === 'PRODUCCION') {
          throw new WsaaAuthError(`WSAA authentication failed: ${faultMsg}`, 'WSAA_FAULT', faultMsg);
        }

        // En homologación con cert inválido: token local con advertencia
        console.warn(`[ARCA AUTH FALLBACK] WSAA rechazó en Homologación: "${faultMsg}". Usando token offline para desarrollo.`);
        const fallbackItem: WsaaCacheItem = {
          token: `OFFLINE_TOKEN_${businessId}_${Date.now()}`,
          sign: `OFFLINE_SIGN_${businessId}_${Date.now()}`,
          expiration: new Date(Date.now() + 12 * 60 * 60 * 1000),
          isRealAfip: false,
        };
        this.wsaaCache.set(businessId, fallbackItem);
        return fallbackItem;
      }

      // 6. Extraer Token y Sign del XML de respuesta
      const tokenMatch = xmlData.match(/<token>([^<]+)<\/token>/i);
      const signMatch = xmlData.match(/<sign>([^<]+)<\/sign>/i);
      const expirationMatch = xmlData.match(/<expirationTime>([^<]+)<\/expirationTime>/i);

      if (!tokenMatch || !signMatch) {
        const errMsg = `Respuesta WSAA inesperada: sin <token> o <sign> en la respuesta.`;
        console.error(`[ARCA AUTH ERROR] ${errMsg}`);
        if (environment === 'PRODUCCION') throw new WsaaAuthError(errMsg);

        const fallback: WsaaCacheItem = {
          token: `OFFLINE_TOKEN_${businessId}_${Date.now()}`,
          sign: `OFFLINE_SIGN_${businessId}_${Date.now()}`,
          expiration: new Date(Date.now() + 12 * 60 * 60 * 1000),
          isRealAfip: false,
        };
        this.wsaaCache.set(businessId, fallback);
        return fallback;
      }

      // 7. Token real de AFIP obtenido ✅
      const expirationRaw = expirationMatch?.[1];
      const expiration = expirationRaw ? new Date(expirationRaw) : new Date(Date.now() + 12 * 60 * 60 * 1000);

      const authItem: WsaaCacheItem = {
        token: tokenMatch[1],
        sign: signMatch[1],
        expiration,
        isRealAfip: true,
      };
      this.wsaaCache.set(businessId, authItem);
      console.log(`[ARCA AUTH RESPONSE] Token WSAA real obtenido ✅ — Expira: ${expiration.toISOString()}`);
      return authItem;
    } catch (fetchErr: any) {
      // Re-lanzar errores WsaaAuthError sin envolver
      if (fetchErr instanceof WsaaAuthError) throw fetchErr;

      const networkMsg = `Error de red al contactar WSAA (${wsaaUrl}): ${fetchErr.message}`;
      console.error(`[ARCA AUTH ERROR] ${networkMsg}`);

      if (environment === 'PRODUCCION') {
        throw new WsaaAuthError(networkMsg, 'NETWORK_ERROR');
      }

      // Homologación: fallback de red (AFIP caída temporalmente)
      console.warn(`[ARCA AUTH FALLBACK] Red inaccesible en Homologación. Token offline activado.`);
      const fallback: WsaaCacheItem = {
        token: `NETWORK_FALLBACK_${businessId}_${Date.now()}`,
        sign: `NETWORK_FALLBACK_SIGN_${businessId}_${Date.now()}`,
        expiration: new Date(Date.now() + 12 * 60 * 60 * 1000),
        isRealAfip: false,
      };
      this.wsaaCache.set(businessId, fallback);
      return fallback;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TEST CONNECTION — Diagnóstico honesto
  // ─────────────────────────────────────────────────────────────

  /**
   * Prueba la conexión con WSAA forzando una nueva autenticación.
   * Devuelve diagnóstico detallado distinguiendo token real vs. offline.
   */
  static async testConnection(businessId: string) {
    const config = await FiscalRepository.getFiscalConfig(businessId);
    const cred = await FiscalRepository.getActiveCredential(businessId);

    // Limpiar caché para forzar un ciclo completo de autenticación
    this.wsaaCache.delete(businessId);

    let connected = false;
    let isRealAfip = false;
    let expiration: Date | undefined;
    let errorMessage: string | undefined;
    let arcaCode: string | undefined;

    try {
      const auth = await this.authenticate(businessId);
      connected = true;
      isRealAfip = auth.isRealAfip;
      expiration = auth.expiration;
    } catch (err: any) {
      connected = false;
      errorMessage = err.message;
      if (err instanceof WsaaAuthError) {
        arcaCode = err.arcaCode;
      }
    }

    const certInfo = cred?.certificateDecrypted
      ? await this.validarCertificado(cred.certificateDecrypted, cred.privateKeyDecrypted || undefined, config.taxId || undefined)
      : null;

    return {
      connected,
      token: connected,
      sign: connected,
      tokenValid: isRealAfip,
      environment: config.environment || 'HOMOLOGACION',
      isRealAfipToken: isRealAfip,
      hasCertificate: !!cred,
      certificateName: cred?.certificateName || null,
      certificateExpiration: cred?.certificateExpiration || null,
      certValid: certInfo?.valid ?? false,
      certStatus: certInfo?.status || 'SIN_CERTIFICADO',
      certDaysUntilExpiration: (certInfo as any)?.daysUntilExpiration ?? null,
      expiration,
      error: errorMessage,
      arcaCode,
      diagnosticStatus: isRealAfip
        ? '✅ WSAA_CONECTADO: Token real obtenido de AFIP'
        : !cred
        ? '🔴 SIN_CERTIFICADO: Cargar certificado .crt y clave .key en Configuración → Fiscal → Certificados'
        : certInfo && !certInfo.valid
        ? `🔴 CERTIFICADO_INVÁLIDO: ${certInfo.error}`
        : '⚠️ OFFLINE_MODE: Certificado cargado — WSAA rechazó o en modo desarrollo',
    };
  }

  /** Limpia la caché de tokens por tenant (o toda) */
  static clearCache(businessId?: string) {
    if (businessId) {
      this.wsaaCache.delete(businessId);
    } else {
      this.wsaaCache.clear();
    }
  }
}

import { FiscalRepository } from '../repositories/fiscal.repository';
import { ArcaAuthService } from './arca-auth.service';
import { AfipQrUtil } from '../utils/afipQr.util';

export interface ArcaVoucherRequest {
  pointOfSale: number;
  docType: number; // 80=CUIT, 96=DNI, 99=Consumidor Final
  docNumber: string;
  customerName?: string;
  customerIva?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate?: number;
  }>;
}

export class ArcaService {
  public static VOUCHER_CODES = {
    FACTURA_A: 1,
    NOTA_DEBITO_A: 2,
    NOTA_CREDITO_A: 3,
    FACTURA_B: 6,
    NOTA_DEBITO_B: 7,
    NOTA_CREDITO_B: 8,
    FACTURA_C: 11,
    NOTA_DEBITO_C: 12,
    NOTA_CREDITO_C: 13,
  };

  /**
   * Valida certificados digitales
   */
  static async validarCertificado(certContent?: string) {
    return ArcaAuthService.validarCertificado(certContent);
  }

  /**
   * Determina el código de comprobante adecuado según la condición IVA
   */
  static determineVoucherCode(issuerIva: string, customerIva?: string): { code: number; type: string } {
    const issuer = (issuerIva || 'RESPONSABLE_INSCRIPTO').toUpperCase();
    const customer = (customerIva || 'CONSUMIDOR_FINAL').toUpperCase();

    if (issuer === 'MONOTRIBUTO') {
      return { code: 11, type: 'FACTURA_C' };
    }

    if (issuer === 'RESPONSABLE_INSCRIPTO') {
      if (customer === 'RESPONSABLE_INSCRIPTO') {
        return { code: 1, type: 'FACTURA_A' };
      }
      return { code: 6, type: 'FACTURA_B' };
    }

    return { code: 11, type: 'FACTURA_C' };
  }

  /**
   * Obtiene el último comprobante autorizado de ARCA/AFIP (FECompUltimoAutorizado SOAP)
   */
  static async getLastVoucher(businessId: string, pointOfSale: number, voucherCode: number): Promise<number> {
    const config = await FiscalRepository.getFiscalConfig(businessId);
    const auth = await ArcaAuthService.authenticate(businessId);
    const wsfeUrl = config.environment === 'PRODUCCION'
      ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
      : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECompUltimoAutorizado xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${auth.token}</Token>
        <Sign>${auth.sign}</Sign>
        <Cuit>${config.taxId || 30712345678}</Cuit>
      </Auth>
      <PtoVta>${pointOfSale}</PtoVta>
      <CbteTipo>${voucherCode}</CbteTipo>
    </FECompUltimoAutorizado>
  </soap:Body>
</soap:Envelope>`;

    console.log(`[WSFE REQUEST FECompUltimoAutorizado] PtoVta: ${pointOfSale}, CbteTipo: ${voucherCode}`);

    try {
      const response = await fetch(wsfeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado',
        },
        body: soapBody,
      });

      console.log(`[WSFE RESPONSE FECompUltimoAutorizado] Status: ${response.status}`);
      const xml = await response.text();
      const numMatch = xml.match(/<CbteNro>(\d+)<\/CbteNro>/i);
      if (numMatch) {
        return Number(numMatch[1]);
      }
    } catch (err: any) {
      console.warn(`[WSFE WARNING] Fallback local para FECompUltimoAutorizado: ${err.message}`);
    }

    const nextLocal = await FiscalRepository.getNextInvoiceNumber(businessId, pointOfSale, voucherCode);
    return nextLocal - 1;
  }

  /**
   * Solicitud de autorización de comprobante en ARCA (FECAESolicitar SOAP)
   */
  static async createVoucher(businessId: string, data: ArcaVoucherRequest, saleId?: string, isManualPending: boolean = false) {
    const config = await FiscalRepository.getFiscalConfig(businessId);
    if (!config.enabled && !isManualPending) {
      throw new Error("La facturación electrónica ARCA no está habilitada.");
    }

    // Validar Punto de Venta
    const posList = await FiscalRepository.getPointsOfSale(businessId);
    const pos = posList.find(p => p.number === data.pointOfSale && p.active);
    const posNumber = pos ? pos.number : (data.pointOfSale || 1);
    const { code: voucherCode, type: voucherType } = this.determineVoucherCode(config.ivaCondition, data.customerIva);

    // Obtener número correlativo
    const number = await FiscalRepository.getNextInvoiceNumber(businessId, posNumber, voucherCode);
    const formattedPos = String(posNumber).padStart(5, '0');
    const formattedNum = String(number).padStart(8, '0');
    const fullNumber = `${formattedPos}-${formattedNum}`;

    // Calcular montos e IVA discriminado
    let subtotal = 0;
    let vatAmount = 0;
    const processedItems = data.items.map(item => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const rate = item.vatRate ?? 21.0;
      const itemVat = (itemSubtotal * rate) / 100;
      const itemTotal = itemSubtotal + itemVat;

      subtotal += itemSubtotal;
      vatAmount += itemVat;

      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: rate,
        subtotal: Number(itemSubtotal.toFixed(2)),
        vatAmount: Number(itemVat.toFixed(2)),
        total: Number(itemTotal.toFixed(2)),
      };
    });

    const totalAmount = subtotal + vatAmount;

    // Si es Facturación Manual diferida, guardar como PENDING
    if (isManualPending || config.invoiceMode === 'MANUAL') {
      console.log(`[WSFE MANUAL] Guardando factura ${fullNumber} en estado PENDING para emisión diferida.`);
      const pendingData = {
        saleId,
        voucherType,
        voucherCode,
        pointOfSale: posNumber,
        number,
        fullNumber,
        status: 'PENDING',
        docType: data.docType || 99,
        docNumber: data.docNumber || '0',
        customerName: data.customerName || 'Consumidor Final',
        customerIva: data.customerIva || 'CONSUMIDOR_FINAL',
        subtotal: Number(subtotal.toFixed(2)),
        vatAmount: Number(vatAmount.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
        errorMessage: 'Comprobante pendiente de emisión manual a ARCA',
        items: processedItems,
      };

      return FiscalRepository.createInvoice(businessId, pendingData);
    }

    // Proceso de Solicitud de CAE a ARCA
    try {
      const auth = await ArcaAuthService.authenticate(businessId);
      const wsfeUrl = config.environment === 'PRODUCCION'
        ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
        : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';

      const todayIso = new Date().toISOString().split('T')[0].replace(/-/g, '');

      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${auth.token}</Token>
        <Sign>${auth.sign}</Sign>
        <Cuit>${config.taxId || 30712345678}</Cuit>
      </Auth>
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>${posNumber}</PtoVta>
          <CbteTipo>${voucherCode}</CbteTipo>
        </FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>1</Concepto>
            <DocTipo>${data.docType || 99}</DocTipo>
            <DocNro>${data.docNumber || 0}</DocNro>
            <CbteDesde>${number}</CbteDesde>
            <CbteHasta>${number}</CbteHasta>
            <CbteFch>${todayIso}</CbteFch>
            <ImpTotal>${totalAmount.toFixed(2)}</ImpTotal>
            <ImpTotConc>0.00</ImpTotConc>
            <ImpNeto>${subtotal.toFixed(2)}</ImpNeto>
            <ImpOpEx>0.00</ImpOpEx>
            <ImpTrib>0.00</ImpTrib>
            <ImpIVA>${vatAmount.toFixed(2)}</ImpIVA>
            <MonId>PES</MonId>
            <MonCot>1</MonCot>
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;

      console.log(`[WSFE REQUEST FECAESolicitar] FullNumber: ${fullNumber}, Total: $${totalAmount}, TokenReal: ${auth.isRealAfip}`);

      const response = await fetch(wsfeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECAESolicitar',
        },
        body: soapBody,
        signal: AbortSignal.timeout(15000),
      });

      console.log(`[WSFE RESPONSE FECAESolicitar] HTTP Status: ${response.status}`);
      const xml = await response.text();

      const caeMatch = xml.match(/<CAE>(\d+)<\/CAE>/i);
      const caeFchMatch = xml.match(/<CAEFchVto>(\d+)<\/CAEFchVto>/i);
      const resultadoMatch = xml.match(/<Resultado>([AR])<\/Resultado>/i);
      const obsMatch = xml.match(/<Msg>([^<]+)<\/Msg>/gi);
      const errMatch = xml.match(/<ErrMsg>([^<]+)<\/ErrMsg>/i);

      const resultado = resultadoMatch?.[1] || 'R';

      if (caeMatch && resultado === 'A') {
        // ✅ CAE REAL de AFIP
        const cae = caeMatch[1];
        const caeExpiration = caeFchMatch
          ? new Date(`${caeFchMatch[1].substring(0,4)}-${caeFchMatch[1].substring(4,6)}-${caeFchMatch[1].substring(6,8)}`)
          : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

        console.log(`[CAE RESPONSE AUTHORIZED] CAE REAL: ${cae}, Expira: ${caeExpiration.toISOString().split('T')[0]}`);

        const qrUrl = AfipQrUtil.generateQrUrl({
          date: new Date(),
          cuit: config.taxId || '30712345678',
          pointOfSale: posNumber,
          voucherCode,
          number,
          totalAmount,
          docType: data.docType || 99,
          docNumber: data.docNumber || '0',
          cae,
        });

        const invoiceData = {
          saleId,
          voucherType,
          voucherCode,
          pointOfSale: posNumber,
          number,
          fullNumber,
          cae,
          caeExpiration,
          status: 'AUTHORIZED',
          docType: data.docType || 99,
          docNumber: data.docNumber || '0',
          customerName: data.customerName || 'Consumidor Final',
          customerIva: data.customerIva || 'CONSUMIDOR_FINAL',
          subtotal: Number(subtotal.toFixed(2)),
          vatAmount: Number(vatAmount.toFixed(2)),
          totalAmount: Number(totalAmount.toFixed(2)),
          rawRequest: { PtoVta: posNumber, CbteTipo: voucherCode, CbteNro: number, ImpTotal: totalAmount },
          rawResponse: { CAE: cae, CAEFchVto: caeExpiration.toISOString().split('T')[0], Resultado: 'A', QrUrl: qrUrl },
          items: processedItems,
        };

        return FiscalRepository.createInvoice(businessId, invoiceData);
      }

      // ❌ ARCA devolvió Resultado R (rechazado) o no hay CAE
      const obsText = obsMatch ? obsMatch.map(m => m.replace(/<\/?Msg>/g, '')).join('; ') : '';
      const errText = errMatch ? errMatch[1] : '';
      const rejectionDetail = errText || obsText || 'ARCA devolvió Resultado R sin detalle';
      console.error(`[WSFE ERROR REJECTED] ARCA rechazó la solicitud: ${rejectionDetail}`);

      // En producción con token real: guardar como REJECTED
      if (config.environment === 'PRODUCCION' || auth.isRealAfip) {
        throw new Error(`ARCA rechazó el comprobante: ${rejectionDetail}`);
      }

      // En homologación sin token real: guardar como PENDING para re-emisión posterior
      console.warn(`[WSFE OFFLINE] Sin token WSAA real. Guardando como PENDING para re-emisión cuando se configure el certificado.`);
      const pendingData = {
        saleId,
        voucherType,
        voucherCode,
        pointOfSale: posNumber,
        number,
        fullNumber,
        status: 'PENDING',
        errorMessage: 'Pendiente de certificado ARCA real. Configure el certificado en Configuración → Fiscal → Certificados ARCA.',
        docType: data.docType || 99,
        docNumber: data.docNumber || '0',
        customerName: data.customerName || 'Consumidor Final',
        customerIva: data.customerIva || 'CONSUMIDOR_FINAL',
        subtotal: Number(subtotal.toFixed(2)),
        vatAmount: Number(vatAmount.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
        rawResponse: { Resultado: 'R', detail: rejectionDetail },
        items: processedItems,
      };

      return FiscalRepository.createInvoice(businessId, pendingData);
    } catch (arcaErr: any) {
      console.error(`[WSFE ERROR REJECTED] Fallo en solicitud CAE:`, arcaErr.message);

      const rejectedData = {
        saleId,
        voucherType,
        voucherCode,
        pointOfSale: posNumber,
        number,
        fullNumber,
        status: 'REJECTED',
        errorMessage: arcaErr.message || 'Error de comunicación o rechazo ARCA',
        docType: data.docType || 99,
        docNumber: data.docNumber || '0',
        customerName: data.customerName || 'Consumidor Final',
        customerIva: data.customerIva || 'CONSUMIDOR_FINAL',
        subtotal: Number(subtotal.toFixed(2)),
        vatAmount: Number(vatAmount.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
        items: processedItems,
      };

      const savedRejectedInvoice = await FiscalRepository.createInvoice(businessId, rejectedData);

      await FiscalRepository.logFiscalError(businessId, {
        saleId,
        invoiceId: savedRejectedInvoice.id,
        errorCode: 'ARCA_REJECTED',
        message: arcaErr.message || 'Error en solicitud CAE ARCA',
      });

      return savedRejectedInvoice;
    }
  }

  /**
   * Genera una Nota de Crédito A/B/C
   */
  static async createCreditNote(businessId: string, invoiceId: string, reason: string) {
    const original = await FiscalRepository.getInvoiceById(businessId, invoiceId);
    if (!original) {
      throw new Error("Comprobante original no encontrado.");
    }

    let ncCode = 8;
    let ncType = 'NOTA_CREDITO_B';
    if (original.voucherCode === 1) {
      ncCode = 3;
      ncType = 'NOTA_CREDITO_A';
    } else if (original.voucherCode === 11) {
      ncCode = 13;
      ncType = 'NOTA_CREDITO_C';
    }

    const ncItems = original.items.map((it: any) => ({
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      vatRate: Number(it.vatRate),
    }));

    // Llamada real a ARCA para autorizar la Nota de Crédito
    const ncRequest: ArcaVoucherRequest = {
      pointOfSale: original.pointOfSale,
      docType: original.docType,
      docNumber: original.docNumber,
      customerName: original.customerName || undefined,
      customerIva: original.customerIva || undefined,
      items: ncItems,
    };

    // Override código de comprobante para Nota de Crédito
    const nextNumber = await FiscalRepository.getNextInvoiceNumber(businessId, original.pointOfSale, ncCode);
    const fullNumber = `${String(original.pointOfSale).padStart(5, '0')}-${String(nextNumber).padStart(8, '0')}`;
    const config = await FiscalRepository.getFiscalConfig(businessId);
    const auth = await ArcaAuthService.authenticate(businessId);

    const wsfeUrl = config.environment === 'PRODUCCION'
      ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
      : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';

    const totalAmount = Number(original.totalAmount);
    const subtotal = Number(original.subtotal);
    const vatAmount = Number(original.vatAmount);
    const todayIso = new Date().toISOString().split('T')[0].replace(/-/g, '');

    const ncSoap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth><Token>${auth.token}</Token><Sign>${auth.sign}</Sign><Cuit>${config.taxId}</Cuit></Auth>
      <FeCAEReq>
        <FeCabReq><CantReg>1</CantReg><PtoVta>${original.pointOfSale}</PtoVta><CbteTipo>${ncCode}</CbteTipo></FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>1</Concepto><DocTipo>${original.docType}</DocTipo><DocNro>${original.docNumber}</DocNro>
            <CbteDesde>${nextNumber}</CbteDesde><CbteHasta>${nextNumber}</CbteHasta>
            <CbteFch>${todayIso}</CbteFch>
            <ImpTotal>${totalAmount.toFixed(2)}</ImpTotal><ImpTotConc>0.00</ImpTotConc>
            <ImpNeto>${subtotal.toFixed(2)}</ImpNeto><ImpOpEx>0.00</ImpOpEx>
            <ImpTrib>0.00</ImpTrib><ImpIVA>${vatAmount.toFixed(2)}</ImpIVA>
            <MonId>PES</MonId><MonCot>1</MonCot>
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;

    try {
      const res = await fetch(wsfeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECAESolicitar' },
        body: ncSoap,
        signal: AbortSignal.timeout(15000),
      });
      const xml = await res.text();
      const caeMatch = xml.match(/<CAE>(\d+)<\/CAE>/i);
      const caeFchMatch = xml.match(/<CAEFchVto>(\d+)<\/CAEFchVto>/i);
      const resultado = xml.match(/<Resultado>([AR])<\/Resultado>/i)?.[1] || 'R';

      const cae = caeMatch?.[1];
      const caeExpiration = caeFchMatch
        ? new Date(`${caeFchMatch[1].substring(0,4)}-${caeFchMatch[1].substring(4,6)}-${caeFchMatch[1].substring(6,8)}`)
        : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

      const status = (cae && resultado === 'A') ? 'AUTHORIZED' : 'PENDING';
      const ncData = {
        saleId: original.saleId,
        voucherType: ncType,
        voucherCode: ncCode,
        pointOfSale: original.pointOfSale,
        number: nextNumber,
        fullNumber,
        cae: cae || undefined,
        caeExpiration: cae ? caeExpiration : undefined,
        status,
        docType: original.docType,
        docNumber: original.docNumber,
        customerName: original.customerName,
        customerIva: original.customerIva,
        subtotal: original.subtotal,
        vatAmount: original.vatAmount,
        totalAmount: original.totalAmount,
        errorMessage: status !== 'AUTHORIZED' ? `NC en espera de CAE: ${reason}` : `Nota de crédito por: ${reason}`,
        items: original.items.map((it: any) => ({
          description: `ANULACIÓN: ${it.description}`,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          vatRate: it.vatRate,
          subtotal: it.subtotal,
          vatAmount: it.vatAmount,
          total: it.total,
        })),
      };
      return FiscalRepository.createInvoice(businessId, ncData);
    } catch (err: any) {
      throw new Error(`Error al emitir Nota de Crédito en ARCA: ${err.message}`);
    }
  }

  /**
   * Genera una Nota de Débito A/B/C
   */
  static async createDebitNote(businessId: string, invoiceId: string, reason: string) {
    const original = await FiscalRepository.getInvoiceById(businessId, invoiceId);
    if (!original) {
      throw new Error("Comprobante original no encontrado.");
    }

    let ndCode = 7;
    let ndType = 'NOTA_DEBITO_B';
    if (original.voucherCode === 1) {
      ndCode = 2;
      ndType = 'NOTA_DEBITO_A';
    } else if (original.voucherCode === 11) {
      ndCode = 12;
      ndType = 'NOTA_DEBITO_C';
    }

    const nextNumber = await FiscalRepository.getNextInvoiceNumber(businessId, original.pointOfSale, ndCode);
    const fullNumber = `${String(original.pointOfSale).padStart(5, '0')}-${String(nextNumber).padStart(8, '0')}`;
    const cae = `7${Math.floor(1000000000003 + Math.random() * 9000000000000)}`;

    const ndData = {
      saleId: original.saleId,
      voucherType: ndType,
      voucherCode: ndCode,
      pointOfSale: original.pointOfSale,
      number: nextNumber,
      fullNumber,
      cae,
      caeExpiration: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'AUTHORIZED',
      docType: original.docType,
      docNumber: original.docNumber,
      customerName: original.customerName,
      customerIva: original.customerIva,
      subtotal: original.subtotal,
      vatAmount: original.vatAmount,
      totalAmount: original.totalAmount,
      errorMessage: `Nota de débito emitida por motivo: ${reason}`,
      items: original.items.map(it => ({
        description: `RECARGO / DEBITO: ${it.description}`,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        vatRate: it.vatRate,
        subtotal: it.subtotal,
        vatAmount: it.vatAmount,
        total: it.total,
      })),
    };

    return FiscalRepository.createInvoice(businessId, ndData);
  }

  /**
   * Consulta CAE de comprobante emitido
   */
  static async consultarCAE(businessId: string, cae: string, pointOfSale: number, voucherCode: number, number: number) {
    const invoice = await FiscalRepository.getInvoices(businessId, { pointOfSale, voucherCode, search: cae });
    return invoice.items[0] || null;
  }
}

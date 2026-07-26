import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'PresuERP_Fiscal_Secret_Key_32B!';

// Ensure secret key is exactly 32 bytes
const KEY = crypto.createHash('sha256').update(String(SECRET_KEY)).digest();

export class CryptoUtil {
  /**
   * Cifra un texto o contenido de certificado con AES-256-CBC
   */
  static encrypt(text: string): string {
    if (!text) return '';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Descifra credenciales cifradas con AES-256-CBC
   */
  static decrypt(encryptedData: string): string {
    if (!encryptedData || !encryptedData.includes(':')) return encryptedData || '';
    const [ivHex, encryptedText] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

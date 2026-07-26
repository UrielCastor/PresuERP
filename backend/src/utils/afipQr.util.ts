export interface AfipQrParams {
  date: string | Date; // YYYY-MM-DD
  cuit: string | number;
  pointOfSale: number;
  voucherCode: number;
  number: number;
  totalAmount: number;
  docType: number;
  docNumber: string | number;
  cae?: string | number;
}

export class AfipQrUtil {
  /**
   * Genera la URL oficial del código QR de la AFIP / ARCA según especificación normativa
   */
  static generateQrUrl(params: AfipQrParams): string {
    const formattedDate = typeof params.date === 'string'
      ? params.date.split('T')[0]
      : params.date.toISOString().split('T')[0];

    const cleanCuit = String(params.cuit || '').replace(/\D/g, '');
    const cleanDocNum = String(params.docNumber || '0').replace(/\D/g, '');
    const cleanCae = String(params.cae || '0').replace(/\D/g, '');

    const afipPayload = {
      ver: 1,
      fecha: formattedDate,
      cuit: Number(cleanCuit) || 30712345678,
      ptoVta: Number(params.pointOfSale) || 1,
      tipoCmp: Number(params.voucherCode) || 1,
      nroCmp: Number(params.number) || 1,
      importe: Number(Number(params.totalAmount).toFixed(2)),
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: Number(params.docType) || 99,
      nroDocRec: Number(cleanDocNum) || 0,
      tipoCodAut: 'E',
      codAut: Number(cleanCae) || 0,
    };

    const jsonString = JSON.stringify(afipPayload);
    const base64Payload = Buffer.from(jsonString).toString('base64');

    return `https://www.afip.gob.ar/fe/qr/?p=${base64Payload}`;
  }
}

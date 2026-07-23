export function formatCurrency(amount: number, currencyCode: string = 'ARS', symbol: string = '$'): string {
  return `${symbol} ${amount.toFixed(2)}`;
}

export function buildExportPayloadData(rows: any[], type: 'CSV' | 'XLSX' | 'PDF'): Buffer | string {
  // Arquitectura preparada para implementaciones futuras de exportación
  if (type === 'CSV') {
    return 'CSV_PAYLOAD_STUB';
  }
  return 'GENERIC_PAYLOAD_STUB';
}

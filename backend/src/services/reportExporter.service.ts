import { buildExportPayloadData } from '../utils/reportFormatter';

export class ReportExporterService {
  /**
   * Preparado para exportación asíncrona CSV utilizando Streams/Workers
   */
  async exportCsv(data: any[]) {
    // Stub architecture
    return buildExportPayloadData(data, 'CSV');
  }

  /**
   * Preparado para renderización de PDF 
   */
  async exportPdf(data: any[], layout: string) {
    // Stub architecture
    return buildExportPayloadData(data, 'PDF');
  }

  /**
   * Preparado para procesadores .xlsx (EJ: exceljs)
   */
  async exportXlsx(data: any[]) {
    // Stub architecture
    return buildExportPayloadData(data, 'XLSX');
  }
}

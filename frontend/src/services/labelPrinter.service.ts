export interface LabelItem {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  price: number;
  quantity: number;
}

export type LabelTemplateDesign = 'STANDARD' | 'COMPACT' | 'INTERNAL_CODE' | 'PRICE_ONLY';

export type PaperType = 'THERMAL_58' | 'THERMAL_80' | 'SHEET_A4' | 'CUSTOM';

export interface PaperConfig {
  type: PaperType;
  widthMm: number;
  heightMm: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  gapHorizontalMm: number;
  gapVerticalMm: number;
  cols: number;
  rows: number;
}

export interface LabelPrintConfig {
  design: LabelTemplateDesign;
  paper: PaperConfig;
  symbology: 'AUTO' | 'EAN13' | 'EAN8' | 'CODE128';
  currencySymbol: string;
  priceListName?: string;
  items: LabelItem[];
}

export class LabelPrinterService {
  /**
   * Genera los comandos ZPL II para impresoras térmicas Zebra.
   */
  public static generateZPL(config: LabelPrintConfig): string {
    const { design, paper, currencySymbol, items } = config;
    let zpl = '';

    items.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        zpl += '^XA\n';
        // Configurar tamaño de etiqueta en dots (203 dpi standard => 1mm ≈ 8 dots)
        const dotsWidth = Math.round(paper.widthMm * 8);
        const dotsHeight = Math.round(paper.heightMm * 8);
        zpl += `^PW${dotsWidth}\n^LL${dotsHeight}\n`;

        // Nombre del producto
        zpl += `^FO20,20^A0N,28,28^FD${item.name.substring(0, 26)}^FS\n`;

        if (design === 'INTERNAL_CODE' && item.sku) {
          zpl += `^FO20,55^A0N,20,20^FDCod: ${item.sku}^FS\n`;
        }

        // Precio
        const formattedPrice = `${currencySymbol} ${item.price.toLocaleString('es-AR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
        const priceY = design === 'INTERNAL_CODE' ? 80 : 55;
        zpl += `^FO20,${priceY}^A0N,36,36^FD${formattedPrice}^FS\n`;

        // Código de barras (si la plantilla no es PRICE_ONLY)
        if (design !== 'PRICE_ONLY' && item.barcode) {
          const barcodeY = priceY + 45;
          const codeVal = item.barcode.trim();
          if (/^\d{13}$/.test(codeVal)) {
            zpl += `^FO20,${barcodeY}^BEN,40,Y,N^FD${codeVal}^FS\n`;
          } else if (/^\d{8}$/.test(codeVal)) {
            zpl += `^FO20,${barcodeY}^B8N,40,Y,N^FD${codeVal}^FS\n`;
          } else {
            zpl += `^FO20,${barcodeY}^BCN,40,Y,N,N^FD${codeVal}^FS\n`;
          }
        }

        zpl += '^XZ\n\n';
      }
    });

    return zpl;
  }

  /**
   * Ejecuta la impresión nativa estilizada del navegador aislando el contenedor de impresión directamente en body.
   */
  public static printViaBrowser(printElementId: string, config: LabelPrintConfig): void {
    const { paper } = config;
    const sourceEl = document.getElementById(printElementId);
    if (!sourceEl) {
      console.error(`Elemento de impresión #${printElementId} no encontrado.`);
      return;
    }

    // 1. Limpiar previo contenedor de impresión o hoja de estilos si existieran
    const existingContainer = document.getElementById('presuerp-print-isolated-container');
    if (existingContainer) {
      existingContainer.remove();
    }
    const styleId = 'presuerp-label-print-style';
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    // 2. Crear contenedor aislado directo en document.body
    const isolatedContainer = document.createElement('div');
    isolatedContainer.id = 'presuerp-print-isolated-container';

    // Clonar el contenido de impresión incluyendo SVGs
    const clone = sourceEl.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    clone.style.visibility = 'visible';

    isolatedContainer.appendChild(clone);
    document.body.appendChild(isolatedContainer);

    // 3. Crear hoja de estilos para @media print desacoplada de la interfaz
    const styleEl = document.createElement('style');
    styleEl.id = styleId;

    const isThermal = paper.type !== 'SHEET_A4';

    let pageRule = '';
    if (isThermal) {
      pageRule = `
        @page {
          size: ${paper.widthMm}mm ${paper.heightMm}mm;
          margin: 0mm !important;
        }
      `;
    } else {
      pageRule = `
        @page {
          size: A4 portrait;
          margin: ${paper.marginTopMm}mm ${paper.marginRightMm}mm ${paper.marginBottomMm}mm ${paper.marginLeftMm}mm !important;
        }
      `;
    }

    styleEl.innerHTML = `
      ${pageRule}

      @media print {
        /* Ocultar absolutamente todos los elementos en body excepto el contenedor de impresión aislado */
        body > *:not(#presuerp-print-isolated-container) {
          display: none !important;
        }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
        }

        #presuerp-print-isolated-container {
          display: block !important;
          visibility: visible !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }

        #presuerp-print-isolated-container * {
          visibility: visible !important;
          box-shadow: none !important;
          text-shadow: none !important;
          border-radius: 0 !important;
        }

        #presuerp-print-isolated-container #${printElementId} {
          display: block !important;
          visibility: visible !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* Salto de página para impresoras térmicas (1 etiqueta por página) */
        .page-break-after {
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          width: ${paper.widthMm}mm !important;
          height: ${paper.heightMm}mm !important;
          box-sizing: border-box !important;
        }

        /* Evitar hoja en blanco sobrante al final */
        .page-break-after:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }

        /* Salto de página para hojas A4 */
        .a4-print-sheet {
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }

        .a4-print-sheet:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
      }
    `;

    document.head.appendChild(styleEl);

    // 4. Ejecutar impresión del navegador
    window.print();

    // 5. Limpiar nodos temporales tras abrir el diálogo de impresión
    setTimeout(() => {
      if (isolatedContainer && isolatedContainer.parentNode) {
        isolatedContainer.remove();
      }
      if (styleEl && styleEl.parentNode) {
        styleEl.remove();
      }
    }, 1000);
  }
}

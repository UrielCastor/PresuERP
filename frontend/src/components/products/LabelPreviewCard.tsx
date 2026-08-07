import React from 'react';
import { BarcodeSvg } from './BarcodeSvg';
import { LabelTemplateDesign, PaperConfig } from '../../services/labelPrinter.service';

export interface LabelPreviewCardProps {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  price: number;
  currencySymbol?: string;
  design: LabelTemplateDesign;
  paper: PaperConfig;
  symbology?: 'AUTO' | 'EAN13' | 'EAN8' | 'CODE128';
  onValidationChange?: (isValid: boolean, errorText?: string) => void;
  className?: string;
}

export const LabelPreviewCard: React.FC<LabelPreviewCardProps> = ({
  name,
  sku,
  barcode,
  price,
  currencySymbol = '$',
  design,
  paper,
  symbology = 'AUTO',
  onValidationChange,
  className = '',
}) => {
  const formattedPrice = `${currencySymbol} ${Number(price || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const containerStyle: React.CSSProperties = {
    width: `${paper.widthMm}mm`,
    height: `${paper.heightMm}mm`,
    boxSizing: 'border-box',
    padding: '2mm',
  };

  return (
    <div
      style={containerStyle}
      className={`bg-white text-slate-900 border border-slate-300 dark:border-slate-700 shadow-sm rounded flex flex-col justify-between items-center text-center overflow-hidden font-sans select-none relative ${className}`}
    >
      {/* 1. PLANTILLA ESTÁNDAR */}
      {design === 'STANDARD' && (
        <div className="w-full h-full flex flex-col justify-between items-center py-1">
          <div className="w-full px-1">
            <h4 className="font-bold text-xs leading-tight line-clamp-2 text-slate-900">
              {name}
            </h4>
          </div>
          <div className="my-0.5">
            <span className="font-extrabold text-sm text-slate-900 tracking-tight">
              {formattedPrice}
            </span>
          </div>
          <div className="w-full flex justify-center items-center overflow-hidden">
            <BarcodeSvg
              value={barcode || sku || '000000000000'}
              symbology={symbology}
              width={1.2}
              height={28}
              fontSize={10}
              onValidationChange={onValidationChange}
            />
          </div>
        </div>
      )}

      {/* 2. PLANTILLA COMPACTA */}
      {design === 'COMPACT' && (
        <div className="w-full h-full flex flex-col justify-between items-center py-0.5">
          <h4 className="font-semibold text-[10px] leading-none truncate w-full px-0.5 text-slate-800">
            {name}
          </h4>
          <span className="font-bold text-xs text-slate-900 leading-none my-0.5">
            {formattedPrice}
          </span>
          <div className="w-full flex justify-center items-center overflow-hidden scale-90">
            <BarcodeSvg
              value={barcode || sku || '000000000000'}
              symbology={symbology}
              width={1.0}
              height={20}
              fontSize={9}
              onValidationChange={onValidationChange}
            />
          </div>
        </div>
      )}

      {/* 3. PLANTILLA CON CÓDIGO INTERNO */}
      {design === 'INTERNAL_CODE' && (
        <div className="w-full h-full flex flex-col justify-between items-center py-1">
          <div className="w-full px-1">
            <h4 className="font-bold text-xs leading-tight line-clamp-1 text-slate-900">
              {name}
            </h4>
            {sku && (
              <span className="text-[10px] font-mono text-slate-600 block leading-tight">
                Cód: {sku}
              </span>
            )}
          </div>
          <div className="my-0.5">
            <span className="font-extrabold text-sm text-slate-900 tracking-tight">
              {formattedPrice}
            </span>
          </div>
          <div className="w-full flex justify-center items-center overflow-hidden">
            <BarcodeSvg
              value={barcode || sku || '000000000000'}
              symbology={symbology}
              width={1.2}
              height={26}
              fontSize={10}
              onValidationChange={onValidationChange}
            />
          </div>
        </div>
      )}

      {/* 4. PLANTILLA DE PRECIO (GÓNDOLA) */}
      {design === 'PRICE_ONLY' && (
        <div className="w-full h-full flex flex-col justify-center items-center p-2 bg-slate-50 rounded">
          <h4 className="font-bold text-xs leading-tight text-slate-700 uppercase tracking-wide mb-1 text-center line-clamp-2">
            {name}
          </h4>
          <span className="font-black text-xl text-slate-950 tracking-tight">
            {formattedPrice}
          </span>
          {sku && (
            <span className="text-[9px] font-mono text-slate-500 mt-1">
              SKU: {sku}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

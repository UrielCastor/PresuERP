import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

export interface BarcodeSvgProps {
  value: string;
  symbology?: 'AUTO' | 'EAN13' | 'EAN8' | 'CODE128';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
  onValidationChange?: (isValid: boolean, errorText?: string) => void;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  symbology = 'AUTO',
  width = 1.5,
  height = 40,
  displayValue = true,
  fontSize = 11,
  className = '',
  onValidationChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isValid, setIsValid] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) {
      setIsValid(false);
      setErrorMsg('Código vacío');
      onValidationChange?.(false, 'Código vacío');
      return;
    }

    const cleanVal = value.trim();
    let format = 'CODE128';

    if (symbology === 'AUTO') {
      if (/^\d{13}$/.test(cleanVal)) {
        format = 'EAN13';
      } else if (/^\d{8}$/.test(cleanVal)) {
        format = 'EAN8';
      } else {
        format = 'CODE128';
      }
    } else {
      format = symbology;
    }

    try {
      JsBarcode(svgRef.current, cleanVal, {
        format,
        width,
        height,
        displayValue,
        fontSize,
        margin: 2,
        background: '#ffffff',
        lineColor: '#000000',
        valid: (valid: boolean) => {
          if (!valid) {
            setIsValid(false);
            const err = `El código "${cleanVal}" no cumple con el formato ${format}`;
            setErrorMsg(err);
            onValidationChange?.(false, err);
          } else {
            setIsValid(true);
            setErrorMsg(null);
            onValidationChange?.(true);
          }
        },
      });
    } catch (err: any) {
      setIsValid(false);
      const msg = err?.message || `Error al generar formato ${format}`;
      setErrorMsg(msg);
      onValidationChange?.(false, msg);
    }
  }, [value, symbology, width, height, displayValue, fontSize, onValidationChange]);

  if (!value) {
    return <div className="text-xs text-amber-600 italic font-mono">Sin código</div>;
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg ref={svgRef} className="max-w-full overflow-hidden" />
      {!isValid && errorMsg && (
        <span className="text-[10px] text-red-500 font-medium mt-0.5">{errorMsg}</span>
      )}
    </div>
  );
};

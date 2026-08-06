import React, { useState, useRef } from 'react';
import { SettingsService } from '../../services/settings.service';
import { Upload, X, Check, Image as ImageIcon, Trash2, AlertCircle, Loader2, Building2 } from 'lucide-react';

interface LogoUploadModalProps {
  isOpen: boolean;
  currentLogoUrl?: string | null;
  onClose: () => void;
  onSuccess: (newLogoUrl: string | null) => void;
}

export const LogoUploadModal: React.FC<LogoUploadModalProps> = ({
  isOpen,
  currentLogoUrl,
  onClose,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Format Validation (PNG, JPG, JPEG, WEBP)
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setError('Formato no válido. Ingrese una imagen PNG, JPG, JPEG o WEBP.');
      return;
    }

    // 2. Max File Size Validation (5 MB)
    const maxSizeInBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      setError('La imagen supera el tamaño máximo permitido de 5 MB.');
      return;
    }

    setSelectedFile(file);

    // Read Data URL for Live Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = async () => {
    if (!previewUrl && !currentLogoUrl) return;

    setIsUploading(true);
    setError(null);

    try {
      // 1. Fetch current business preferences
      const fullSettings = await SettingsService.getSettings();
      const currentPrefs = fullSettings.settings || {
        currencyCode: 'ARS',
        currencySymbol: '$',
        timezone: 'America/Argentina/Buenos_Aires',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        decimalSeparator: ',',
        thousandSeparator: '.',
        decimalPlaces: 2,
        showCents: true,
        language: 'es',
      };

      // 2. Update preferences with new logoUrl (or null if removed)
      await SettingsService.updatePreferences({
        ...currentPrefs,
        logoUrl: previewUrl,
      });

      onSuccess(previewUrl);
      onClose();
    } catch (err: any) {
      console.error('Error al guardar el logo:', err);
      setError(
        err.response?.data?.message || 'Error al actualizar el logo de la empresa. Verifique sus permisos.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-indigo-600" />
            <h3 className="font-black text-base text-slate-900 dark:text-white">
              Editar Logo de la Empresa
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Preview Box */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="relative w-36 h-36 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner group">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Vista previa del logo"
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <div className="text-center p-4 text-slate-400 space-y-1">
                <Building2 className="h-10 w-10 mx-auto text-slate-300" />
                <span className="text-[11px] font-bold block">Sin Logo</span>
              </div>
            )}
          </div>

          <span className="text-[11px] font-semibold text-slate-400 text-center">
            Formatos admitidos: PNG, JPG, JPEG, WEBP (Máx. 5 MB)
          </span>
        </div>

        {/* File Select Controls */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors"
          >
            <Upload className="h-4 w-4" />
            {previewUrl ? 'Seleccionar otra imagen' : 'Buscar imagen'}
          </button>

          {previewUrl && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              disabled={isUploading}
              className="p-2 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-100 rounded-xl transition-colors"
              title="Quitar Logo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSaveLogo}
            disabled={isUploading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Guardar Logo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

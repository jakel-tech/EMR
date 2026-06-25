import React, { useRef, useState } from 'react';
import { Camera, X, UploadCloud, Image as ImageIcon } from 'lucide-react';
import { compressImage } from '../lib/imageCompression';

interface ImagePickerProps {
  value?: string;
  onChange: (base64: string) => void;
  label?: string;
  isRTL?: boolean;
  className?: string;
}

const ImagePicker: React.FC<ImagePickerProps> = ({
  value,
  onChange,
  label,
  isRTL = false,
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.7 });
      onChange(result.base64);
    } catch (err) {
      console.error('Image upload failed:', err);
    }
  };

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest ml-1">
          {label}
        </label>
      )}
      
      <div 
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={`relative group cursor-pointer overflow-hidden rounded-[2rem] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center min-h-[160px] ${
          value 
            ? 'border-primary-500/50 bg-gray-50 dark:bg-slate-900' 
            : 'border-gray-200 dark:border-slate-800 hover:border-primary-400 hover:bg-primary-50/30 dark:hover:bg-primary-950/10'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {value ? (
          <>
            <img 
              src={value} 
              alt="Preview" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300 flex items-center justify-center ${isHovering ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex flex-col items-center gap-2">
                <UploadCloud className="text-white" size={32} />
                <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Change Illustration</span>
              </div>
            </div>
            <button 
              onClick={clearImage}
              className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-slate-900/90 text-rose-500 rounded-full shadow-xl hover:bg-rose-500 hover:text-white transition-all z-10"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="w-16 h-16 rounded-[1.5rem] bg-primary-50 dark:bg-primary-900/20 text-primary-500 flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300">
              <Camera size={32} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                {isRTL ? 'تحميل صورة' : 'Upload Asset Image'}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                PNG, JPG or WebP (Max 1MB)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImagePicker;

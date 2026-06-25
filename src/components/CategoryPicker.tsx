import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Zap, Camera, Activity, Beaker, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MedicalDeviceCategory } from '../types';

interface CategoryPickerProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  isRTL?: boolean;
}

const CATEGORIES: MedicalDeviceCategory[] = [
  'ECG', 'EMG', 'EEG', 'X-ray', 'CBC', 'Ultrasound', 'MRI', 'CT Scan', 'PET Scan', 'Mammography',
  'ICU Bed', 'Ventilator', 'Patient Monitor', 'Defibrillator', 'Infusion Pump', 'Syringe Pump',
  'Incubator', 'Phototherapy', 'Anesthesia Machine', 'Dialysis Machine', 'Heart-Lung Machine',
  'Surgical Laser', 'C-Arm', 'Autoclave', 'Centrifuge', 'Microscope',
  'Laboratory', 'Surgical', 'Physiotherapy', 'Dental', 'Ophthalmology', 'Orthopedic',
  'General', 'Other'
];

const CategoryPicker: React.FC<CategoryPickerProps> = ({
  value,
  onChange,
  label,
  isRTL = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCategories = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = CATEGORIES.filter(cat => 
      cat.toLowerCase().includes(term)
    );
    
    // Add custom option if not in list
    if (searchTerm && !CATEGORIES.some(cat => cat.toLowerCase() === term)) {
      return [...filtered, `${isRTL ? 'إضافة' : 'Add'} "${searchTerm}"` as any];
    }
    
    return filtered;
  }, [searchTerm, isRTL]);

  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectItem = (item: string) => {
    if (item.startsWith('Add "') || item.startsWith('إضافة "') || item.includes('"')) {
      const match = item.match(/"([^"]+)"/);
      const customVal = match ? match[1] : item;
      onChange(customVal);
    } else {
      onChange(item);
    }
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredCategories.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && isOpen) {
      e.preventDefault();
      if (filteredCategories[highlightedIndex]) {
        handleSelectItem(filteredCategories[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes('scan') || lower.includes('ray') || lower.includes('mri') || lower.includes('ultrasound')) return <Camera size={16} />;
    if (lower.includes('ecg') || lower.includes('emg') || lower.includes('monitor') || lower.includes('pulse')) return <Activity size={16} />;
    if (lower.includes('machine') || lower.includes('pump') || lower.includes('laser')) return <Zap size={16} />;
    if (lower.includes('lab') || lower.includes('cbc') || lower.includes('tube')) return <Beaker size={16} />;
    return <Activity size={16} />;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full p-2.5 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-primary-500 transition-all ${isOpen ? 'ring-2 ring-primary-500/20 border-primary-500' : ''}`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="text-primary-500">
            {getCategoryIcon(value)}
          </div>
          <span className={`truncate text-sm font-medium ${value ? 'text-gray-900' : 'text-gray-400'}`}>
            {value || (isRTL ? 'اختر النوع' : 'Select category')}
          </span>
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <input type="hidden" name="category" value={value} />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-2.5 text-gray-400`} size={16} />
                <input
                  ref={inputRef}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRTL ? 'بحث بالتصنيف...' : 'Search categories...'}
                  className={`w-full ${isRTL ? 'pr-9 pl-4 text-right' : 'pl-9 pr-4 text-left'} py-2 bg-gray-50 border-none rounded-lg focus:ring-0 text-sm outline-none`}
                />
              </div>
            </div>

            <div className="max-h-[250px] overflow-y-auto p-1">
              {filteredCategories.map((cat, index) => (
                <div
                  key={cat}
                  onClick={() => handleSelectItem(cat)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${highlightedIndex === index ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  <div className="flex items-center gap-2">
                    {cat.startsWith('Add "') || cat.startsWith('إضافة "') ? <Plus size={14} /> : getCategoryIcon(cat)}
                    <span className="text-sm font-medium">{cat}</span>
                  </div>
                  {value === cat && (
                    <Check size={14} className="text-primary-600" />
                  )}
                </div>
              ))}
              {filteredCategories.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-xs uppercase tracking-widest font-black">
                  {isRTL ? 'لا توجد نتائج مطابقة' : 'No matches found'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryPicker;

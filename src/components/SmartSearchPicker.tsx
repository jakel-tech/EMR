import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, User, Package, HeartPulse, Microscope, Archive, Plus, X, Globe, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SmartSearchPickerProps {
  items: any[];
  onSelect: (item: any) => void;
  placeholder?: string;
  label?: string;
  selectedId?: string;
  type?: 'patient' | 'asset' | 'inventory' | 'doctor' | 'generic' | 'manufacturer' | 'department' | 'supplier';
  isRTL?: boolean;
  required?: boolean;
  name?: string;
  allowCustom?: boolean;
}

const SmartSearchPicker: React.FC<SmartSearchPickerProps> = ({
  items,
  onSelect,
  placeholder = 'Search...',
  label,
  selectedId,
  type = 'generic',
  isRTL = false,
  required = false,
  name,
  allowCustom = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const localPlaceholder = isRTL ? 'بحث سريع...' : placeholder;

  const selectedItem = useMemo(() => items.find(i => i.id === selectedId), [items, selectedId]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = items.filter(item => {
      const nameMatch = item.name?.toLowerCase().includes(term);
      const idMatch = item.nationalId?.toLowerCase().includes(term) || item.partNumber?.toLowerCase().includes(term) || item.id?.toLowerCase().includes(term);
      const extraMatch = item.category?.toLowerCase().includes(term) || item.specialization?.toLowerCase().includes(term) || item.head_name?.toLowerCase().includes(term);
      return nameMatch || idMatch || extraMatch;
    }).slice(0, 50);

    if (allowCustom && searchTerm && !items.some(i => i.name?.toLowerCase() === term)) {
      return [...filtered, { id: 'custom', name: searchTerm, isCustom: true }];
    }

    return filtered;
  }, [items, searchTerm, allowCustom]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && isOpen) {
      e.preventDefault();
      if (filteredItems[highlightedIndex]) {
        handleSelectItem(filteredItems[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelectItem = (item: any) => {
    if (item.isCustom) {
      onSelect({ id: `new_${Date.now()}`, name: item.name, isNew: true });
    } else {
      onSelect(item);
    }
    setSearchTerm('');
    setIsOpen(false);
  };

  const getIcon = () => {
    switch (type) {
      case 'patient': return <HeartPulse size={16} />;
      case 'asset': return <Microscope size={16} />;
      case 'inventory': return <Archive size={16} />;
      case 'doctor': return <User size={16} />;
      case 'manufacturer': return <Globe size={16} />;
      case 'department': return <Archive size={16} />;
      case 'supplier': return <Truck size={16} />;
      default: return <Package size={16} />;
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center justify-between w-full p-3 bg-white dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300 ${isOpen ? 'ring-2 ring-primary-500/20 border-primary-500' : ''}`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${selectedItem ? 'bg-primary-50 text-primary-600' : 'bg-gray-50 text-gray-400 group-hover:bg-primary-50 group-hover:text-primary-500'}`}>
            {getIcon()}
          </div>
          <div className="truncate">
            <p className={`text-sm font-black uppercase tracking-tight truncate ${selectedItem ? 'text-gray-800 dark:text-slate-200' : 'text-gray-400'}`}>
              {selectedItem ? selectedItem.name : localPlaceholder}
            </p>
            {selectedItem && (
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">
                {selectedItem.nationalId || selectedItem.partNumber || selectedItem.category || `#${selectedItem.id.slice(0, 8)}`}
              </p>
            )}
          </div>
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <input type="hidden" name={name} value={selectedId || ''} required={required} />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className={`absolute z-[100] w-full mt-2 bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-100 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden ${isRTL ? 'right-0' : 'left-0'}`}
          >
            <div className="p-3 border-b border-gray-100 dark:border-slate-800">
              <div className="relative">
                <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-3 text-gray-400`} size={18} />
                <input
                  ref={inputRef}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={localPlaceholder}
                  className={`w-full ${isRTL ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} py-2.5 bg-gray-50 dark:bg-slate-800/50 border-none rounded-xl focus:ring-0 text-sm font-bold placeholder:text-gray-400 outline-none`}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto px-2 py-2">
              {filteredItems.length > 0 ? (
                filteredItems.map((item, index) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all duration-200 ${highlightedIndex === index ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black transition-colors ${highlightedIndex === index ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'bg-gray-100 dark:bg-slate-800 text-gray-400'}`}>
                        {item.isCustom ? <Plus size={16} /> : (item.name ? item.name[0].toUpperCase() : 'N')}
                      </div>
                      <div>
                        <p className={`text-sm font-black uppercase tracking-tight ${highlightedIndex === index ? 'text-primary-700 dark:text-primary-400' : 'text-gray-800 dark:text-slate-200'}`}>
                          {item.isCustom ? (isRTL ? `إضافة "${item.name}"` : `Add "${item.name}"`) : item.name}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {item.isCustom ? (isRTL ? 'إنشاء عنصر جديد' : 'Create new item') : (item.id || item.category || '')} {item.category && !item.isCustom ? `• ${item.category}` : ''}
                        </p>
                      </div>
                    </div>
                    {selectedId === item.id && (
                      <Check size={16} className="text-primary-600" />
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center">
                  <Package className="mx-auto text-gray-300 mb-2" size={32} />
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{isRTL ? 'لم يتم العثور على نتائج' : 'No results found'}</p>
                </div>
              )}
            </div>
            
            {type === 'patient' && (
              <div className="p-3 bg-gray-50/50 dark:bg-slate-800/30 border-t border-gray-100 dark:border-slate-800 text-center">
                <button className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] hover:text-primary-700 transition flex items-center justify-center gap-1.5 mx-auto">
                  <Plus size={12} /> {isRTL ? 'تسجيل مريض جديد' : 'Register New Patient'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartSearchPicker;

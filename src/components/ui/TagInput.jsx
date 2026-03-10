import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TagInput = ({ label, placeholder, value = [], onChange }) => {
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);
  }, []);

  const handleInputKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const newTag = inputValue.trim().replace(/^#/, '');
      if (!value.includes(newTag)) {
        const newTags = [...value, newTag];
        onChange(newTags);
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      const newTags = value.slice(0, value.length - 1);
      onChange(newTags);
    }
  }, [inputValue, value, onChange]);

  const removeTag = useCallback((tagToRemove) => {
    const newTags = value.filter(tag => tag !== tagToRemove);
    onChange(newTags);
  }, [value, onChange]);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-gold-400 uppercase tracking-widest mb-3">
          {label}
        </label>
      )}
      <div className="relative p-2 rounded-xl bg-white/5 border border-white/10 focus-within:ring-2 focus-within:ring-gold-500/50 focus-within:border-gold-500/50 transition-all shadow-inner">
        <div className="flex flex-wrap items-center gap-2 min-h-[40px]">
          <AnimatePresence>
            {value.map((tag) => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 bg-gold-500/10 border border-gold-500/20 text-gold-200 text-xs px-3 py-1 rounded-full"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="p-0.5 rounded-full hover:bg-gold-500/20 transition-colors"
                  aria-label={`Remove tag ${tag}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          <input
            type="text"
            className="flex-grow min-w-[120px] bg-transparent border-none focus:ring-0 text-cream-50 placeholder-white/20 text-sm p-1"
            placeholder={value.length === 0 ? placeholder : ''}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
          />
        </div>
      </div>
    </div>
  );
};

export default TagInput;

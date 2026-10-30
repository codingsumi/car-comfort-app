'use client';

import { useState } from 'react';

interface ColorPickerProps {
  label?: string;
  description?: string;
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ label, description, value, onChange }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(value);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(val)) {
      onChange(val);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
  };

  return (
    <div className="w-full">
      {label && <p className="mb-1.5 text-sm font-medium text-secondary-500">{label}</p>}
      {description && <p className="mb-2 text-xs text-neutral-300">{description}</p>}
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value || '#000000'}
          onChange={handleColorChange}
          className="h-10 w-10 cursor-pointer rounded-lg border border-neutral-200 p-0.5"
        />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="#000000"
          className="block w-32 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { cleanLeadingZeros } from '../../utils/currency';

export interface WeightInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string | null | undefined;
  onChange: (numericValue: number, rawText: string) => void;
  suffix?: string;
  maxDecimals?: number;
}

export const WeightInput: React.FC<WeightInputProps> = ({
  value,
  onChange,
  suffix = 'g',
  maxDecimals = 3,
  className = '',
  onFocus,
  onBlur,
  placeholder = '0.000',
  ...rest
}) => {
  const [localText, setLocalText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      if (value === null || value === undefined || value === '') {
        setLocalText('');
      } else if (value === 0 && localText === '') {
        setLocalText('');
      } else {
        const num = typeof value === 'number' ? value : parseFloat(String(value));
        if (isNaN(num)) {
          setLocalText('');
        } else {
          setLocalText(String(value));
        }
      }
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (value !== null && value !== undefined && value !== '') {
      setLocalText(cleanLeadingZeros(String(value)));
    } else {
      setLocalText('');
    }
    if (onFocus) onFocus(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;

    // Filter characters: allow only digits and single decimal point
    let sanitized = inputVal.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit decimal precision
    if (parts.length === 2 && parts[1].length > maxDecimals) {
      sanitized = parts[0] + '.' + parts[1].slice(0, maxDecimals);
    }

    // Clean redundant leading zero (e.g. "0200" -> "200")
    const cleaned = cleanLeadingZeros(sanitized);

    setLocalText(cleaned);

    if (cleaned === '' || cleaned === '.') {
      onChange(0, cleaned);
    } else {
      const parsed = parseFloat(cleaned);
      onChange(isNaN(parsed) ? 0 : parsed, cleaned);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (!localText || localText.trim() === '') {
      setLocalText('');
      onChange(0, '');
    } else {
      const parsed = parseFloat(localText);
      if (isNaN(parsed)) {
        setLocalText('');
        onChange(0, '');
      } else {
        // Normalize decimal text if needed, e.g. "200" or "200.5"
        setLocalText(cleanedText => cleanLeadingZeros(cleanedText));
      }
    }
    if (onBlur) onBlur(e);
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        inputMode="decimal"
        className={`${suffix ? 'pr-7 ' : ''}${className}`}
        value={localText}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        {...rest}
      />
      {suffix && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[11px] select-none pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
};

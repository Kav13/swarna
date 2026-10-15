import React, { useState, useEffect } from 'react';
import { cleanLeadingZeros, formatIndianNumber, parseIndianNumber } from '../../utils/currency';

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string | null | undefined;
  onChange: (numericValue: number, rawText: string) => void;
  prefixSymbol?: string;
  allowDecimals?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  prefixSymbol,
  allowDecimals = true,
  className = '',
  onFocus,
  onBlur,
  placeholder = '0',
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localText, setLocalText] = useState('');

  // Sync incoming value to local state
  useEffect(() => {
    if (!isFocused) {
      if (value === null || value === undefined || value === '') {
        setLocalText('');
      } else if (value === 0 && localText === '') {
        setLocalText('');
      } else {
        const num = typeof value === 'number' ? value : parseIndianNumber(value);
        if (num === null) {
          setLocalText('');
        } else {
          setLocalText(formatIndianNumber(value));
        }
      }
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Strip formatting commas on focus so user edits clean raw digits without cursor jumps
    if (value !== null && value !== undefined && value !== '') {
      const raw = String(value).replace(/,/g, '');
      setLocalText(cleanLeadingZeros(raw));
    } else {
      setLocalText('');
    }
    if (onFocus) onFocus(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;

    // Filter characters: allow only digits and at most one decimal point
    let sanitized = allowDecimals
      ? inputVal.replace(/[^0-9.]/g, '')
      : inputVal.replace(/[^0-9]/g, '');

    // Allow only one decimal point
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }

    // Clean redundant leading zeros (e.g. "0200" -> "200")
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
        setLocalText(formatIndianNumber(localText));
      }
    }
    if (onBlur) onBlur(e);
  };

  return (
    <div className="relative w-full">
      {prefixSymbol && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs select-none pointer-events-none">
          {prefixSymbol}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        className={`${prefixSymbol ? 'pl-7 ' : ''}${className}`}
        value={localText}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        {...rest}
      />
    </div>
  );
};

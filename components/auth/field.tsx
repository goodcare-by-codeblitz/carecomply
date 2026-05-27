import * as React from 'react';

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, suffix, id, required, className, ...inputProps }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <label className="block" htmlFor={inputId}>
        <div className="flex items-center justify-between text-[13px] font-medium text-ink mb-2">
          <span>
            {label}
            {required && <span className="text-red-600 ml-0.5">*</span>}
          </span>
          {hint && <span>{hint}</span>}
        </div>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            required={required}
            className={`w-full h-12 rounded-lg border border-line-strong bg-white px-4 text-[15px] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition ${suffix ? 'pr-32' : ''} ${className ?? ''}`}
            {...inputProps}
          />
          {suffix && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[13px]">
              {suffix}
            </div>
          )}
        </div>
      </label>
    );
  }
);
Field.displayName = 'Field';

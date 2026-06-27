import { InputHTMLAttributes } from 'react';
interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}
export default function TextInput({ label, error, id, ...rest }: Props) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        id={inputId}
        className={`w-full rounded-lg bg-gray-800 border px-3 py-2 text-sm text-gray-100 outline-none ${
          error ? 'border-red-500' : 'border-gray-700 focus:border-indigo-500'
        }`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...rest}
      />
      {error && <p id={`${inputId}-error`} className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

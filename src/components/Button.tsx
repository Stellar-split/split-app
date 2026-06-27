import { ButtonHTMLAttributes } from 'react';
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  isLoading?: boolean;
}
export default function Button({ variant = 'primary', isLoading, children, disabled, className = '', ...rest }: Props) {
  return (
    <button
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
        variant === 'primary' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
      } ${className}`}
      {...rest}
    >
      {isLoading ? 'Loading…' : children}
    </button>
  );
}

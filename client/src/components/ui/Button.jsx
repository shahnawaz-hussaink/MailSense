import { forwardRef } from 'react';
import Spinner from './Spinner';

const Button = forwardRef(function Button(
  { children, variant = 'primary', size = 'md', loading = false, className = '', ...props },
  ref
) {
  const base = 'btn inline-flex items-center gap-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:   'bg-brand-600 hover:bg-brand-500 text-white shadow-[0_0_12px_-2px_rgba(100,112,243,0.3)] hover:shadow-[0_0_24px_-4px_rgba(100,112,243,0.4)] active:scale-[0.98]',
    secondary: 'bg-surface-800 hover:bg-surface-700 text-slate-200 border border-surface-700',
    ghost:     'hover:bg-surface-800/60 text-slate-400 hover:text-slate-100',
    danger:    'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-700/30',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5',
    lg: 'px-5 py-3 text-base',
  };

  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
});

export default Button;

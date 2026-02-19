export default function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div
      className={`${sizes[size]} rounded-full border-2 border-surface-700 border-t-brand-500 animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

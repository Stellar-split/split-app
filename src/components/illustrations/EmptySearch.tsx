export default function EmptySearch() {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <circle cx="40" cy="40" r="20" className="stroke-gray-400 dark:stroke-gray-600" strokeWidth="2" />
      <line x1="56" y1="56" x2="68" y2="68" className="stroke-gray-400 dark:stroke-gray-600" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="40" x2="52" y2="40" className="stroke-gray-400 dark:stroke-gray-600" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <circle cx="72" cy="72" r="12" className="stroke-gray-400 dark:stroke-gray-600" strokeWidth="2" />
      <line x1="68" y1="68" x2="76" y2="76" className="stroke-gray-400 dark:stroke-gray-600" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

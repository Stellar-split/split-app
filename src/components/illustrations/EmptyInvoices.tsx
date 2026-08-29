export default function EmptyInvoices() {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <rect x="16" y="24" width="56" height="64" rx="4" className="stroke-gray-400 dark:stroke-gray-600" strokeWidth="2" />
      <line x1="24" y1="32" x2="72" y2="32" className="stroke-gray-400 dark:stroke-gray-600" strokeWidth="2" />
      <line x1="24" y1="40" x2="56" y2="40" className="stroke-gray-400 dark:stroke-gray-600" strokeWidth="1.5" />
      <line x1="24" y1="48" x2="56" y2="48" className="stroke-gray-400 dark:stroke-gray-600" strokeWidth="1.5" />
      <line x1="24" y1="56" x2="56" y2="56" className="stroke-gray-400 dark:stroke-gray-600" strokeWidth="1.5" />
      <circle cx="64" cy="48" r="8" className="fill-gray-400 dark:fill-gray-600" />
      <path d="M64 46v4m-2-2h4" className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

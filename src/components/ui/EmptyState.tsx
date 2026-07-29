import type { ReactNode } from "react";

interface Props {
  illustration: ReactNode;
  heading: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

/**
 * EmptyState — displays an illustration, heading, description, and optional CTA
 * when a list or section has no data. Supports both light and dark modes via inline SVG.
 */
export default function EmptyState({
  illustration,
  heading,
  description,
  action,
  className = "",
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
      role="status"
      aria-label={heading}
    >
      <div className="mb-4 w-24 h-24 text-gray-400 dark:text-gray-600">
        {illustration}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {heading}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-sm">
        {description}
      </p>
      {action && <div className="flex gap-2">{action}</div>}
    </div>
  );
}

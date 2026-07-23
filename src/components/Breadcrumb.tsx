import Link from "next/link";
import { usePathname } from "next/navigation";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: Props) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) return null;

  // Mobile: show only last 2 items
  const displayItems = items.length > 2 ? items.slice(-2) : items;
  const showEllipsis = items.length > 2;

  return (
    <nav
      className="flex items-center gap-1 text-sm text-gray-400 px-4 sm:px-6 py-2 border-b border-gray-800"
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center gap-1">
        {showEllipsis && (
          <>
            <li>
              <Link
                href="/"
                className="hover:text-gray-200 transition-colors"
              >
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-gray-600">
              …
            </li>
          </>
        )}
        {displayItems.map((item, i) => {
          const isLast = i === displayItems.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1">
              {!isLast && i > 0 && (
                <span aria-hidden="true" className="text-gray-600">
                  /
                </span>
              )}
              {isLast ? (
                <span className="text-gray-300 font-medium">{item.label}</span>
              ) : (
                <>
                  {i === 0 && !showEllipsis && (
                    <Link
                      href="/"
                      className="hover:text-gray-200 transition-colors"
                    >
                      Home
                    </Link>
                  )}
                  {i > 0 && (
                    <>
                      <span aria-hidden="true" className="text-gray-600">
                        /
                      </span>
                      <Link
                        href={item.href || "#"}
                        className="hover:text-gray-200 transition-colors"
                      >
                        {item.label}
                      </Link>
                    </>
                  )}
                  {i === 0 && !showEllipsis && (
                    <>
                      <span aria-hidden="true" className="text-gray-600">
                        /
                      </span>
                      <span className="text-gray-300">{item.label}</span>
                    </>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

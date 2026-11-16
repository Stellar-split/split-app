import Link from "next/link";
import { usePathname } from "next/navigation";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface Props {
  items?: BreadcrumbItem[];
}

const HOME_ITEM: BreadcrumbItem = { label: "Home", href: "/" };

/**
 * Convert a URL segment into a human-readable label.
 * e.g. "getting-started" -> "Getting Started"
 */
export function formatSegmentLabel(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Build a breadcrumb trail from a pathname.
 * Pages can pass `labels` to override the generated label for a given href.
 */
export function buildBreadcrumbTrail(
  pathname: string,
  labels: Record<string, string> = {}
): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const trail: BreadcrumbItem[] = [HOME_ITEM];
  let href = "";

  segments.forEach((segment, index) => {
    href += `/${segment}`;
    const isLast = index === segments.length - 1;
    trail.push({
      label: labels[href] ?? formatSegmentLabel(segment),
      href: isLast ? undefined : href,
    });
  });

  return trail;
}

export default function Breadcrumb({ items }: Props) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) return null;

  const trail = items && items.length > 0 ? items : buildBreadcrumbTrail(pathname);

  // Avoid duplicate Home entries (e.g. when items already start with Home)
  const normalized = trail.filter(
    (item, i) => !(i > 0 && item.href === "/" && trail[0]?.href === "/")
  );

  if (normalized.length === 0) return null;

  return (
    <nav
      className="flex items-center gap-1 text-sm text-white px-4 sm:px-6 py-2 border-b border-gray-800 overflow-x-auto"
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center gap-1">
        {normalized.map((item, i) => {
          const isLast = i === normalized.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && (
                <span aria-hidden="true" className="text-gray-500">
                  /
                </span>
              )}
              {isLast ? (
                <span className="text-white font-medium" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href || "/"}
                  className="hover:text-gray-200 transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

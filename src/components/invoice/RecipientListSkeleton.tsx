const shimmer = "animate-pulse bg-gray-200 dark:bg-gray-700 rounded";

interface Props {
  count?: number;
}

/**
 * RecipientListSkeleton — matches RecipientPayoutTracker table row structure.
 * Each skeleton row matches real row height and internal proportions.
 */
export default function RecipientListSkeleton({ count = 3 }: Props) {
  return (
    <table className="w-full">
      <tbody>
        {Array.from({ length: count }).map((_, i) => (
          <tr
            key={i}
            className="border-b border-gray-700/50"
            role="status"
            aria-busy="true"
            aria-label="Loading recipient data"
          >
            <td className="px-4 py-3 text-sm">
              <div className={`${shimmer} h-4 w-48`} />
            </td>
            <td className="px-4 py-3 text-sm text-right">
              <div className={`${shimmer} h-4 w-20 ml-auto`} />
            </td>
            <td className="px-4 py-3 text-sm text-right">
              <div className={`${shimmer} h-5 w-16 ml-auto rounded-full`} />
            </td>
            <td className="px-4 py-3 text-sm text-right">
              <div className={`${shimmer} h-8 w-20 ml-auto`} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

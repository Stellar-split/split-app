import { SkeletonProgress, SkeletonRow } from "@/components/Skeleton";

export default function VerifyLoading() {
  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <div className="animate-pulse bg-gray-700 rounded h-5 w-24 mb-2" />
      <div className="animate-pulse bg-gray-700 rounded h-8 w-40 mb-6" />
      <SkeletonProgress />
      <div className="mt-8 flex flex-col gap-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </main>
  );
}

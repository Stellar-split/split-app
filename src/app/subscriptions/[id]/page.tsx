import { Suspense } from "react";
import SubscriptionDetailClient from "@/components/SubscriptionDetailClient";
import { SubscriptionDetailSkeleton } from "@/components/Skeleton";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Subscription Details — StellarSplit",
};

export default async function SubscriptionDetailPage() {
  return (
    <Suspense fallback={<SubscriptionDetailSkeleton />}>
      <SubscriptionDetailClient />
    </Suspense>
  );
}

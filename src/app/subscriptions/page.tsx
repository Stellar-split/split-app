import { Suspense } from "react";
import SubscriptionsClient from "@/components/SubscriptionsClient";
import { SubscriptionListSkeleton } from "@/components/Skeleton";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Subscriptions — StellarSplit",
};

export default async function SubscriptionsPage() {
  return (
    <Suspense fallback={<SubscriptionListSkeleton />}>
      <SubscriptionsClient />
    </Suspense>
  );
}

import PayerBehaviorAnalytics from "@/components/analytics/PayerBehaviorAnalytics";

export default function PayerBehaviorPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold">Payer behavior</h1>
      <PayerBehaviorAnalytics />
    </main>
  );
}

import RateCardBuilder from "@/components/RateCardBuilder";

export default function RateCardPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold">Rate card</h1>
      <RateCardBuilder />
    </main>
  );
}

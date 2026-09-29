import InvoiceSecurityDashboard from "@/components/security/InvoiceSecurityDashboard";

export default function InvoiceSecurityPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold">Invoice security</h1>
      <InvoiceSecurityDashboard events={[]} />
    </main>
  );
}

import MobileInvoiceWizard from '@/components/MobileInvoiceWizard';

export const metadata = { title: 'Create Invoice – Mobile' };

export default function MobileInvoicePage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white py-6">
      <MobileInvoiceWizard />
    </main>
  );
}

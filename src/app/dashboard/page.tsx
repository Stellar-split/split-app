import DashboardClient from "@/components/DashboardClient";

/**
 * Dashboard page with streaming SSR.
 * The page shell renders immediately, and invoice cards stream in as they load.
 */
export default async function DashboardPage() {
  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <DashboardClient />
    </main>
  );
}

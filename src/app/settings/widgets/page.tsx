import type { Metadata } from "next";
import DashboardWidgetsBuilderPage from "./DashboardWidgetsBuilderPage";

export const metadata: Metadata = {
  title: "Dashboard Widgets — StellarSplit Settings",
  robots: { index: false, follow: false },
  description: "Customise which widgets appear on your StellarSplit dashboard.",
};

export default function Page() {
  return <DashboardWidgetsBuilderPage />;
}

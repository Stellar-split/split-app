import type { Metadata } from "next";
import PayerReputationPage from "./PayerReputationPage";

export const metadata: Metadata = {
  title: "Payer Reputation Scores — StellarSplit",
  robots: { index: false, follow: false },
  description: "Browse and check payer reputation scores on StellarSplit.",
};

export default function Page() {
  return <PayerReputationPage />;
}

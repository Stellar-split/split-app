import { Subscription } from "@/lib/subscriptions";

interface AnalyticsPanelProps {
  subscriptions?: Subscription[];
}

export default function AnalyticsPanel({ subscriptions }: AnalyticsPanelProps) {
  return (
    <div className="analytics-panel">
      <h3>Analytics</h3>
      {subscriptions && subscriptions.length > 0 && (
        <p>{subscriptions.length} subscriptions</p>
      )}
    </div>
  );
}

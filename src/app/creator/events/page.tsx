import CommunityEventsCalendar from "@/components/creator/CommunityEventsCalendar";

export default function CreatorEventsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold">Community events</h1>
      <CommunityEventsCalendar events={[]} />
    </main>
  );
}

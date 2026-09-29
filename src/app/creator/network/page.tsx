import CreatorNetwork from "@/components/network/CreatorNetwork";

export default function CreatorNetworkPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold">Creator network</h1>
      <CreatorNetwork me={{ address: "", name: "", tags: [] }} creators={[]} />
    </main>
  );
}

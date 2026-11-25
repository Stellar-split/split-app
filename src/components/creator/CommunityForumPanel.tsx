import { DEFAULT_FORUM_URL, newTopicUrl, sortTopicsByActivity, topicUrl, type ForumTopic } from "@/lib/creatorForum";

interface Props {
  topics: ForumTopic[];
  baseUrl?: string;
}

export default function CommunityForumPanel({ topics, baseUrl = DEFAULT_FORUM_URL }: Props) {
  const config = { baseUrl };
  return (
    <section aria-label="Creator community forum" className="w-full rounded-lg border p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold">Creator community</h3>
        <a
          href={newTopicUrl(config, "")}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-blue-600 px-3 py-1 text-center text-sm text-white"
        >
          Start a discussion
        </a>
      </div>
      {topics.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No discussions yet.</p>
      ) : (
        <ul className="mt-3 divide-y text-sm">
          {sortTopicsByActivity(topics).map((t) => (
            <li key={t.id} className="flex justify-between gap-4 py-2">
              <a href={topicUrl(config, t)} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                {t.title}
              </a>
              <span className="shrink-0 text-gray-500">{t.replies} replies</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface ForumConfig {
  /** Base URL of the community forum (e.g. a Discourse instance). */
  baseUrl: string;
}

export interface ForumTopic {
  id: number;
  title: string;
  slug: string;
  replies: number;
  lastActivity: string;
}

export const DEFAULT_FORUM_URL = process.env.NEXT_PUBLIC_COMMUNITY_FORUM_URL ?? "https://forum.stellarsplit.app";

export function topicUrl(config: ForumConfig, topic: Pick<ForumTopic, "id" | "slug">): string {
  return `${config.baseUrl.replace(/\/+$/, "")}/t/${encodeURIComponent(topic.slug)}/${topic.id}`;
}

export function newTopicUrl(config: ForumConfig, title: string, category = "creators"): string {
  const params = new URLSearchParams({ title, category });
  return `${config.baseUrl.replace(/\/+$/, "")}/new-topic?${params.toString()}`;
}

export function sortTopicsByActivity(topics: ForumTopic[]): ForumTopic[] {
  return [...topics].sort((a, b) => Date.parse(b.lastActivity) - Date.parse(a.lastActivity));
}

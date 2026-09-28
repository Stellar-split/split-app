import React, { useMemo, useState } from 'react';

export interface AppCreator {
  id: string;
  name: string;
  skills: string[];
  interests: string[];
}

export interface Mentor {
  id: string;
  name: string;
  expertise: string[];
  interests: string[];
  bio?: string;
}

export interface MentorshipMatch {
  mentor: Mentor;
  score: number;
  sharedSkills: string[];
  sharedInterests: string[];
}

const normalize = (value: string): string => value.trim().toLowerCase();

const uniqueNormalized = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = normalize(value);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
};

const intersect = (a: string[], b: string[]): string[] => {
  const setB = new Set(b);
  return a.filter((item) => setB.has(item));
};

/**
 * Score a mentor against an app creator. Skills are weighted higher than
 * interests since they represent direct capability overlap.
 */
export const scoreMentor = (creator: AppCreator, mentor: Mentor): MentorshipMatch => {
  const creatorSkills = uniqueNormalized(creator.skills);
  const creatorInterests = uniqueNormalized(creator.interests);
  const mentorExpertise = uniqueNormalized(mentor.expertise);
  const mentorInterests = uniqueNormalized(mentor.interests);

  const sharedSkills = intersect(creatorSkills, mentorExpertise);
  const sharedInterests = intersect(creatorInterests, mentorInterests);

  const score = sharedSkills.length * 3 + sharedInterests.length;

  return { mentor, score, sharedSkills, sharedInterests };
};

/**
 * Rank mentors for a creator, best match first. Mentors with no overlap are
 * filtered out so the UI only surfaces meaningful matches.
 */
export const matchMentors = (creator: AppCreator, mentors: Mentor[]): MentorshipMatch[] => {
  return mentors
    .map((mentor) => scoreMentor(creator, mentor))
    .filter((match) => match.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.mentor.name.localeCompare(b.mentor.name);
    });
};

interface MentorshipMatcherProps {
  creator: AppCreator;
  mentors: Mentor[];
  onRequestMatch?: (match: MentorshipMatch) => void;
}

const MentorshipMatcher: React.FC<MentorshipMatcherProps> = ({
  creator,
  mentors,
  onRequestMatch,
}) => {
  const [requestedId, setRequestedId] = useState<string | null>(null);

  const matches = useMemo(() => matchMentors(creator, mentors), [creator, mentors]);

  const handleRequest = (match: MentorshipMatch) => {
    setRequestedId(match.mentor.id);
    onRequestMatch?.(match);
  };

  return (
    <section className="w-full max-w-3xl mx-auto px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
          Mentorship Matches
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Mentors matched to {creator.name} based on shared skills and interests.
        </p>
      </header>

      {matches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          No mentors match your skills or interests yet. Try adding more to your profile.
        </p>
      ) : (
        <ul className="space-y-4">
          {matches.map((match) => (
            <li
              key={match.mentor.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-base font-medium text-gray-900">
                    {match.mentor.name}
                  </h3>
                  {match.mentor.bio && (
                    <p className="mt-1 text-sm text-gray-600">{match.mentor.bio}</p>
                  )}
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                  Match score: {match.score}
                </span>
              </div>

              {match.sharedSkills.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Shared skills
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {match.sharedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {match.sharedInterests.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Shared interests
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {match.sharedInterests.map((interest) => (
                      <span
                        key={interest}
                        className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => handleRequest(match)}
                  disabled={requestedId === match.mentor.id}
                  className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
                >
                  {requestedId === match.mentor.id ? 'Request sent' : 'Request mentorship'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default MentorshipMatcher;

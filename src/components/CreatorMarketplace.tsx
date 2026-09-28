import React, { useState, useMemo } from 'react';

interface Creator {
  id: string;
  name: string;
  skills: string[];
  interests: string[];
  bio: string;
  avatarUrl?: string;
}

interface MentorMatch {
  creator: Creator;
  score: number;
  sharedSkills: string[];
  sharedInterests: string[];
}

interface CreatorMarketplaceProps {
  creators: Creator[];
  currentCreator?: Creator;
}

const computeMatch = (current: Creator, candidate: Creator): MentorMatch => {
  const sharedSkills = candidate.skills.filter((skill) =>
    current.skills.some((s) => s.toLowerCase() === skill.toLowerCase())
  );
  const sharedInterests = candidate.interests.filter((interest) =>
    current.interests.some((i) => i.toLowerCase() === interest.toLowerCase())
  );
  const score = sharedSkills.length * 2 + sharedInterests.length;
  return { creator: candidate, score, sharedSkills, sharedInterests };
};

export const rankMentorMatches = (
  current: Creator,
  candidates: Creator[]
): MentorMatch[] => {
  return candidates
    .filter((candidate) => candidate.id !== current.id)
    .map((candidate) => computeMatch(current, candidate))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
};

const CreatorMarketplace: React.FC<CreatorMarketplaceProps> = ({
  creators,
  currentCreator,
}) => {
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(
    currentCreator?.id ?? null
  );

  const activeCreator = useMemo(
    () => creators.find((c) => c.id === selectedCreatorId) ?? currentCreator,
    [creators, selectedCreatorId, currentCreator]
  );

  const matches = useMemo(() => {
    if (!activeCreator) return [];
    return rankMentorMatches(activeCreator, creators);
  }, [activeCreator, creators]);

  return (
    <div className="creator-marketplace w-full max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4">
        Creator Mentorship Matching
      </h2>

      {!activeCreator ? (
        <p className="text-gray-600">Select a creator to find mentor matches.</p>
      ) : (
        <>
          <div className="mb-6">
            <label
              htmlFor="creator-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Find mentors for
            </label>
            <select
              id="creator-select"
              className="w-full sm:w-72 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={activeCreator.id}
              onChange={(e) => setSelectedCreatorId(e.target.value)}
            >
              {creators.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {creator.name}
                </option>
              ))}
            </select>
          </div>

          {matches.length === 0 ? (
            <p className="text-gray-600">
              No mentor matches found for {activeCreator.name} yet.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((match) => (
                <li
                  key={match.creator.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    {match.creator.avatarUrl ? (
                      <img
                        src={match.creator.avatarUrl}
                        alt={match.creator.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium">
                        {match.creator.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">
                        {match.creator.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Match score: {match.score}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                    {match.creator.bio}
                  </p>
                  {match.sharedSkills.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500">
                        Shared skills
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {match.sharedSkills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {match.sharedInterests.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500">
                        Shared interests
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {match.sharedInterests.map((interest) => (
                          <span
                            key={interest}
                            className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default CreatorMarketplace;

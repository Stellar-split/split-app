export interface AppCreator {
  id: string;
  name: string;
  skills: string[];
  interests: string[];
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
}

export interface Mentor {
  id: string;
  name: string;
  expertise: string[];
  interests: string[];
  experienceLevel: 'intermediate' | 'advanced';
  maxMentees: number;
}

export interface MentorshipMatch {
  creatorId: string;
  mentorId: string;
  score: number;
  sharedSkills: string[];
  sharedInterests: string[];
}

const EXPERIENCE_WEIGHT = 0.4;
const SKILL_WEIGHT = 0.4;
const INTEREST_WEIGHT = 0.2;

function normalize(values: string[]): string[] {
  return values.map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function intersection(a: string[], b: string[]): string[] {
  const setB = new Set(normalize(b));
  return normalize(a).filter((value) => setB.has(value));
}

function experienceScore(creator: AppCreator, mentor: Mentor): number {
  const levels = ['beginner', 'intermediate', 'advanced'];
  const creatorIndex = levels.indexOf(creator.experienceLevel);
  const mentorIndex = levels.indexOf(mentor.experienceLevel);
  if (mentorIndex <= creatorIndex) {
    return 0;
  }
  return Math.min(1, (mentorIndex - creatorIndex) / (levels.length - 1));
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(normalize(a));
  const setB = new Set(normalize(b));
  if (setA.size === 0 && setB.size === 0) {
    return 0;
  }
  let shared = 0;
  setA.forEach((value) => {
    if (setB.has(value)) {
      shared += 1;
    }
  });
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : shared / union;
}

export function scoreMatch(creator: AppCreator, mentor: Mentor): number {
  const skillScore = jaccard(creator.skills, mentor.expertise);
  const interestScore = jaccard(creator.interests, mentor.interests);
  const expScore = experienceScore(creator, mentor);
  const raw =
    skillScore * SKILL_WEIGHT +
    interestScore * INTEREST_WEIGHT +
    expScore * EXPERIENCE_WEIGHT;
  return Math.round(raw * 100) / 100;
}

export function matchCreatorToMentors(
  creator: AppCreator,
  mentors: Mentor[],
  limit = 3,
): MentorshipMatch[] {
  return mentors
    .map((mentor) => {
      const sharedSkills = intersection(creator.skills, mentor.expertise);
      const sharedInterests = intersection(creator.interests, mentor.interests);
      return {
        creatorId: creator.id,
        mentorId: mentor.id,
        score: scoreMatch(creator, mentor),
        sharedSkills,
        sharedInterests,
      };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
}

export function matchMentorsToCreators(
  mentor: Mentor,
  creators: AppCreator[],
  limit = 3,
): MentorshipMatch[] {
  return creators
    .map((creator) => {
      const sharedSkills = intersection(creator.skills, mentor.expertise);
      const sharedInterests = intersection(creator.interests, mentor.interests);
      return {
        creatorId: creator.id,
        mentorId: mentor.id,
        score: scoreMatch(creator, mentor),
        sharedSkills,
        sharedInterests,
      };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
}

export function assignMentors(
  creators: AppCreator[],
  mentors: Mentor[],
): MentorshipMatch[] {
  const capacity = new Map<string, number>();
  mentors.forEach((mentor) => capacity.set(mentor.id, mentor.maxMentees));

  const candidates: MentorshipMatch[] = [];
  creators.forEach((creator) => {
    matchCreatorToMentors(creator, mentors, mentors.length).forEach((match) => {
      candidates.push(match);
    });
  });

  candidates.sort((a, b) => b.score - a.score);

  const assignedCreators = new Set<string>();
  const assignments: MentorshipMatch[] = [];

  candidates.forEach((match) => {
    if (assignedCreators.has(match.creatorId)) {
      return;
    }
    const remaining = capacity.get(match.mentorId) ?? 0;
    if (remaining <= 0) {
      return;
    }
    capacity.set(match.mentorId, remaining - 1);
    assignedCreators.add(match.creatorId);
    assignments.push(match);
  });

  return assignments;
}

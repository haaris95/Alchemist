export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type Book = {
  id: string;
  title: string;
  author: string;
  genre: string;
  pages: number;
  difficulty: Difficulty;
  practicality: number;
  evidenceScore: number;
  themes: string[];
  description: string;
  coverImage: string;
};

export type ReadingProfile = {
  name: string;
  interests: string[];
  preferredDifficulty: Difficulty;
  preferredLength: number;
  practicality: number;
  evidencePreference: number;
  readingPace: number;
};

export type FitAnalysis = {
  score: number;
  reasons: string[];
  strengths: string[];
  drawbacks: string[];
  readingCommitment: string;
  componentScores: { interests: number; difficulty: number; length: number; practicality: number; evidence: number };
};

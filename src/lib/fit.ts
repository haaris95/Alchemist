import type { Book, FitAnalysis, ReadingProfile } from "./types";

export const initialProfile: ReadingProfile = {
  name: "Maya",
  interests: ["psychology", "history", "technology", "society", "decision making"],
  preferredDifficulty: 3,
  preferredLength: 360,
  practicality: 78,
  evidencePreference: 82,
  readingPace: 25,
};

const percentage = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function analyzeBookFit(book: Book, profile: ReadingProfile = initialProfile): FitAnalysis {
  const overlap = book.themes.filter((theme) => profile.interests.includes(theme)).length;
  const interests = percentage((overlap / Math.max(book.themes.length, 1)) * 100);
  const difficulty = percentage(100 - Math.abs(book.difficulty - profile.preferredDifficulty) * 25);
  const length = percentage(100 - Math.max(0, book.pages - profile.preferredLength) / 4 - Math.max(0, profile.preferredLength - book.pages) / 10);
  const practicality = percentage(100 - Math.abs(book.practicality - profile.practicality));
  const evidence = percentage(100 - Math.abs(book.evidenceScore - profile.evidencePreference));
  const score = Math.round(interests * .30 + difficulty * .18 + length * .16 + practicality * .19 + evidence * .17);

  const reasons = [
    overlap ? `It intersects with ${overlap === 1 ? "one" : overlap} of your core interests: ${book.themes.filter((theme) => profile.interests.includes(theme)).join(", ")}.` : "It introduces a perspective outside your usual interest areas.",
    `Its ${book.difficulty}/5 difficulty is ${Math.abs(book.difficulty - profile.preferredDifficulty) <= 1 ? "within" : "outside"} your preferred challenge range.`,
  ];
  const strengths = [
    book.practicality >= profile.practicality ? "More actionable than your stated practicality baseline." : "A reflective counterweight to more tactical reading.",
    book.evidenceScore >= profile.evidencePreference ? "Its evidence-led approach matches your preference." : "Useful for ideas and perspective, with a lighter evidence base.",
  ];
  const drawbacks = [
    book.pages > profile.preferredLength ? `At ${book.pages} pages, it is ${book.pages - profile.preferredLength} pages longer than your sweet spot.` : "Its length should fit comfortably into your current rhythm.",
    book.difficulty > profile.preferredDifficulty ? "Expect denser passages than your typical pick." : book.difficulty < profile.preferredDifficulty ? "It may feel less intellectually demanding than you want." : "Its challenge level is right on your stated preference.",
  ];
  const days = Math.ceil(book.pages / profile.readingPace);
  return { score, reasons, strengths, drawbacks, readingCommitment: `About ${days} days at ${profile.readingPace} pages/day`, componentScores: { interests, difficulty, length, practicality, evidence } };
}

export function similarBooks(book: Book, catalog: Book[]) {
  return catalog
    .filter((candidate) => candidate.id !== book.id)
    .map((candidate) => ({ book: candidate, similarity: candidate.themes.filter((theme) => book.themes.includes(theme)).length * 30 + (5 - Math.abs(candidate.difficulty - book.difficulty)) * 6 + (5 - Math.min(5, Math.abs(candidate.pages - book.pages) / 100)) * 3 }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map(({ book: candidate }) => candidate);
}

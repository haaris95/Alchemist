import type { Book } from "./types";

type Seed = Omit<Book, "id" | "description" | "coverImage"> & { id: string; description?: string };

const cover = "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=85";

const seed: Seed[] = [
  { id: "sapiens", title: "Sapiens", author: "Yuval Noah Harari", genre: "History", pages: 498, difficulty: 3, practicality: 36, evidenceScore: 68, themes: ["history", "society", "anthropology"] },
  { id: "thinking-fast-and-slow", title: "Thinking, Fast and Slow", author: "Daniel Kahneman", genre: "Psychology", pages: 499, difficulty: 4, practicality: 58, evidenceScore: 94, themes: ["psychology", "decision making", "behavior"] },
  { id: "atomic-habits", title: "Atomic Habits", author: "James Clear", genre: "Self-development", pages: 320, difficulty: 2, practicality: 96, evidenceScore: 67, themes: ["behavior", "habits", "productivity"] },
  { id: "deep-work", title: "Deep Work", author: "Cal Newport", genre: "Productivity", pages: 304, difficulty: 2, practicality: 91, evidenceScore: 65, themes: ["productivity", "technology", "focus"] },
  { id: "range", title: "Range", author: "David Epstein", genre: "Psychology", pages: 352, difficulty: 3, practicality: 68, evidenceScore: 78, themes: ["learning", "psychology", "performance"] },
  { id: "factfulness", title: "Factfulness", author: "Hans Rosling", genre: "Science", pages: 352, difficulty: 2, practicality: 76, evidenceScore: 91, themes: ["society", "data", "decision making"] },
  { id: "righteous-mind", title: "The Righteous Mind", author: "Jonathan Haidt", genre: "Psychology", pages: 528, difficulty: 4, practicality: 52, evidenceScore: 88, themes: ["psychology", "society", "politics"] },
  { id: "noise", title: "Noise", author: "Daniel Kahneman, Olivier Sibony & Cass Sunstein", genre: "Psychology", pages: 464, difficulty: 4, practicality: 70, evidenceScore: 92, themes: ["decision making", "psychology", "data"] },
  { id: "how-minds-change", title: "How Minds Change", author: "David McRaney", genre: "Psychology", pages: 352, difficulty: 3, practicality: 74, evidenceScore: 77, themes: ["psychology", "behavior", "society"] },
  { id: "scout-mindset", title: "The Scout Mindset", author: "Julia Galef", genre: "Psychology", pages: 288, difficulty: 3, practicality: 84, evidenceScore: 78, themes: ["decision making", "psychology", "behavior"] },
  { id: "signal-noise", title: "The Signal and the Noise", author: "Nate Silver", genre: "Data", pages: 544, difficulty: 4, practicality: 65, evidenceScore: 83, themes: ["data", "decision making", "society"] },
  { id: "black-swan", title: "The Black Swan", author: "Nassim Nicholas Taleb", genre: "Economics", pages: 444, difficulty: 5, practicality: 55, evidenceScore: 70, themes: ["decision making", "economics", "risk"] },
  { id: "antifragile", title: "Antifragile", author: "Nassim Nicholas Taleb", genre: "Economics", pages: 544, difficulty: 5, practicality: 66, evidenceScore: 62, themes: ["risk", "economics", "decision making"] },
  { id: "psychology-money", title: "The Psychology of Money", author: "Morgan Housel", genre: "Finance", pages: 256, difficulty: 2, practicality: 87, evidenceScore: 64, themes: ["behavior", "economics", "decision making"] },
  { id: "four-thousand-weeks", title: "Four Thousand Weeks", author: "Oliver Burkeman", genre: "Productivity", pages: 288, difficulty: 2, practicality: 73, evidenceScore: 60, themes: ["productivity", "philosophy", "behavior"] },
  { id: "meditations", title: "Meditations", author: "Marcus Aurelius", genre: "Philosophy", pages: 256, difficulty: 3, practicality: 72, evidenceScore: 32, themes: ["philosophy", "behavior", "resilience"] },
  { id: "mans-search", title: "Man's Search for Meaning", author: "Viktor E. Frankl", genre: "Psychology", pages: 184, difficulty: 3, practicality: 60, evidenceScore: 49, themes: ["psychology", "philosophy", "resilience"] },
  { id: "tomorrow-world", title: "The World Tomorrow", author: "Yuval Noah Harari", genre: "Society", pages: 320, difficulty: 3, practicality: 42, evidenceScore: 58, themes: ["technology", "society", "history"] },
  { id: "bad-blood", title: "Bad Blood", author: "John Carreyrou", genre: "Business", pages: 352, difficulty: 2, practicality: 58, evidenceScore: 86, themes: ["technology", "business", "society"] },
  { id: "say-nothing", title: "Say Nothing", author: "Patrick Radden Keefe", genre: "History", pages: 528, difficulty: 4, practicality: 37, evidenceScore: 89, themes: ["history", "society", "politics"] },
  { id: "educated", title: "Educated", author: "Tara Westover", genre: "Memoir", pages: 352, difficulty: 2, practicality: 48, evidenceScore: 52, themes: ["learning", "society", "resilience"] },
  { id: "warmth-of-other-suns", title: "The Warmth of Other Suns", author: "Isabel Wilkerson", genre: "History", pages: 640, difficulty: 4, practicality: 38, evidenceScore: 91, themes: ["history", "society", "race"] },
  { id: "caste", title: "Caste", author: "Isabel Wilkerson", genre: "History", pages: 496, difficulty: 4, practicality: 43, evidenceScore: 84, themes: ["society", "history", "race"] },
  { id: "dawn-of-everything", title: "The Dawn of Everything", author: "David Graeber & David Wengrow", genre: "History", pages: 704, difficulty: 5, practicality: 35, evidenceScore: 83, themes: ["history", "society", "anthropology"] },
  { id: "guns-germs-steel", title: "Guns, Germs, and Steel", author: "Jared Diamond", genre: "History", pages: 528, difficulty: 3, practicality: 37, evidenceScore: 63, themes: ["history", "society", "geography"] },
  { id: "weirdest-people", title: "The WEIRDest People in the World", author: "Joseph Henrich", genre: "Anthropology", pages: 704, difficulty: 5, practicality: 38, evidenceScore: 91, themes: ["psychology", "history", "society"] },
  { id: "gene", title: "The Gene", author: "Siddhartha Mukherjee", genre: "Science", pages: 608, difficulty: 4, practicality: 43, evidenceScore: 91, themes: ["science", "history", "health"] },
  { id: "emperor-maladies", title: "The Emperor of All Maladies", author: "Siddhartha Mukherjee", genre: "Science", pages: 608, difficulty: 4, practicality: 38, evidenceScore: 94, themes: ["science", "health", "history"] },
  { id: "why-we-sleep", title: "Why We Sleep", author: "Matthew Walker", genre: "Health", pages: 368, difficulty: 2, practicality: 88, evidenceScore: 62, themes: ["health", "science", "behavior"] },
  { id: "outlive", title: "Outlive", author: "Peter Attia", genre: "Health", pages: 496, difficulty: 3, practicality: 81, evidenceScore: 73, themes: ["health", "science", "behavior"] },
  { id: "breath", title: "Breath", author: "James Nestor", genre: "Health", pages: 304, difficulty: 2, practicality: 78, evidenceScore: 55, themes: ["health", "behavior", "science"] },
  { id: "body", title: "The Body", author: "Bill Bryson", genre: "Science", pages: 464, difficulty: 3, practicality: 54, evidenceScore: 85, themes: ["science", "health", "history"] },
  { id: "sixth-extinction", title: "The Sixth Extinction", author: "Elizabeth Kolbert", genre: "Science", pages: 336, difficulty: 3, practicality: 46, evidenceScore: 94, themes: ["science", "environment", "society"] },
  { id: "braiding-sweetgrass", title: "Braiding Sweetgrass", author: "Robin Wall Kimmerer", genre: "Nature", pages: 400, difficulty: 3, practicality: 51, evidenceScore: 57, themes: ["nature", "society", "philosophy"] },
  { id: "entangled-life", title: "Entangled Life", author: "Merlin Sheldrake", genre: "Science", pages: 368, difficulty: 3, practicality: 44, evidenceScore: 87, themes: ["science", "nature", "biology"] },
  { id: "under-white-sky", title: "Under a White Sky", author: "Elizabeth Kolbert", genre: "Science", pages: 272, difficulty: 3, practicality: 54, evidenceScore: 85, themes: ["science", "environment", "technology"] },
  { id: "chip-war", title: "Chip War", author: "Chris Miller", genre: "Technology", pages: 464, difficulty: 3, practicality: 57, evidenceScore: 89, themes: ["technology", "history", "society"] },
  { id: "innovators", title: "The Innovators", author: "Walter Isaacson", genre: "Technology", pages: 560, difficulty: 3, practicality: 49, evidenceScore: 82, themes: ["technology", "history", "business"] },
  { id: "code-breaker", title: "The Code Breaker", author: "Walter Isaacson", genre: "Technology", pages: 560, difficulty: 3, practicality: 48, evidenceScore: 82, themes: ["technology", "science", "biography"] },
  { id: "alignment-problem", title: "The Alignment Problem", author: "Brian Christian", genre: "Technology", pages: 496, difficulty: 4, practicality: 61, evidenceScore: 85, themes: ["technology", "ai", "society"] },
  { id: "life-3", title: "Life 3.0", author: "Max Tegmark", genre: "Technology", pages: 384, difficulty: 3, practicality: 51, evidenceScore: 70, themes: ["technology", "ai", "society"] },
  { id: "coming-wave", title: "The Coming Wave", author: "Mustafa Suleyman", genre: "Technology", pages: 352, difficulty: 3, practicality: 55, evidenceScore: 68, themes: ["technology", "ai", "society"] },
  { id: "creative-act", title: "The Creative Act", author: "Rick Rubin", genre: "Creativity", pages: 432, difficulty: 2, practicality: 70, evidenceScore: 35, themes: ["creativity", "behavior", "art"] },
  { id: "war-of-art", title: "The War of Art", author: "Steven Pressfield", genre: "Creativity", pages: 190, difficulty: 2, practicality: 78, evidenceScore: 30, themes: ["creativity", "behavior", "productivity"] },
  { id: "on-writing-well", title: "On Writing Well", author: "William Zinsser", genre: "Writing", pages: 336, difficulty: 2, practicality: 92, evidenceScore: 56, themes: ["writing", "communication", "creativity"] },
  { id: "design-everyday", title: "The Design of Everyday Things", author: "Don Norman", genre: "Design", pages: 368, difficulty: 3, practicality: 87, evidenceScore: 76, themes: ["design", "psychology", "technology"] },
  { id: "hooked", title: "Hooked", author: "Nir Eyal", genre: "Business", pages: 256, difficulty: 2, practicality: 79, evidenceScore: 48, themes: ["behavior", "business", "technology"] },
  { id: "mom-test", title: "The Mom Test", author: "Rob Fitzpatrick", genre: "Business", pages: 136, difficulty: 2, practicality: 96, evidenceScore: 60, themes: ["business", "communication", "productivity"] },
  { id: "lean-startup", title: "The Lean Startup", author: "Eric Ries", genre: "Business", pages: 336, difficulty: 2, practicality: 88, evidenceScore: 57, themes: ["business", "productivity", "technology"] },
  { id: "good-strategy", title: "Good Strategy Bad Strategy", author: "Richard Rumelt", genre: "Business", pages: 336, difficulty: 3, practicality: 91, evidenceScore: 72, themes: ["business", "decision making", "strategy"] },
  { id: "high-output", title: "High Output Management", author: "Andrew Grove", genre: "Business", pages: 272, difficulty: 3, practicality: 93, evidenceScore: 55, themes: ["business", "management", "productivity"] },
  { id: "effective-executive", title: "The Effective Executive", author: "Peter Drucker", genre: "Business", pages: 208, difficulty: 3, practicality: 89, evidenceScore: 52, themes: ["business", "management", "productivity"] },
  { id: "making-manager", title: "The Making of a Manager", author: "Julie Zhuo", genre: "Business", pages: 288, difficulty: 2, practicality: 89, evidenceScore: 56, themes: ["business", "management", "communication"] },
  { id: "wright-brothers", title: "The Wright Brothers", author: "David McCullough", genre: "History", pages: 336, difficulty: 2, practicality: 39, evidenceScore: 86, themes: ["history", "technology", "biography"] },
  { id: "ride-lifetime", title: "The Ride of a Lifetime", author: "Robert Iger", genre: "Business", pages: 272, difficulty: 2, practicality: 73, evidenceScore: 42, themes: ["business", "leadership", "creativity"] },
  { id: "philosophy-walking", title: "A Philosophy of Walking", author: "Frédéric Gros", genre: "Philosophy", pages: 272, difficulty: 3, practicality: 45, evidenceScore: 39, themes: ["philosophy", "nature", "health"] },
  { id: "power-of-habit", title: "The Power of Habit", author: "Charles Duhigg", genre: "Psychology", pages: 400, difficulty: 2, practicality: 86, evidenceScore: 68, themes: ["habits", "behavior", "psychology"] },
  { id: "nudge", title: "Nudge", author: "Richard Thaler & Cass Sunstein", genre: "Behavioral economics", pages: 320, difficulty: 3, practicality: 83, evidenceScore: 82, themes: ["behavior", "decision making", "society"] },
  { id: "invisible-women", title: "Invisible Women", author: "Caroline Criado Perez", genre: "Data", pages: 432, difficulty: 3, practicality: 58, evidenceScore: 89, themes: ["data", "society", "design"] },
  { id: "order-time", title: "Order of Time", author: "Carlo Rovelli", genre: "Science", pages: 256, difficulty: 4, practicality: 28, evidenceScore: 84, themes: ["science", "philosophy", "physics"] }
];

export const books: Book[] = seed.map((book) => ({
  ...book,
  description: book.description ?? `${book.title} explores ${book.themes.join(", ")} through a ${book.genre.toLowerCase()} lens.`,
  coverImage: cover,
}));

export function getBook(id: string) { return books.find((book) => book.id === id); }

export function searchBooks(query = "", maxPages?: number, minPracticality?: number) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return books.filter((book) => {
    const haystack = [book.title, book.author, book.genre, ...book.themes].join(" ").toLowerCase();
    return terms.every((term) => haystack.includes(term)) &&
      (maxPages === undefined || book.pages <= maxPages) &&
      (minPracticality === undefined || book.practicality >= minPracticality);
  });
}

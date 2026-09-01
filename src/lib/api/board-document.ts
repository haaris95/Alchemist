import type { BoardState } from "@/lib/board";

export function isBoardDocument(value: unknown): value is BoardState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Partial<BoardState>;
  return typeof document.title === "string"
    && (document.description === undefined || (typeof document.description === "string" && document.description.length <= 900))
    && Array.isArray(document.members)
    && Array.isArray(document.notes)
    && Array.isArray(document.connections)
    && Array.isArray(document.clusters)
    && Array.isArray(document.strokes)
    && Array.isArray(document.activity)
    && (document.webmcpActivity === undefined || Array.isArray(document.webmcpActivity));
}

export function safeBoardTitle(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 140) : "";
}

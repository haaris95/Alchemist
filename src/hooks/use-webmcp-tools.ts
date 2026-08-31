"use client";

import { useEffect } from "react";
import type { StickyColor } from "@/lib/board";

type Point = { x: number; y: number };
type NoteUpdate = { noteId: string; text?: string; color?: StickyColor; x?: number; y?: number };

type ToolCallbacks = {
  onGetBoard: () => unknown;
  onCreateSession: (input: { title: string }) => unknown;
  onCreateNote: (input: { text: string; color?: StickyColor; x?: number; y?: number }) => unknown;
  onMoveNote: (input: { noteId: string; x: number; y: number }) => unknown;
  onUpdateNote: (input: NoteUpdate) => unknown;
  onDeleteNote: (input: { noteId: string }) => unknown;
  onAddComment: (input: { noteId: string; text: string }) => unknown;
  onCreateConnection: (input: { fromId: string; toId: string; label?: string }) => unknown;
  onUpdateConnection: (input: { connectionId: string; label?: string }) => unknown;
  onDeleteConnection: (input: { connectionId: string }) => unknown;
  onDrawStroke: (input: { points: Point[]; color?: string; width?: number }) => unknown;
  onPitchIn: (signal: AbortSignal) => Promise<unknown>;
  onStatus: (status: "ready" | "unavailable") => void;
};

const schemaBase = { type: "object", additionalProperties: false } as const;
const colorSchema = { type: "string", enum: ["sun", "rose", "mint", "lavender"], description: "Optional sticky-note color." };
const positionSchema = {
  x: { type: "number", minimum: 18, maximum: 970, description: "Horizontal canvas coordinate." },
  y: { type: "number", minimum: 48, maximum: 570, description: "Vertical canvas coordinate." },
};

function requiredText(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${key} must be a non-empty string`);
  return value.trim();
}

function optionalText(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new TypeError(`${key} must be a string`);
  return value.trim();
}

function requiredNumber(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${key} must be a finite number`);
  return value;
}

function optionalNumber(input: Record<string, unknown>, key: string) {
  return input[key] === undefined ? undefined : requiredNumber(input, key);
}

function optionalColor(input: Record<string, unknown>): StickyColor | undefined {
  const color = input.color;
  if (color === undefined) return undefined;
  if (color !== "sun" && color !== "rose" && color !== "mint" && color !== "lavender") throw new TypeError("color must be a supported sticky-note color");
  return color;
}

function requiredPoints(input: Record<string, unknown>) {
  const rawPoints = input.points;
  if (!Array.isArray(rawPoints) || rawPoints.length < 2) throw new TypeError("points must contain at least two canvas points");
  return rawPoints.map((rawPoint, index) => {
    if (!rawPoint || typeof rawPoint !== "object" || Array.isArray(rawPoint)) throw new TypeError(`points[${index}] must be an object`);
    const point = rawPoint as Record<string, unknown>;
    return { x: requiredNumber(point, "x"), y: requiredNumber(point, "y") };
  });
}

export function useWebMCPTools(callbacks: ToolCallbacks) {
  const {
    onGetBoard, onCreateSession, onCreateNote, onMoveNote, onUpdateNote, onDeleteNote, onAddComment,
    onCreateConnection, onUpdateConnection, onDeleteConnection, onDrawStroke, onPitchIn, onStatus,
  } = callbacks;

  useEffect(() => {
    if (!window.isSecureContext || !document.modelContext) {
      onStatus("unavailable");
      return;
    }

    const controller = new AbortController();
    const registration = Promise.all([
      document.modelContext.registerTool({
        name: "get_board", title: "Inspect the AIchemist board",
        description: "Return the current AIchemist board: session title, notes, authors, positions, connections, sketches, clusters, and comment counts. Use this before contributing.",
        inputSchema: { ...schemaBase, properties: {} }, annotations: { readOnlyHint: true }, execute: () => onGetBoard(),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: "create_session", title: "Start a blank AIchemist session",
        description: "Replace the current local board with a blank named session. Use only when the user asks to begin a new session.",
        inputSchema: { ...schemaBase, properties: { title: { type: "string", minLength: 3, maxLength: 140, description: "The session question or title." } }, required: ["title"] }, annotations: { readOnlyHint: false },
        execute: (input) => onCreateSession({ title: requiredText(input, "title") }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: "create_note", title: "Add an AIchemist sticky note",
        description: "Create a new sticky note on the shared board as AIchemist. It visibly updates the canvas and activity feed.",
        inputSchema: { ...schemaBase, properties: { text: { type: "string", minLength: 3, maxLength: 280, description: "The idea, question, or challenge to add." }, color: colorSchema, ...positionSchema }, required: ["text"] }, annotations: { readOnlyHint: false },
        execute: (input) => onCreateNote({ text: requiredText(input, "text"), color: optionalColor(input), x: optionalNumber(input, "x"), y: optionalNumber(input, "y") }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: "move_note", title: "Move a sticky note",
        description: "Move an existing note to a new position on the shared canvas. Use note IDs returned by get_board.",
        inputSchema: { ...schemaBase, properties: { noteId: { type: "string", description: "ID of the note to move." }, ...positionSchema }, required: ["noteId", "x", "y"] }, annotations: { readOnlyHint: false },
        execute: (input) => onMoveNote({ noteId: requiredText(input, "noteId"), x: requiredNumber(input, "x"), y: requiredNumber(input, "y") }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: "update_note", title: "Edit a sticky note",
        description: "Update an existing note's text, color, or canvas position. Provide at least one field to change and use a note ID from get_board.",
        inputSchema: { ...schemaBase, properties: { noteId: { type: "string", description: "ID of the note to update." }, text: { type: "string", minLength: 3, maxLength: 280, description: "Replacement note text." }, color: colorSchema, ...positionSchema }, required: ["noteId"] }, annotations: { readOnlyHint: false },
        execute: (input) => {
          const result: NoteUpdate = { noteId: requiredText(input, "noteId"), text: optionalText(input, "text"), color: optionalColor(input), x: optionalNumber(input, "x"), y: optionalNumber(input, "y") };
          if (result.text === undefined && result.color === undefined && result.x === undefined && result.y === undefined) throw new TypeError("update_note needs at least one field to change");
          return onUpdateNote(result);
        },
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: "delete_note", title: "Delete a sticky note",
        description: "Remove a note and its related connections from the shared board. Use only when the user asks to remove the idea.",
        inputSchema: { ...schemaBase, properties: { noteId: { type: "string", description: "ID of the note to remove." } }, required: ["noteId"] }, annotations: { readOnlyHint: false },
        execute: (input) => onDeleteNote({ noteId: requiredText(input, "noteId") }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: "add_comment", title: "Comment on a board idea",
        description: "Add an AIchemist comment to an existing sticky note. The comment appears in the note's focus panel and activity feed.",
        inputSchema: { ...schemaBase, properties: { noteId: { type: "string", description: "ID of the note to comment on." }, text: { type: "string", minLength: 1, maxLength: 500, description: "Comment text." } }, required: ["noteId", "text"] }, annotations: { readOnlyHint: false },
        execute: (input) => onAddComment({ noteId: requiredText(input, "noteId"), text: requiredText(input, "text") }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: "create_connection", title: "Connect two board ideas",
        description: "Create a directed relationship between two existing notes. The connector appears on the shared canvas and records AIchemist's action.",
        inputSchema: { ...schemaBase, properties: { fromId: { type: "string", description: "ID of the source note." }, toId: { type: "string", description: "ID of the destination note." }, label: { type: "string", maxLength: 50, description: "Optional relationship label." } }, required: ["fromId", "toId"] }, annotations: { readOnlyHint: false },
        execute: (input) => onCreateConnection({ fromId: requiredText(input, "fromId"), toId: requiredText(input, "toId"), label: optionalText(input, "label") }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: "update_connection", title: "Edit a connection label",
        description: "Update or clear the label on an existing connection. Use an ID from get_board.",
        inputSchema: { ...schemaBase, properties: { connectionId: { type: "string", description: "ID of the connection to update." }, label: { type: "string", maxLength: 50, description: "New label; an empty string clears it." } }, required: ["connectionId", "label"] }, annotations: { readOnlyHint: false },
        execute: (input) => onUpdateConnection({ connectionId: requiredText(input, "connectionId"), label: optionalText(input, "label") }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: "delete_connection", title: "Delete a connection",
        description: "Remove a relationship line from the shared board. Use only when the user asks to remove that connection.",
        inputSchema: { ...schemaBase, properties: { connectionId: { type: "string", description: "ID of the connection to remove." } }, required: ["connectionId"] }, annotations: { readOnlyHint: false },
        execute: (input) => onDeleteConnection({ connectionId: requiredText(input, "connectionId") }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: "draw_stroke", title: "Draw on the shared canvas",
        description: "Add a freehand AIchemist sketch to the canvas. Points use the same canvas coordinate system as notes.",
        inputSchema: { ...schemaBase, properties: { points: { type: "array", minItems: 2, items: { type: "object", additionalProperties: false, properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "At least two ordered canvas points." }, color: { type: "string", description: "Optional CSS color for the stroke." }, width: { type: "number", minimum: 1, maximum: 12, description: "Optional stroke width." } }, required: ["points"] }, annotations: { readOnlyHint: false },
        execute: (input) => onDrawStroke({ points: requiredPoints(input), color: optionalText(input, "color"), width: optionalNumber(input, "width") }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: "pitch_in", title: "Let AIchemist pitch in",
        description: "Examine the current shared board, identify a productive assumption or gap, then add one meaningful AIchemist note and connect it to relevant ideas.",
        inputSchema: { ...schemaBase, properties: {} }, annotations: { readOnlyHint: false },
        execute: (_input, options) => onPitchIn(options?.signal ?? new AbortController().signal),
      }, { signal: controller.signal }),
    ]);

    void registration.then(() => onStatus("ready")).catch((error: unknown) => {
      if (!controller.signal.aborted) { console.warn("AIchemist WebMCP registration failed", error); onStatus("unavailable"); }
    });
    return () => controller.abort();
  }, [onAddComment, onCreateConnection, onCreateNote, onCreateSession, onDeleteConnection, onDeleteNote, onDrawStroke, onGetBoard, onMoveNote, onPitchIn, onStatus, onUpdateConnection, onUpdateNote]);
}

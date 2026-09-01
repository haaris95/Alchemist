/** A human's Supabase user id, a local-preview id, or the reserved AI member id. */
export type MemberId = string;
export type StickyColor = "sun" | "rose" | "mint" | "lavender";

export type BoardMember = {
  id: MemberId;
  name: string;
  initials: string;
  role: "Human" | "AI teammate";
  color: string;
};

export type BoardNote = {
  id: string;
  text: string;
  authorId: MemberId;
  color: StickyColor;
  x: number;
  y: number;
  comments: string[];
  createdAt: string;
};

export type BoardConnection = {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  authorId: MemberId;
};

export type BoardCluster = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BoardStroke = {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  authorId: MemberId;
};

export type DiagramTemplate = "flow" | "comparison" | "tradeoff";
export type DiagramNodeInput = { label: string; color?: StickyColor };
export type DiagramEdgeInput = { from: number; to: number; label?: string };
export type DiagramInput = { template: DiagramTemplate; title: string; nodes: DiagramNodeInput[]; edges?: DiagramEdgeInput[]; authorId?: MemberId };

export type ActivityEvent = {
  id: string;
  actorId: MemberId;
  message: string;
  timestamp: string;
};

export type WebMCPActivity = {
  id: string;
  tool: string;
  detail: string;
  timestamp: string;
  /** Missing on sessions saved before source-aware tool tracing shipped. */
  source?: "webmcp" | "in-app";
};

export type BoardState = {
  title: string;
  description: string;
  members: BoardMember[];
  notes: BoardNote[];
  connections: BoardConnection[];
  clusters: BoardCluster[];
  strokes: BoardStroke[];
  activity: ActivityEvent[];
  webmcpActivity: WebMCPActivity[];
  aiStatus: "active" | "thinking";
  aiAutonomy: boolean;
};

const STORAGE_KEY = "aichemist-board-v1";

const defaultMembers: BoardMember[] = [
  { id: "haaris", name: "Haaris", initials: "H", role: "Human", color: "#f4b860" },
  { id: "sarah", name: "Sarah", initials: "S", role: "Human", color: "#8fa7ee" },
  { id: "aichemist", name: "AIchemist", initials: "✦", role: "AI teammate", color: "#a78bfa" },
];

const blankSessionMembers = defaultMembers.filter((member) => member.id !== "sarah");

function clock() {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date());
}

function newBoard(): BoardState {
  return {
    title: "How might we reduce food waste?",
    description: "Explore practical ways restaurants and communities can prevent edible food from becoming waste.",
    members: defaultMembers.map((member) => ({ ...member })),
    notes: [
      {
        id: "restaurant-surplus",
        text: "Restaurants throw away food at the end of the day.",
        authorId: "haaris",
        color: "sun",
        x: 108,
        y: 142,
        comments: ["How much is predictable versus unexpected?"],
        createdAt: "10:42 AM",
      },
      {
        id: "discount-marketplace",
        text: "Restaurants could sell surplus food cheaply.",
        authorId: "sarah",
        color: "rose",
        x: 392,
        y: 280,
        comments: [],
        createdAt: "10:44 AM",
      },
      {
        id: "community-fridges",
        text: "Could surplus move to community fridges before it expires?",
        authorId: "haaris",
        color: "mint",
        x: 725,
        y: 138,
        comments: [],
        createdAt: "10:47 AM",
      },
    ],
    connections: [
      { id: "surplus-to-market", fromId: "restaurant-surplus", toId: "discount-marketplace", label: "surplus supply", authorId: "sarah" },
      { id: "surplus-to-fridge", fromId: "restaurant-surplus", toId: "community-fridges", label: "redistribute", authorId: "haaris" },
    ],
    clusters: [{ id: "surplus-recovery", label: "Surplus recovery", x: 42, y: 72, width: 930, height: 390 }],
    strokes: [],
    activity: [
      { id: "activity-community", actorId: "haaris", message: 'added “Community fridges”', timestamp: "10:47 AM" },
      { id: "activity-market", actorId: "sarah", message: 'added “Discount marketplace”', timestamp: "10:44 AM" },
      { id: "activity-surplus", actorId: "haaris", message: 'added “Restaurant surplus”', timestamp: "10:42 AM" },
    ],
    webmcpActivity: [],
    aiStatus: "active",
    aiAutonomy: true,
  };
}

function fallbackHuman(memberId: MemberId): BoardMember {
  return { id: memberId, name: "You", initials: "Y", role: "Human", color: "#f4b860" };
}

export function createBlankBoard(title: string, actor: BoardMember = defaultMembers[0], description = ""): BoardState {
  return {
    title: title.trim() || "Untitled brainstorm",
    description: description.trim().slice(0, 900),
    members: [
      { ...actor, role: "Human" },
      ...blankSessionMembers.filter((member) => member.id === "aichemist").map((member) => ({ ...member })),
    ],
    notes: [],
    connections: [],
    clusters: [],
    strokes: [],
    activity: [{ id: `activity-session-${Date.now()}-${Math.round(Math.random() * 1000)}`, actorId: actor.id, message: "started a new blank session", timestamp: clock() }],
    webmcpActivity: [],
    aiStatus: "active",
    aiAutonomy: true,
  };
}

const serverSnapshot = newBoard();
let board = serverSnapshot;
let hydrated = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function persist() {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
}

function commit(next: BoardState, shouldPersist = true) {
  board = next;
  if (shouldPersist) persist();
  notify();
}

function member(memberId: MemberId) {
  return board.members.find((item) => item.id === memberId) ?? fallbackHuman(memberId);
}

function activity(actorId: MemberId, message: string): ActivityEvent {
  return { id: `activity-${Date.now()}-${Math.round(Math.random() * 1000)}`, actorId, message, timestamp: clock() };
}

function inferredAiToolActivity(document: Pick<BoardState, "notes" | "connections" | "strokes">): WebMCPActivity[] {
  const notes = document.notes.filter((note) => note.authorId === "aichemist").map((note) => ({
    id: "inferred-note-" + note.id,
    tool: "create_note",
    detail: "AIchemist added a sticky note before tool tracing was enabled.",
    timestamp: note.createdAt,
    source: "in-app" as const,
  }));
  const connections = document.connections.filter((connection) => connection.authorId === "aichemist").map((connection) => ({
    id: "inferred-connection-" + connection.id,
    tool: "create_connection",
    detail: "AIchemist connected two board ideas before tool tracing was enabled.",
    timestamp: "Earlier",
    source: "in-app" as const,
  }));
  const strokes = document.strokes.filter((stroke) => stroke.authorId === "aichemist").map((stroke) => ({
    id: "inferred-stroke-" + stroke.id,
    tool: "draw_stroke",
    detail: "AIchemist drew on the board before tool tracing was enabled.",
    timestamp: "Earlier",
    source: "in-app" as const,
  }));
  return [...notes, ...connections, ...strokes].slice(0, 30);
}

function noteLabel(note: BoardNote | undefined) {
  return note ? `“${note.text.length > 31 ? `${note.text.slice(0, 31)}…` : note.text}”` : "a note";
}

function nextPosition() {
  const index = board.notes.length;
  return { x: 100 + (index % 4) * 220, y: 470 + (Math.floor(index / 4) % 2) * 34 };
}

function diagramPositions(template: DiagramTemplate, count: number) {
  const flow = [{ x: 85, y: 275 }, { x: 345, y: 275 }, { x: 605, y: 275 }, { x: 850, y: 275 }];
  if (template === "flow") return flow.slice(0, count);
  if (template === "comparison") {
    const positions = count === 2
      ? [{ x: 165, y: 275 }, { x: 695, y: 275 }]
      : [{ x: 90, y: 275 }, { x: 430, y: 155 }, { x: 770, y: 275 }, { x: 430, y: 410 }];
    return positions.slice(0, count);
  }
  const positions = count === 2
    ? [{ x: 205, y: 180 }, { x: 655, y: 395 }]
    : [{ x: 430, y: 130 }, { x: 150, y: 390 }, { x: 710, y: 390 }, { x: 430, y: 500 }];
  return positions.slice(0, count);
}

export const boardStore = {
  getSnapshot: () => board,
  getServerSnapshot: () => serverSnapshot,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  hydrate() {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<BoardState>;
        if (Array.isArray(parsed.notes) && Array.isArray(parsed.connections) && Array.isArray(parsed.activity)) {
          board = {
            ...newBoard(),
            ...parsed,
            members: Array.isArray(parsed.members) ? parsed.members : defaultMembers,
            strokes: Array.isArray(parsed.strokes) ? parsed.strokes : [],
            webmcpActivity: Array.isArray(parsed.webmcpActivity) && parsed.webmcpActivity.length ? parsed.webmcpActivity : inferredAiToolActivity({ ...newBoard(), ...parsed }),
            aiStatus: "active",
          };
          notify();
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },
  replaceDocument(document: BoardState) {
    const next = {
      ...newBoard(),
      ...document,
      description: typeof document.description === "string" ? document.description.trim().slice(0, 900) : "",
      members: Array.isArray(document.members) ? document.members : defaultMembers,
      notes: Array.isArray(document.notes) ? document.notes : [],
      connections: Array.isArray(document.connections) ? document.connections : [],
      clusters: Array.isArray(document.clusters) ? document.clusters : [],
      strokes: Array.isArray(document.strokes) ? document.strokes : [],
      activity: Array.isArray(document.activity) ? document.activity : [],
      webmcpActivity: Array.isArray(document.webmcpActivity) && document.webmcpActivity.length ? document.webmcpActivity : inferredAiToolActivity(document),
      // "thinking" is transient UI state and must never get stuck for collaborators.
      aiStatus: "active" as const,
      aiAutonomy: typeof document.aiAutonomy === "boolean" ? document.aiAutonomy : true,
    };
    commit(next, false);
  },
  documentForPersistence(): BoardState {
    return { ...board, aiStatus: "active" };
  },
  reset() {
    commit(newBoard());
  },
  createSession(title: string, authorId: MemberId = "haaris", description = "") {
    const currentHuman = board.members.find((item) => item.id === authorId) ?? fallbackHuman(authorId);
    commit(createBlankBoard(title, currentHuman, description));
  },
  setCurrentUser(name: string, memberId: MemberId = "haaris") {
    const trimmed = name.trim();
    if (!trimmed) return;
    const initials = trimmed.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    const existing = board.members.find((item) => item.id === memberId);
    const currentUser: BoardMember = existing
      ? { ...existing, name: trimmed, initials, role: "Human" }
      : { id: memberId, name: trimmed, initials, role: "Human", color: "#f4b860" };
    commit({
      ...board,
      members: existing
        ? board.members.map((item) => item.id === memberId ? currentUser : item)
        : [currentUser, ...board.members],
    });
  },
  setAiStatus(status: BoardState["aiStatus"]) {
    commit({ ...board, aiStatus: status }, false);
  },
  setAiAutonomy(enabled: boolean) {
    commit({ ...board, aiAutonomy: enabled });
  },
  recordWebMCPTool(tool: string, detail: string, source: "webmcp" | "in-app" = "webmcp") {
    const entry: WebMCPActivity = {
      id: `webmcp-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      tool: tool.trim().slice(0, 80) || "unknown_tool",
      detail: detail.trim().slice(0, 180) || "Completed a WebMCP action.",
      timestamp: clock(),
      source,
    };
    commit({ ...board, webmcpActivity: [entry, ...board.webmcpActivity].slice(0, 30) });
    return entry;
  },
  createNote(input: { id?: string; text: string; authorId?: MemberId; color?: StickyColor; x?: number; y?: number }) {
    const text = input.text.trim();
    if (text.length < 3) throw new Error("A sticky note needs at least 3 characters.");
    const position = nextPosition();
    const note: BoardNote = {
      id: input.id ?? `note-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      text,
      authorId: input.authorId ?? "haaris",
      color: input.color ?? "sun",
      x: Math.round(input.x ?? position.x),
      y: Math.round(input.y ?? position.y),
      comments: [],
      createdAt: clock(),
    };
    const actor = member(note.authorId);
    commit({ ...board, notes: [...board.notes, note], activity: [activity(note.authorId, `added ${noteLabel(note)}`), ...board.activity].slice(0, 16) });
    return { note, actor };
  },
  createDiagram(input: DiagramInput) {
    const title = input.title.trim().slice(0, 80);
    if (!title || input.nodes.length < 2 || input.nodes.length > 4) throw new Error("A diagram needs a title and two to four labeled nodes.");
    const authorId = input.authorId ?? "aichemist";
    const palette: StickyColor[] = ["lavender", "mint", "sun", "rose"];
    const positions = diagramPositions(input.template, input.nodes.length);
    const seed = `${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const nodes = input.nodes.map((node, index): BoardNote => {
      const label = node.label.trim().slice(0, 120);
      if (label.length < 3) throw new Error("Every diagram node needs a label.");
      return {
        id: `diagram-node-${seed}-${index}`,
        text: label,
        authorId,
        color: node.color ?? palette[index % palette.length],
        x: positions[index].x,
        y: positions[index].y,
        comments: [],
        createdAt: clock(),
      };
    });
    const requestedEdges: DiagramEdgeInput[] = input.edges?.length ? input.edges : nodes.slice(1).map((_, index) => ({ from: index, to: index + 1 }));
    const connections: BoardConnection[] = requestedEdges.flatMap((edge, index) => {
      if (!Number.isInteger(edge.from) || !Number.isInteger(edge.to) || edge.from < 0 || edge.to < 0 || edge.from >= nodes.length || edge.to >= nodes.length || edge.from === edge.to) return [];
      return [{ id: `diagram-connection-${seed}-${index}`, fromId: nodes[edge.from].id, toId: nodes[edge.to].id, label: edge.label?.trim().slice(0, 50) || undefined, authorId }];
    });
    const cluster: BoardCluster = { id: `diagram-cluster-${seed}`, label: title, x: 42, y: 82, width: 1015, height: 525 };
    const templateLabel = input.template === "flow" ? "visual flow" : input.template === "comparison" ? "comparison map" : "trade-off map";
    commit({
      ...board,
      notes: [...board.notes, ...nodes],
      connections: [...board.connections, ...connections],
      clusters: [...board.clusters, cluster],
      activity: [activity(authorId, `created a ${templateLabel}`), ...board.activity].slice(0, 16),
    });
    return { cluster, nodes, connections };
  },
  moveNote(noteId: string, x: number, y: number) {
    const note = board.notes.find((item) => item.id === noteId);
    if (!note) throw new Error(`No board note found for ${noteId}.`);
    const boundedX = Math.max(18, Math.min(970, Math.round(x)));
    const boundedY = Math.max(48, Math.min(570, Math.round(y)));
    commit({ ...board, notes: board.notes.map((item) => item.id === noteId ? { ...item, x: boundedX, y: boundedY } : item) });
  },
  updateNote(input: { noteId: string; text?: string; color?: StickyColor; x?: number; y?: number; authorId?: MemberId }) {
    const note = board.notes.find((item) => item.id === input.noteId);
    if (!note) throw new Error(`No board note found for ${input.noteId}.`);
    const text = input.text === undefined ? note.text : input.text.trim();
    if (text.length < 3) throw new Error("A sticky note needs at least 3 characters.");
    const x = input.x === undefined ? note.x : Math.max(18, Math.min(970, Math.round(input.x)));
    const y = input.y === undefined ? note.y : Math.max(48, Math.min(570, Math.round(input.y)));
    const updatedNote = { ...note, text, color: input.color ?? note.color, x, y };
    const authorId = input.authorId ?? "aichemist";
    commit({
      ...board,
      notes: board.notes.map((item) => item.id === input.noteId ? updatedNote : item),
      activity: [activity(authorId, `updated ${noteLabel(updatedNote)}`), ...board.activity].slice(0, 16),
    });
    return updatedNote;
  },
  deleteNote(noteId: string, authorId: MemberId = "aichemist") {
    const note = board.notes.find((item) => item.id === noteId);
    if (!note) throw new Error(`No board note found for ${noteId}.`);
    commit({
      ...board,
      notes: board.notes.filter((item) => item.id !== noteId),
      connections: board.connections.filter((connection) => connection.fromId !== noteId && connection.toId !== noteId),
      activity: [activity(authorId, `removed ${noteLabel(note)} and its related connections`), ...board.activity].slice(0, 16),
    });
    return note;
  },
  createConnection(input: { fromId: string; toId: string; label?: string; authorId?: MemberId }) {
    if (input.fromId === input.toId) throw new Error("A connection needs two different notes.");
    const from = board.notes.find((item) => item.id === input.fromId);
    const to = board.notes.find((item) => item.id === input.toId);
    if (!from || !to) throw new Error("Both notes must exist before connecting them.");
    const existing = board.connections.find((connection) => connection.fromId === input.fromId && connection.toId === input.toId);
    if (existing) return { connection: existing, created: false };
    const authorId = input.authorId ?? "aichemist";
    const connection: BoardConnection = {
      id: `connection-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      fromId: input.fromId,
      toId: input.toId,
      label: input.label?.trim() || undefined,
      authorId,
    };
    commit({
      ...board,
      connections: [...board.connections, connection],
      activity: [activity(authorId, `connected ${noteLabel(from)} and ${noteLabel(to)}`), ...board.activity].slice(0, 16),
    });
    return { connection, created: true };
  },
  updateConnection(input: { connectionId: string; label?: string; authorId?: MemberId }) {
    const connection = board.connections.find((item) => item.id === input.connectionId);
    if (!connection) throw new Error(`No board connection found for ${input.connectionId}.`);
    const updatedConnection = { ...connection, label: input.label?.trim() || undefined };
    const authorId = input.authorId ?? "aichemist";
    commit({
      ...board,
      connections: board.connections.map((item) => item.id === input.connectionId ? updatedConnection : item),
      activity: [activity(authorId, "updated a connection label"), ...board.activity].slice(0, 16),
    });
    return updatedConnection;
  },
  deleteConnection(connectionId: string, authorId: MemberId = "aichemist") {
    const connection = board.connections.find((item) => item.id === connectionId);
    if (!connection) throw new Error(`No board connection found for ${connectionId}.`);
    commit({
      ...board,
      connections: board.connections.filter((item) => item.id !== connectionId),
      activity: [activity(authorId, "removed a connection from the board"), ...board.activity].slice(0, 16),
    });
    return connection;
  },
  addComment(noteId: string, text: string, authorId: MemberId = "haaris") {
    const comment = text.trim();
    const note = board.notes.find((item) => item.id === noteId);
    if (!note) throw new Error(`No board note found for ${noteId}.`);
    if (!comment) throw new Error("Write a comment before posting it.");
    const updatedNote = { ...note, comments: [...note.comments, comment] };
    commit({
      ...board,
      notes: board.notes.map((item) => item.id === noteId ? updatedNote : item),
      activity: [activity(authorId, `commented on ${noteLabel(note)}`), ...board.activity].slice(0, 16),
    });
    return updatedNote;
  },
  addStroke(input: { points: Array<{ x: number; y: number }>; color?: string; width?: number; authorId?: MemberId }) {
    if (input.points.length < 2) throw new Error("A drawing needs at least two points.");
    const stroke: BoardStroke = {
      id: `stroke-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      points: input.points.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) })),
      color: input.color ?? "#45405b",
      width: input.width ?? 3,
      authorId: input.authorId ?? "haaris",
    };
    commit({ ...board, strokes: [...board.strokes, stroke], activity: [activity(stroke.authorId, "added a sketch to the canvas"), ...board.activity].slice(0, 16) });
    return stroke;
  },
  pitchIn() {
    const humanNotes = board.notes.filter((note) => note.authorId !== "aichemist");
    const textForBoard = `${board.title} ${humanNotes.map((note) => note.text).join(" ")}`.toLowerCase();
    const foodWasteBoard = /food|surplus|restaurant|waste/.test(textForBoard);
    const priorPitch = board.notes.some((note) => note.authorId === "aichemist");
    const text = humanNotes.length === 0
      ? "Before we ideate, what outcome would make this session a success?"
      : foodWasteBoard && !priorPitch
        ? "What if we predicted tomorrow’s surplus before it happens?"
        : priorPitch
          ? "Which assumption should we test before committing to this direction?"
          : "What would have to be true for this idea to work at scale?";
    const response = this.createNote({
      text,
      authorId: "aichemist",
      color: "lavender",
      x: humanNotes.length > 2 ? 510 : 390,
      y: humanNotes.length > 2 ? 500 : 360,
    });
    const firstRelevant = humanNotes[0];
    const secondRelevant = humanNotes[1];
    const connections = [
      firstRelevant ? this.createConnection({ fromId: firstRelevant.id, toId: response.note.id, label: "AI observed", authorId: "aichemist" }) : null,
      secondRelevant ? this.createConnection({ fromId: response.note.id, toId: secondRelevant.id, label: "builds on", authorId: "aichemist" }) : null,
    ].filter((connection): connection is { connection: BoardConnection; created: boolean } => Boolean(connection));
    commit({ ...board, activity: [activity("aichemist", priorPitch ? "prompted the team to test an assumption" : "pitched in after noticing a productive gap"), ...board.activity].slice(0, 16) });
    return {
      note: response.note,
      connections: connections.map((item) => item.connection),
      insight: "AIchemist examined the current board and made a connected contribution.",
    };
  },
  boardForAgent() {
    return {
      title: board.title,
      description: board.description,
      members: board.members.map(({ id, name, role }) => ({ id, name, role })),
      notes: board.notes.map(({ id, text, authorId, x, y, comments }) => ({ id, text, author: member(authorId).name, position: { x, y }, comments: comments.length })),
      connections: board.connections.map(({ id, fromId, toId, label }) => ({ id, fromId, toId, label })),
      clusters: board.clusters.map(({ id, label, x, y, width, height }) => ({ id, label, bounds: { x, y, width, height } })),
      strokes: board.strokes.map(({ id, points, color, width, authorId }) => ({ id, points, color, width, author: member(authorId).name })),
    };
  },
};

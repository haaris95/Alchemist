"use client";

import { useEffect, useState } from "react";
import { boardStore, type BoardState } from "@/lib/board";
import { isBoardDocument } from "@/lib/api/board-document";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type BoardSyncStatus = "local" | "connecting" | "synced" | "saving" | "error";

/**
 * Persists the canvas document and listens for updates made by other room members.
 * A debounce keeps dragging/drawing smooth. Supabase is the durable source once a
 * board id is present; the original local board remains a no-configuration preview.
 */
export function useBoardPersistence(boardId?: string) {
  const [status, setStatus] = useState<BoardSyncStatus>(() => boardId && isSupabaseConfigured() ? "connecting" : "local");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId || !isSupabaseConfigured()) {
      return;
    }

    let disposed = false;
    let applyingRemote = false;
    let saveTimer: number | undefined;
    let lastRemote = "";
    const supabase = createSupabaseBrowserClient();

    function applyRemoteDocument(document: BoardState) {
      lastRemote = JSON.stringify(document);
      applyingRemote = true;
      boardStore.replaceDocument(document);
      applyingRemote = false;
      setStatus("synced");
      setError(null);
    }

    async function saveDocument() {
      if (disposed || applyingRemote) return;
      const document = boardStore.documentForPersistence();
      const fingerprint = JSON.stringify(document);
      if (fingerprint === lastRemote) return;
      setStatus("saving");
      try {
        const response = await fetch(`/api/boards/${boardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document, title: document.title }),
        });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "Could not save the board.");
        const savedDocument = body && typeof body === "object" && isBoardDocument((body as { board?: { document?: unknown } }).board?.document)
          ? (body as { board: { document: BoardState } }).board.document
          : document;
        lastRemote = JSON.stringify(savedDocument);
        if (!disposed) setStatus("synced");
      } catch (saveError) {
        if (!disposed) {
          setStatus("error");
          setError(saveError instanceof Error ? saveError.message : "Could not save the board.");
        }
      }
    }

    function scheduleSave() {
      if (disposed || applyingRemote) return;
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => void saveDocument(), 550);
    }

    const unsubscribe = boardStore.subscribe(scheduleSave);
    const channel = supabase
      .channel(`board-document:${boardId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "boards", filter: `id=eq.${boardId}` },
        (payload: { new: Record<string, unknown> }) => {
          const candidate = (payload.new as { document?: unknown }).document;
          if (isBoardDocument(candidate) && JSON.stringify(candidate) !== lastRemote) applyRemoteDocument(candidate);
        },
      )
      .subscribe((connectionStatus: string) => {
        if (!disposed && connectionStatus === "SUBSCRIBED") setStatus("synced");
      });

    void (async () => {
      try {
        const response = await fetch(`/api/boards/${boardId}`, { cache: "no-store" });
        const body: unknown = await response.json().catch(() => null);
        const document = body && typeof body === "object" ? (body as { board?: { document?: unknown } }).board?.document : null;
        if (!response.ok || !isBoardDocument(document)) throw new Error(body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "Could not open this board.");
        if (!disposed) applyRemoteDocument(document);
      } catch (loadError) {
        if (!disposed) {
          setStatus("error");
          setError(loadError instanceof Error ? loadError.message : "Could not open this board.");
        }
      }
    })();

    return () => {
      disposed = true;
      window.clearTimeout(saveTimer);
      unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [boardId]);

  const isPersistent = Boolean(boardId && isSupabaseConfigured());
  return { status: isPersistent ? status : "local", error: isPersistent ? error : null, isPersistent };
}

"use client";

import { useSyncExternalStore } from "react";
import { boardStore } from "@/lib/board";

export function useBoard() {
  return useSyncExternalStore(boardStore.subscribe, boardStore.getSnapshot, boardStore.getServerSnapshot);
}

"use client";

import { useEffect, useState } from "react";
import type { BoardMember } from "@/lib/board";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const localMember: BoardMember = { id: "haaris", name: "You", initials: "Y", role: "Human", color: "#f4b860" };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "Y";
}

function initialLocalMember() {
  if (typeof window === "undefined") return localMember;
  try {
    const saved = window.localStorage.getItem("aichemist-member");
    const parsed = saved ? JSON.parse(saved) as { name?: string } : null;
    return parsed?.name?.trim() ? { ...localMember, name: parsed.name.trim(), initials: initials(parsed.name) } : localMember;
  } catch { return localMember; }
}

export function useCurrentMember() {
  const [member, setMember] = useState<BoardMember>(initialLocalMember);
  const [loading, setLoading] = useState(isSupabaseConfigured());

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured()) {
      return;
    }

    void (async () => {
      const { data: { user } } = await createSupabaseBrowserClient().auth.getUser();
      if (active && user) {
        const metadataName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "";
        const name = metadataName.trim() || user.email?.split("@")[0] || "Collaborator";
        setMember({ id: user.id, name, initials: initials(name), role: "Human", color: "#f4b860" });
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return { member, loading, authenticated: isSupabaseConfigured() && member.id !== "haaris" };
}

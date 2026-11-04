"use client";

import { useEffect, useState } from "react";
import { sendGoodbye, sendHeartbeat } from "@/lib/editor/api";

const HEARTBEAT_MS = 15_000;

function listNames(names: string[]) {
  if (names.length < 2) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function PresenceChip({ sceneId }: { sceneId: string }) {
  const [others, setOthers] = useState<string[]>([]);

  useEffect(() => {
    let isActive = true;

    const beat = async () => {
      const names = await sendHeartbeat(sceneId).catch(() => null);
      if (isActive && names) setOthers(names);
    };

    void beat();
    const timer = setInterval(beat, HEARTBEAT_MS);

    return () => {
      isActive = false;
      clearInterval(timer);
      sendGoodbye(sceneId);
    };
  }, [sceneId]);

  if (others.length === 0) return null;

  return (
    <span className="presence-chip" role="status">
      <span aria-hidden className="save-dot" />
      {listNames(others)} {others.length === 1 ? "is" : "are"} also editing
    </span>
  );
}

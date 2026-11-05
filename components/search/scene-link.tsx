"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { sceneHref } from "@/lib/search/client";

type Target = { id: string; episodeId: string; seasonId: string; beatId?: string };

/** The href is only a fallback: where it opens depends on where the person last read. */
export function SceneLink({ target, children }: { target: Target; children: ReactNode }) {
  const router = useRouter();

  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    router.push(sceneHref(target));
  };

  return (
    <a href={sceneHref(target, "scene")} className="card-link" onClick={open}>
      {children}
    </a>
  );
}

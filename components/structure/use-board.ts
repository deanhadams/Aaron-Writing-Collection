"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createBoard, type Snapshot } from "@/lib/structure/board";

/** A board that takes in each fresh render of the page. Memoize the snapshot. */
export function useBoard<T extends { id: string }>(server: Snapshot<T>) {
  const [board] = useState(() => createBoard(server));
  const items = useSyncExternalStore(board.subscribe, board.getItems, board.getItems);

  useEffect(() => board.adopt(server), [board, server]);

  return { board, items };
}

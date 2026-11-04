/** Pure scroll arithmetic, so the keyboard rules can be tested without a browser. */

/** A jump lands a little above the reading line, and that still counts as there. */
const TOLERANCE = 12;

/** The last section whose top has reached the reading line, or -1 above the first. */
export function currentIndex(tops: number[], line: number) {
  let found = -1;
  tops.forEach((top, index) => {
    if (top <= line + TOLERANCE) found = index;
  });
  return found;
}

/** The section to go to next, or null when there is nothing further that way. */
export function stepIndex(tops: number[], line: number, direction: 1 | -1) {
  const current = currentIndex(tops, line);
  if (direction === 1) return current + 1 < tops.length ? current + 1 : null;

  // Part-way through a section, "back" means the start of that one.
  if (current >= 0 && tops[current] < line - TOLERANCE) return current;
  return current > 0 ? current - 1 : null;
}

export function scrollProgress(scrollTop: number, scrollHeight: number, viewport: number) {
  const distance = scrollHeight - viewport;
  return distance <= 0 ? 1 : Math.min(1, Math.max(0, scrollTop / distance));
}

/** What each reader key does, or null if it is not ours. Modifiers stay the browser's. */
export function readerKey(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  switch (event.key) {
    case "j":
    case "J":
    case "ArrowRight":
      return { target: "scene", direction: 1 } as const;
    case "k":
    case "K":
    case "ArrowLeft":
      return { target: "scene", direction: -1 } as const;
    case "]":
      return { target: "episode", direction: 1 } as const;
    case "[":
      return { target: "episode", direction: -1 } as const;
    default:
      return null;
  }
}

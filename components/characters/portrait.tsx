import type { CSSProperties } from "react";
import { textOnColor } from "@/lib/characters/colors";

/**
 * The initial on the character's color, with any image laid over it as a
 * background. A missing file then leaves the initial, never a broken image.
 */
export function Portrait({
  name,
  color,
  url,
  className = "",
}: {
  name: string;
  color: string | null;
  url: string | null;
  className?: string;
}) {
  const background = color ?? "var(--color-primary-strong)";

  return (
    <span
      aria-hidden
      className={`portrait ${className}`}
      style={{ "--char": background, color: textOnColor(color) } as CSSProperties}
    >
      <span className="portrait-initial">{name.charAt(0).toUpperCase()}</span>
      {url && <span className="portrait-image" style={{ backgroundImage: `url(${JSON.stringify(url)})` }} />}
    </span>
  );
}

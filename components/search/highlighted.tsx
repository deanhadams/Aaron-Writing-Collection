import type { Segment } from "@/lib/search/run";

export function Highlighted({ segments }: { segments: Segment[] }) {
  return segments.map(({ text, isMatch }, index) =>
    isMatch ? (
      <mark key={index} className="search-mark">
        {text}
      </mark>
    ) : (
      text
    ),
  );
}

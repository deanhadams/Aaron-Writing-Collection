import { LogoMark } from "@/components/layout/logo-mark";

type Mood = "empty" | "lost" | "error";

const ACCENTS: Record<Mood, React.ReactNode> = {
  // A blank page, waiting for a first line.
  empty: (
    <g stroke="#2563ff" strokeWidth="2" fill="white" strokeLinecap="round">
      <rect x="84" y="46" width="30" height="38" rx="4" />
      <path d="M91 58h16M91 66h16M91 74h9" />
    </g>
  ),
  lost: (
    <path
      d="M92 34a9 9 0 1 1 13 8c-3 2-4 3-4 7M101 58v.5"
      fill="none"
      stroke="#7c5cff"
      strokeWidth="4"
      strokeLinecap="round"
    />
  ),
  // Sparks from something that just went wrong.
  error: (
    <path
      d="M92 30l5 12-8 3 7 13M108 44l-4 7 6 2-3 7"
      fill="none"
      stroke="#ff4fa3"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

export function BunnyIllustration({ mood }: { mood: Mood }) {
  return (
    <div aria-hidden className="relative mx-auto h-28 w-32">
      <LogoMark className="absolute bottom-0 left-0 size-24" />
      <svg viewBox="0 0 128 112" className="absolute inset-0">
        {ACCENTS[mood]}
      </svg>
    </div>
  );
}

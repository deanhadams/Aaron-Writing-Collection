import { HeroGlow } from "./hero-glow";

const TITLE = "The Writing Room";

export function Hero() {
  return (
    <HeroGlow>
      <h1 className="relative w-fit max-w-full text-5xl font-bold tracking-tight sm:text-7xl">
        <span className="text-gradient">{TITLE}</span>
        <span aria-hidden className="text-gradient hero-title-shift">
          {TITLE}
        </span>
      </h1>
      <p className="mt-4 text-lg text-muted">
        Where Aaron&apos;s worlds get written, one scene at a time.
      </p>
    </HeroGlow>
  );
}

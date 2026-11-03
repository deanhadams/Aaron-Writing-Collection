import Link from "next/link";
import { sceneTitle } from "@/lib/format";

type SceneLink = {
  id: string;
  kind: "prologue" | "scene" | "outro" | "post_credit";
  title: string | null;
};

function StepLink({
  scene,
  direction,
}: {
  scene: SceneLink | null;
  direction: "Previous" | "Next";
}) {
  // An empty cell keeps the title centered on the first and last scene.
  if (!scene) return <span />;

  const isNext = direction === "Next";
  const title = sceneTitle(scene);

  return (
    <Link
      href={`/scenes/${scene.id}`}
      aria-label={`${direction} scene: ${title}`}
      className={`btn-ghost min-w-0 truncate text-sm ${isNext ? "justify-self-end" : "justify-self-start"}`}
    >
      {!isNext && "← "}
      <span className="hidden sm:inline">{title}</span>
      {isNext && " →"}
    </Link>
  );
}

export function SceneBar({
  title,
  previous,
  next,
}: {
  title: string;
  previous: SceneLink | null;
  next: SceneLink | null;
}) {
  return (
    <nav
      aria-label="Scenes in this episode"
      className="glass sticky! top-[4.5rem] z-30 mx-auto mb-6 grid max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl px-4 py-2"
    >
      <StepLink scene={previous} direction="Previous" />
      <span className="eyebrow max-w-40 truncate text-center text-muted sm:max-w-56">
        {title}
      </span>
      <StepLink scene={next} direction="Next" />
    </nav>
  );
}

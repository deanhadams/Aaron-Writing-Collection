import type { CSSProperties } from "react";
import { imageUrl } from "@/lib/images";

const MAX_VISIBLE = 4;

type Speaker = {
  name: string;
  color: string | null;
  portraitKey: string | null;
};

function Avatar({ speaker }: { speaker: Speaker }) {
  const portrait = imageUrl(speaker.portraitKey);

  return (
    <>
      {speaker.name.charAt(0).toUpperCase()}
      {/* A background, not an img: a missing file then leaves the initial
          showing instead of the browser's broken-image icon. */}
      {portrait && (
        <span
          className="absolute inset-0 rounded-full bg-cover bg-center"
          style={{ backgroundImage: `url(${JSON.stringify(portrait)})` }}
        />
      )}
    </>
  );
}

export function SpeakerAvatars({ speakers }: { speakers: Speaker[] }) {
  const visible = speakers.slice(0, MAX_VISIBLE);
  const hidden = speakers.length - visible.length;
  const total = visible.length + (hidden > 0 ? 1 : 0);

  return (
    <>
      <span className="sr-only">
        Speaking: {speakers.map((speaker) => speaker.name).join(", ")}
      </span>
      <span aria-hidden className="avatar-stack">
        {visible.map((speaker, index) => (
          <span
            key={speaker.name}
            className="avatar"
            style={
              {
                backgroundColor: speaker.color ?? "var(--color-primary-strong)",
                "--n": total - 1 - index,
              } as CSSProperties
            }
          >
            <Avatar speaker={speaker} />
          </span>
        ))}
        {hidden > 0 && (
          <span className="avatar avatar-more" style={{ "--n": 0 } as CSSProperties}>
            +{hidden}
          </span>
        )}
      </span>
    </>
  );
}

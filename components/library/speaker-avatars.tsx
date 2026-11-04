import type { CSSProperties } from "react";

// The url comes from the server, because the bucket's address is a server setting.
type Speaker = {
  name: string;
  color: string | null;
  portraitUrl: string | null;
};

function Avatar({ speaker }: { speaker: Speaker }) {
  const portrait = speaker.portraitUrl;

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

export function SpeakerAvatars({
  speakers,
  max = 4,
}: {
  speakers: Speaker[];
  max?: number;
}) {
  const visible = speakers.slice(0, max);
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
                "--m": index,
              } as CSSProperties
            }
          >
            <Avatar speaker={speaker} />
          </span>
        ))}
        {hidden > 0 && (
          <span
            className="avatar avatar-more"
            style={{ "--n": 0, "--m": visible.length } as CSSProperties}
          >
            +{hidden}
          </span>
        )}
      </span>
    </>
  );
}

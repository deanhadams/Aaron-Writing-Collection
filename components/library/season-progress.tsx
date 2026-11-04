type Episode = {
  id: string;
  number: number;
  title: string;
  status: "idea" | "drafting" | "done";
};

export function SeasonProgress({
  episodes,
  doneCount,
}: {
  episodes: Episode[];
  doneCount: number;
}) {
  const count = (status: Episode["status"]) =>
    episodes.filter((episode) => episode.status === status).length;

  return (
    <div className="mt-4">
      <div
        role="img"
        aria-label={`${count("done")} done, ${count("drafting")} drafting, ${count("idea")} ideas`}
        className="season-segments"
      >
        {episodes.map((episode, index) => (
          <span
            key={episode.id}
            data-status={episode.status}
            // Tooltips in the right half open leftward to stay inside the card.
            data-flip={index >= episodes.length / 2 || undefined}
            className="season-segment"
          >
            <span aria-hidden className="chip-tooltip">
              Episode {episode.number}: {episode.title}
            </span>
          </span>
        ))}
      </div>
      <p className="mt-1 text-xs font-medium text-muted">
        {doneCount} of {episodes.length} episodes done
      </p>
    </div>
  );
}

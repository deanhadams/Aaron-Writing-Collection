const SHAPES = {
  covers: { list: "grid grid-cols-1 gap-6 md:grid-cols-2", item: "h-[34rem] rounded-2xl" },
  cards: { list: "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3", item: "h-80 rounded-2xl" },
  timeline: { list: "space-y-5 pl-11", item: "h-40 rounded-2xl" },
  script: { list: "mx-auto max-w-3xl", item: "h-[32rem] rounded-xl" },
};

const COUNTS = { covers: 2, cards: 6, timeline: 4, script: 1 };

export function PageSkeleton({ shape }: { shape: keyof typeof SHAPES }) {
  const { list, item } = SHAPES[shape];

  return (
    <div aria-hidden>
      {shape !== "covers" && (
        <>
          <div className="skeleton mb-6 h-4 w-48 rounded" />
          <div className="skeleton mb-8 h-11 w-72 max-w-full rounded-lg" />
        </>
      )}
      <div className={list}>
        {Array.from({ length: COUNTS[shape] }, (_, index) => (
          <div key={index} className={`skeleton ${item}`} />
        ))}
      </div>
    </div>
  );
}

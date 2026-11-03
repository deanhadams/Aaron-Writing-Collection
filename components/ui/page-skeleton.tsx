export function PageSkeleton() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="h-4 w-48 rounded bg-line" />
      <div className="h-9 w-72 rounded bg-line" />
      <div className="h-24 rounded-2xl bg-line/60" />
      <div className="h-24 rounded-2xl bg-line/60" />
    </div>
  );
}

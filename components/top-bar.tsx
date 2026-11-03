import Link from "next/link";

export function TopBar() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center px-6">
        <Link
          href="/"
          className="font-heading text-xl font-semibold tracking-tight text-primary"
        >
          Aaron&apos;s Writing Collection
        </Link>
      </div>
    </header>
  );
}

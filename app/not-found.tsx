import Link from "next/link";

export default function NotFound() {
  return (
    <section className="card mx-auto mt-10 max-w-md p-8 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-ink/70">It may have been moved or deleted.</p>
      <Link href="/" className="mt-4 inline-block text-primary hover:underline">
        Back to the library
      </Link>
    </section>
  );
}

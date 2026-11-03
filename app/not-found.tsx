import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="mt-10">
      <EmptyState mood="lost" title="This page wandered off">
        <p>It may have been moved or deleted.</p>
        <Link href="/" className="btn-primary mt-5">
          Back to the library
        </Link>
      </EmptyState>
    </div>
  );
}

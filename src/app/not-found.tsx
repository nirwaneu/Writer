import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Wordmark />
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.02em]">This page is blank.</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          The book or page you asked for is not on the shelf.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-md border border-border bg-secondary px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-[#1d2834]"
      >
        Back to the library
      </Link>
    </div>
  );
}

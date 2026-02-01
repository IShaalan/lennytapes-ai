import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-headline text-6xl font-bold text-foreground-muted mb-4">
          404
        </h1>
        <p className="text-foreground-secondary mb-6">
          This tape seems to be missing from the collection.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}

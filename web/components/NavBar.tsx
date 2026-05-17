import Link from "next/link";

export function NavBar() {
  return (
    <nav className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-base font-bold tracking-tight">
          Job Tracker
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:underline">
            공고
          </Link>
          <Link href="/documents" className="hover:underline">
            이력서·자소서
          </Link>
        </div>
      </div>
    </nav>
  );
}

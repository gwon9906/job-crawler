"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type CardJob = {
  job_id: string;
  title: string;
  company: string;
  url: string;
  platform: string;
  matched_keywords: string[];
  employee_count: number | null;
  industry: string | null;
  due_date: string | null;
  applied: boolean;
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return null;
  }
}

function dueBadgeTone(value: string | null): string {
  if (!value) return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "bg-slate-100 text-slate-500";
  const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "bg-slate-200 text-slate-500 line-through dark:bg-slate-800";
  if (diffDays <= 3) return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
  if (diffDays <= 14) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
}

export function JobCard({ job }: { job: CardJob }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [applied, setApplied] = useState(job.applied);
  const [error, setError] = useState<string | null>(null);

  const toggleApplied = async () => {
    const next = !applied;
    setApplied(next);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(job.job_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applied: next }),
      });
      if (!res.ok) {
        setApplied(!next);
        setError("저장 실패");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setApplied(!next);
      setError("네트워크 오류");
    }
  };

  const due = formatDate(job.due_date);

  return (
    <article
      className={`flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm transition dark:bg-slate-900 ${
        applied
          ? "border-emerald-300 dark:border-emerald-700"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded bg-slate-100 px-2 py-0.5 font-medium dark:bg-slate-800">
              {job.platform}
            </span>
            {job.industry && (
              <span className="truncate" title={job.industry}>
                {job.industry}
              </span>
            )}
          </div>
          <h2 className="mt-1 text-base font-semibold leading-snug">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {job.title}
            </a>
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{job.company}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={applied}
            disabled={isPending}
            onChange={toggleApplied}
            className="h-4 w-4 accent-emerald-600"
          />
          <span className={applied ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500"}>
            {applied ? "지원함" : "지원"}
          </span>
        </label>
      </header>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 ${dueBadgeTone(job.due_date)}`}>
          마감 {due ?? "정보 없음"}
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {job.employee_count != null ? `직원 ${job.employee_count.toLocaleString()}명` : "직원 수 미상"}
        </span>
        {job.matched_keywords.slice(0, 4).map((kw) => (
          <span
            key={kw}
            className="rounded bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
          >
            {kw}
          </span>
        ))}
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <footer className="mt-auto flex items-center justify-between text-xs text-slate-500">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline dark:text-indigo-300"
        >
          공고 열기 →
        </a>
      </footer>
    </article>
  );
}

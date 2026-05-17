"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { JOB_STATUSES, JobStatus, statusMeta } from "@/lib/filters";

interface Props {
  jobId: string;
  value: JobStatus;
  onChanged?: (status: JobStatus) => void;
  className?: string;
}

export function StatusSelect({ jobId, value, onChanged, className }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const meta = statusMeta(value);

  const update = async (next: JobStatus) => {
    onChanged?.(next);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) return;
      startTransition(() => router.refresh());
    } catch {
      /* swallow */
    }
  };

  return (
    <label className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${meta.tone}`}>
        {meta.label}
      </span>
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => update(e.target.value as JobStatus)}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
      >
        {JOB_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

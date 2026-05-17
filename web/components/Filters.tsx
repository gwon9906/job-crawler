"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { JOB_STATUSES, SIZE_BUCKETS, SizeBucket } from "@/lib/filters";

const PLATFORMS = ["원티드", "잡코리아", "인디스워크"];

export function Filters() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedPlatforms = new Set(params.getAll("platform"));
  const selectedSizes = new Set(params.getAll("size"));
  const selectedStatuses = new Set(params.getAll("status"));
  const keyword = params.get("keyword") ?? "";

  const replace = (next: URLSearchParams) => {
    startTransition(() => {
      router.replace(next.toString() ? `/?${next.toString()}` : "/");
    });
  };

  const toggleMulti = (key: string, value: string, on: boolean) => {
    const next = new URLSearchParams(params.toString());
    const current = next.getAll(key).filter((v) => v !== value);
    next.delete(key);
    current.forEach((v) => next.append(key, v));
    if (on) next.append(key, value);
    replace(next);
  };

  const setSingle = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    replace(next);
  };

  const reset = () => replace(new URLSearchParams());

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-4 lg:grid-cols-4">
        <div>
          <h3 className="mb-2 text-sm font-semibold">키워드</h3>
          <input
            type="search"
            defaultValue={keyword}
            placeholder="회사·직무·메모"
            onChange={(e) => setSingle("keyword", e.target.value || null)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">플랫폼</h3>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const on = selectedPlatforms.has(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleMulti("platform", p, !on)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    on
                      ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                      : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">회사 규모</h3>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SIZE_BUCKETS) as SizeBucket[]).map((bucket) => {
              const on = selectedSizes.has(bucket);
              return (
                <button
                  key={bucket}
                  type="button"
                  onClick={() => toggleMulti("size", bucket, !on)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    on
                      ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                      : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  }`}
                >
                  {SIZE_BUCKETS[bucket].label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">진행 상태</h3>
          <div className="flex flex-wrap gap-2">
            {JOB_STATUSES.map((s) => {
              const on = selectedStatuses.has(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleMulti("status", s.value, !on)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    on
                      ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                      : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>{isPending ? "필터 적용 중…" : "필터를 변경하면 자동으로 적용됩니다"}</span>
        <button
          type="button"
          onClick={reset}
          className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          초기화
        </button>
      </div>
    </section>
  );
}

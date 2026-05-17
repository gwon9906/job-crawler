"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { JobStatus } from "@/lib/filters";
import { StatusSelect } from "./StatusSelect";

type DocumentSummary = {
  _id: string;
  title: string;
  type: "resume" | "cover_letter";
  url?: string | null;
  sectionCount: number;
};

interface Props {
  jobId: string;
  initialStatus: JobStatus;
  initialMemo: string;
  initialDocumentIds: string[];
  documents: DocumentSummary[];
}

export function JobDetailEditor({
  jobId,
  initialStatus,
  initialMemo,
  initialDocumentIds,
  documents,
}: Props) {
  const router = useRouter();
  const [memo, setMemo] = useState(initialMemo);
  const [status, setStatus] = useState<JobStatus>(initialStatus);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialDocumentIds));
  const [savingMemo, setSavingMemo] = useState(false);
  const [memoSaved, setMemoSaved] = useState<null | "ok" | "err">(null);
  const [isPending, startTransition] = useTransition();

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  };

  const saveMemo = async () => {
    setSavingMemo(true);
    setMemoSaved(null);
    const ok = await patch({ memo: memo.trim() || null });
    setSavingMemo(false);
    setMemoSaved(ok ? "ok" : "err");
    if (ok) startTransition(() => router.refresh());
  };

  const toggleDocument = async (docId: string) => {
    const next = new Set(selected);
    if (next.has(docId)) next.delete(docId);
    else next.add(docId);
    setSelected(next);
    const ok = await patch({ document_ids: Array.from(next) });
    if (!ok) {
      setSelected(selected);
    } else {
      startTransition(() => router.refresh());
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold">진행 상태</h3>
        <StatusSelect jobId={jobId} value={status} onChanged={setStatus} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">메모</h3>
          <button
            type="button"
            onClick={saveMemo}
            disabled={savingMemo}
            className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {savingMemo ? "저장 중…" : "저장"}
          </button>
        </div>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="회사 정보, 지원 동기, 면접 후기 등 메모를 적어두세요"
          className="h-40 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950"
        />
        {memoSaved === "ok" && <p className="mt-2 text-xs text-emerald-600">저장됨</p>}
        {memoSaved === "err" && <p className="mt-2 text-xs text-rose-600">저장 실패</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">사용한 이력서 / 자소서</h3>
          <a
            href="/documents"
            className="text-xs text-indigo-600 hover:underline dark:text-indigo-300"
          >
            라이브러리 →
          </a>
        </div>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-500">
            아직 등록된 이력서/자소서가 없습니다. 라이브러리에서 먼저 만들어 보세요.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {documents.map((doc) => {
              const on = selected.has(doc._id);
              const isResume = doc.type === "resume";
              return (
                <li key={doc._id} className="flex items-center justify-between gap-3 py-2">
                  <label className="flex flex-1 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleDocument(doc._id)}
                      className="h-4 w-4 accent-indigo-600"
                    />
                    <span className="flex-1">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                        {isResume ? "이력서" : "자소서"}
                      </span>
                      <span className="ml-2 font-medium">{doc.title}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {isResume
                          ? doc.url ?? "URL 없음"
                          : `문항 ${doc.sectionCount}개`}
                      </span>
                    </span>
                  </label>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    {isResume && doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline dark:text-indigo-300"
                      >
                        열기 ↗
                      </a>
                    )}
                    <a
                      href={`/documents/${doc._id}`}
                      className="text-indigo-600 hover:underline dark:text-indigo-300"
                    >
                      편집
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {isPending && <p className="mt-2 text-xs text-slate-500">반영 중…</p>}
      </section>
    </div>
  );
}

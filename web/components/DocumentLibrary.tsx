"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DOCUMENT_TYPES, DocumentType, documentTypeLabel } from "@/lib/filters";

type DocItem = {
  _id: string;
  title: string;
  type: DocumentType;
  url?: string | null;
  sectionCount: number;
  firstQuestion?: string | null;
  updated_at: string;
};

export function DocumentLibrary({ initialDocs }: { initialDocs: DocItem[] }) {
  const router = useRouter();
  const [docs, setDocs] = useState<DocItem[]>(initialDocs);
  const [filter, setFilter] = useState<"all" | DocumentType>("all");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocumentType>("resume");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = docs.filter((d) => filter === "all" || d.type === filter);

  const create = async () => {
    setError(null);
    if (!title.trim()) {
      setError("제목을 입력해주세요");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), type }),
      });
      if (!res.ok) {
        setError("생성 실패");
        return;
      }
      const data = await res.json();
      router.push(`/documents/${data.document._id}`);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("정말 삭제할까요? 공고에 연결돼 있어도 해제됩니다.")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("삭제 실패");
      return;
    }
    setDocs((prev) => prev.filter((d) => d._id !== id));
    startTransition(() => router.refresh());
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold">새 문서 만들기</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DocumentType)}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="문서 제목 (예: AI 직무 공통 이력서 / OOO 자소서)"
            className="flex-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="button"
            onClick={create}
            disabled={creating}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {creating ? "생성 중…" : "만들기"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap gap-2">
          {(["all", ...DOCUMENT_TYPES.map((t) => t.value)] as ("all" | DocumentType)[]).map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  on
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                    : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                }`}
              >
                {f === "all" ? "전체" : documentTypeLabel(f)}
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
            아직 등록된 문서가 없습니다.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {visible.map((d) => (
              <li
                key={d._id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                    {documentTypeLabel(d.type)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(d.updated_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <h3 className="font-semibold leading-snug">{d.title}</h3>
                {d.type === "resume" ? (
                  d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-xs text-indigo-600 hover:underline dark:text-indigo-300"
                      title={d.url}
                    >
                      🔗 {d.url}
                    </a>
                  ) : (
                    <p className="text-xs text-slate-400">URL 미입력</p>
                  )
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    문항 {d.sectionCount}개{d.firstQuestion ? ` · ${d.firstQuestion}` : ""}
                  </p>
                )}
                <div className="mt-1 flex justify-end gap-3 text-xs">
                  <Link
                    href={`/documents/${d._id}`}
                    className="text-indigo-600 hover:underline dark:text-indigo-300"
                  >
                    편집
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(d._id)}
                    className="text-rose-600 hover:underline"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

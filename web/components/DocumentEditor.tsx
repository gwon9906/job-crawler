"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DOCUMENT_TYPES, DocumentType } from "@/lib/filters";

interface Section {
  question: string;
  answer: string;
}

interface Props {
  id: string;
  initialTitle: string;
  initialType: DocumentType;
  initialUrl: string;
  initialSections: Section[];
}

export function DocumentEditor({
  id,
  initialTitle,
  initialType,
  initialUrl,
  initialSections,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [type, setType] = useState<DocumentType>(initialType);
  const [url, setUrl] = useState(initialUrl);
  const [sections, setSections] = useState<Section[]>(
    initialSections.length > 0 ? initialSections : [{ question: "", answer: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = { title, type };
    if (type === "resume") {
      payload.url = url.trim() || null;
    } else {
      payload.sections = sections
        .map((s) => ({ question: s.question.trim(), answer: s.answer }))
        .filter((s) => s.question || s.answer);
    }
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        setError(detail?.error ?? "저장 실패");
        return;
      }
      setSavedAt(new Date());
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("정말 삭제할까요? 공고에 연결된 참조도 해제됩니다.")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("삭제 실패");
      return;
    }
    router.push("/documents");
  };

  const addSection = () => setSections((prev) => [...prev, { question: "", answer: "" }]);
  const removeSection = (idx: number) =>
    setSections((prev) => prev.filter((_, i) => i !== idx));
  const updateSection = (idx: number, patch: Partial<Section>) =>
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const moveSection = (idx: number, dir: -1 | 1) =>
    setSections((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  return (
    <div className="space-y-4">
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
          placeholder="문서 제목"
          className="flex-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={remove}
          className="rounded border border-rose-300 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
        >
          삭제
        </button>
      </div>

      {type === "resume" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <label className="block text-sm font-semibold">이력서 URL</label>
          <p className="mt-1 text-xs text-slate-500">
            깃허브 페이지, Notion, Google Drive 등 외부 링크. 공고에 연결하면 새 탭으로 열립니다.
          </p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://gwon9906.github.io/#/resume/ai-engineer"
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs text-indigo-600 hover:underline dark:text-indigo-300"
            >
              미리보기 ↗
            </a>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          {sections.map((section, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">문항 {idx + 1}</span>
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => moveSection(idx, -1)}
                    disabled={idx === 0}
                    className="rounded border border-slate-300 px-2 py-0.5 disabled:opacity-30 dark:border-slate-700"
                    title="위로"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(idx, 1)}
                    disabled={idx === sections.length - 1}
                    className="rounded border border-slate-300 px-2 py-0.5 disabled:opacity-30 dark:border-slate-700"
                    title="아래로"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSection(idx)}
                    disabled={sections.length === 1}
                    className="rounded border border-rose-300 px-2 py-0.5 text-rose-600 disabled:opacity-30 dark:border-rose-900"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={section.question}
                onChange={(e) => updateSection(idx, { question: e.target.value })}
                placeholder="질문 (예: 지원 동기와 입사 후 포부)"
                className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium dark:border-slate-700 dark:bg-slate-950"
              />
              <textarea
                value={section.answer}
                onChange={(e) => updateSection(idx, { answer: e.target.value })}
                placeholder="답변"
                className="mt-2 h-40 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-950"
              />
              <div className="mt-1 text-right text-xs text-slate-400">
                {section.answer.length.toLocaleString()}자
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addSection}
            className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            + 문항 추가
          </button>
        </section>
      )}

      <div className="text-xs text-slate-500">
        {savedAt && `${savedAt.toLocaleTimeString("ko-KR")} 저장됨`}
        {error && <span className="ml-2 text-rose-600">{error}</span>}
      </div>
    </div>
  );
}

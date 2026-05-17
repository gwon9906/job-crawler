"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DOCUMENT_TYPES, DocumentType } from "@/lib/filters";

interface Props {
  id: string;
  initialTitle: string;
  initialType: DocumentType;
  initialContent: string;
}

export function DocumentEditor({
  id,
  initialTitle,
  initialType,
  initialContent,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [type, setType] = useState<DocumentType>(initialType);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type, content }),
      });
      if (!res.ok) {
        setError("저장 실패");
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

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="여기에 이력서/자소서 본문을 작성하세요"
        className="h-[60vh] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm leading-relaxed outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950"
      />

      <div className="text-xs text-slate-500">
        {savedAt && `${savedAt.toLocaleTimeString("ko-KR")} 저장됨`}
        {error && <span className="ml-2 text-rose-600">{error}</span>}
      </div>
    </div>
  );
}

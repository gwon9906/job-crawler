import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentEditor } from "@/components/DocumentEditor";
import { DocumentType, statusMeta } from "@/lib/filters";
import {
  CoverLetterSection,
  ObjectId,
  getDocumentsCollection,
  getJobsCollection,
} from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export default async function DocumentEditPage({
  params,
}: {
  params: { id: string };
}) {
  let oid: ObjectId;
  try {
    oid = new ObjectId(params.id);
  } catch {
    notFound();
  }

  const coll = await getDocumentsCollection();
  const doc = await coll.findOne({ _id: oid });
  if (!doc) notFound();

  const sections: CoverLetterSection[] = Array.isArray(doc.sections)
    ? doc.sections
    : doc.type === "cover_letter" && doc.content
      ? [{ question: "본문", answer: doc.content }]
      : [];

  const jobsColl = await getJobsCollection();
  const linkedJobs = await jobsColl
    .find({ document_ids: params.id })
    .sort({ applied_at: -1, updated_at: -1 })
    .project({ job_id: 1, title: 1, company: 1, status: 1, applied: 1 })
    .toArray();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/documents"
        className="text-xs text-indigo-600 hover:underline dark:text-indigo-300"
      >
        ← 라이브러리로
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">문서 편집</h1>
      <p className="mt-1 text-sm text-slate-500">
        마지막 수정: {new Date(doc.updated_at).toLocaleString("ko-KR")}
      </p>

      <div className="mt-6">
        <DocumentEditor
          id={params.id}
          initialTitle={doc.title}
          initialType={doc.type as DocumentType}
          initialUrl={doc.url ?? ""}
          initialSections={sections}
        />
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold">이 문서로 지원한 공고</h2>
        {linkedJobs.length === 0 ? (
          <p className="text-sm text-slate-500">아직 이 문서와 연결된 공고가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {linkedJobs.map((j) => {
              const rawStatus = typeof j.status === "string" ? j.status : (j.applied ? "applied" : "new");
              const meta = statusMeta(rawStatus);
              return (
                <li key={j.job_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link
                    href={`/jobs/${encodeURIComponent(j.job_id)}`}
                    className="min-w-0 flex-1 hover:underline"
                  >
                    <span className="font-medium">{j.company}</span>
                    <span className="ml-2 text-slate-600 dark:text-slate-300">{j.title}</span>
                  </Link>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${meta.tone}`}>
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

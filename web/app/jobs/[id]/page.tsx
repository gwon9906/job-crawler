import Link from "next/link";
import { notFound } from "next/navigation";
import { JobDetailEditor } from "@/components/JobDetailEditor";
import { JobStatus, statusMeta } from "@/lib/filters";
import { getDocumentsCollection, getJobsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function normalizeStatus(raw: unknown, applied: unknown): JobStatus {
  const s = typeof raw === "string" ? raw : null;
  if (
    s === "new" ||
    s === "interested" ||
    s === "applied" ||
    s === "screening" ||
    s === "interview" ||
    s === "offer" ||
    s === "rejected"
  ) {
    return s;
  }
  return applied ? "applied" : "new";
}

function fmt(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR");
}

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const jobs = await getJobsCollection();
  const job = await jobs.findOne({ job_id: params.id });
  if (!job) notFound();

  const documentsColl = await getDocumentsCollection();
  const documents = await documentsColl.find({}).sort({ updated_at: -1 }).toArray();
  const documentList = documents.map((d) => ({
    _id: d._id?.toString() ?? "",
    title: d.title,
    type: d.type as "resume" | "cover_letter",
    url: d.url ?? null,
    sectionCount: Array.isArray(d.sections) ? d.sections.length : 0,
  }));

  const status = normalizeStatus(job.status, job.applied);
  const meta = statusMeta(status);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/" className="text-xs text-indigo-600 hover:underline dark:text-indigo-300">
        ← 목록으로
      </Link>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded bg-slate-100 px-2 py-0.5 font-medium dark:bg-slate-800">
            {job.platform}
          </span>
          {job.industry && <span>{job.industry}</span>}
          <span className={`rounded px-2 py-0.5 font-medium ${meta.tone}`}>{meta.label}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {job.title}
          </a>
        </h1>
        <p className="mt-1 text-base text-slate-700 dark:text-slate-300">{job.company}</p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">마감일</dt>
            <dd>{fmt(job.due_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">직원 수</dt>
            <dd>{job.employee_count?.toLocaleString() ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">수집일</dt>
            <dd>{fmt(job.collected_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">지원일</dt>
            <dd>{fmt(job.applied_at)}</dd>
          </div>
        </dl>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {(job.matched_keywords ?? []).map((kw: string) => (
            <span
              key={kw}
              className="rounded bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
            >
              {kw}
            </span>
          ))}
        </div>
      </header>

      <div className="mt-8">
        <JobDetailEditor
          jobId={job.job_id}
          initialStatus={status}
          initialMemo={job.memo ?? ""}
          initialDocumentIds={job.document_ids ?? []}
          documents={documentList}
        />
      </div>
    </main>
  );
}

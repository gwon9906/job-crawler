import { Filters } from "@/components/Filters";
import { JobCard } from "@/components/JobCard";
import { JobStatus, buildJobQuery, parseFilters } from "@/lib/filters";
import { getJobsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function serialize(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value);
}

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filters = parseFilters(searchParams);
  const coll = await getJobsCollection();
  const docs = await coll
    .find(buildJobQuery(filters))
    .sort({ collected_at: -1 })
    .limit(200)
    .toArray();

  const jobs = docs.map((d) => ({
    job_id: d.job_id,
    title: d.title,
    company: d.company,
    url: d.url,
    platform: d.platform,
    matched_keywords: d.matched_keywords ?? [],
    employee_count: typeof d.employee_count === "number" ? d.employee_count : null,
    industry: d.industry ?? null,
    due_date: serialize(d.due_date),
    status: normalizeStatus(d.status, d.applied),
    memo: d.memo ?? null,
    document_count: Array.isArray(d.document_ids) ? d.document_ids.length : 0,
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">채용공고</h1>
        <p className="mt-1 text-sm text-slate-500">
          MongoDB Atlas에 적재된 공고 {jobs.length}건
        </p>
      </header>

      <Filters />

      {jobs.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
          조건에 맞는 공고가 없습니다.
        </p>
      ) : (
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <JobCard key={job.job_id} job={job} />
          ))}
        </section>
      )}
    </main>
  );
}

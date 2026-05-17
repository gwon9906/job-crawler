export type SizeBucket = "startup" | "small" | "midsize" | "large" | "unknown";

export const SIZE_BUCKETS: Record<SizeBucket, { label: string; min?: number; max?: number }> = {
  startup: { label: "스타트업 (1-50)", min: 1, max: 50 },
  small: { label: "중소 (51-300)", min: 51, max: 300 },
  midsize: { label: "중견 (301-1000)", min: 301, max: 1000 },
  large: { label: "대기업 (1001+)", min: 1001 },
  unknown: { label: "정보 없음" },
};

export function sizeFilter(bucket: SizeBucket) {
  const cfg = SIZE_BUCKETS[bucket];
  if (bucket === "unknown") {
    return { $or: [{ employee_count: null }, { employee_count: { $exists: false } }] };
  }
  const range: Record<string, number> = {};
  if (cfg.min !== undefined) range.$gte = cfg.min;
  if (cfg.max !== undefined) range.$lte = cfg.max;
  return { employee_count: range };
}

export type JobStatus =
  | "new"
  | "interested"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected";

export const JOB_STATUSES: { value: JobStatus; label: string; tone: string }[] = [
  { value: "new", label: "신규", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  { value: "interested", label: "관심", tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200" },
  { value: "applied", label: "지원함", tone: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200" },
  { value: "screening", label: "서류 통과", tone: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200" },
  { value: "interview", label: "면접", tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200" },
  { value: "offer", label: "합격", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200" },
  { value: "rejected", label: "불합격", tone: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200" },
];

export const JOB_STATUS_VALUES = JOB_STATUSES.map((s) => s.value);

export function statusMeta(status: string | null | undefined) {
  const found = JOB_STATUSES.find((s) => s.value === status);
  return found ?? JOB_STATUSES[0];
}

export interface JobFilters {
  platforms: string[];
  keyword: string;
  sizes: SizeBucket[];
  statuses: JobStatus[];
}

export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): JobFilters {
  const asArray = (v: string | string[] | undefined): string[] => {
    if (!v) return [];
    return Array.isArray(v) ? v : v.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const platforms = asArray(searchParams.platform);
  const sizes = asArray(searchParams.size).filter(
    (s): s is SizeBucket => s in SIZE_BUCKETS,
  );
  const keyword = typeof searchParams.keyword === "string" ? searchParams.keyword.trim() : "";
  const statuses = asArray(searchParams.status).filter(
    (s): s is JobStatus => JOB_STATUS_VALUES.includes(s as JobStatus),
  );

  return { platforms, keyword, sizes, statuses };
}

export function buildJobQuery(filters: JobFilters) {
  const and: Record<string, unknown>[] = [];

  if (filters.platforms.length > 0) {
    and.push({ platform: { $in: filters.platforms } });
  }

  if (filters.keyword) {
    const escaped = filters.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "i");
    and.push({
      $or: [{ title: re }, { company: re }, { matched_keywords: re }, { memo: re }],
    });
  }

  if (filters.sizes.length > 0) {
    and.push({ $or: filters.sizes.map(sizeFilter) });
  }

  if (filters.statuses.length > 0) {
    const statusOrs: Record<string, unknown>[] = filters.statuses.map((s) => ({ status: s }));
    if (filters.statuses.includes("new")) {
      statusOrs.push({ status: { $exists: false } });
      statusOrs.push({ status: null });
    }
    and.push({ $or: statusOrs });
  }

  return and.length > 0 ? { $and: and } : {};
}

export const DOCUMENT_TYPES = [
  { value: "resume", label: "이력서" },
  { value: "cover_letter", label: "자기소개서" },
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number]["value"];

export const DOCUMENT_TYPE_VALUES = DOCUMENT_TYPES.map((d) => d.value);

export function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPES.find((d) => d.value === type)?.label ?? type;
}

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

export interface JobFilters {
  platforms: string[];
  keyword: string;
  sizes: SizeBucket[];
  status: "all" | "applied" | "not_applied";
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
  const statusRaw = typeof searchParams.status === "string" ? searchParams.status : "all";
  const status: JobFilters["status"] =
    statusRaw === "applied" || statusRaw === "not_applied" ? statusRaw : "all";

  return { platforms, keyword, sizes, status };
}

export function buildJobQuery(filters: JobFilters) {
  const and: Record<string, unknown>[] = [];

  if (filters.platforms.length > 0) {
    and.push({ platform: { $in: filters.platforms } });
  }

  if (filters.keyword) {
    const escaped = filters.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "i");
    and.push({ $or: [{ title: re }, { company: re }, { matched_keywords: re }] });
  }

  if (filters.sizes.length > 0) {
    and.push({ $or: filters.sizes.map(sizeFilter) });
  }

  if (filters.status === "applied") and.push({ applied: true });
  if (filters.status === "not_applied") and.push({ applied: { $ne: true } });

  return and.length > 0 ? { $and: and } : {};
}

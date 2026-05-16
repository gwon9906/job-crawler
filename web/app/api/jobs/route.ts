import { NextRequest, NextResponse } from "next/server";
import { buildJobQuery, parseFilters } from "@/lib/filters";
import { getJobsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const limit = Math.min(parseInt(params.get("limit") || "200", 10), 500);

  const filters = parseFilters({
    platform: params.getAll("platform"),
    size: params.getAll("size"),
    keyword: params.get("keyword") ?? undefined,
    status: params.get("status") ?? undefined,
  });

  const coll = await getJobsCollection();
  const docs = await coll
    .find(buildJobQuery(filters))
    .sort({ collected_at: -1 })
    .limit(limit)
    .toArray();

  return NextResponse.json({ jobs: docs });
}

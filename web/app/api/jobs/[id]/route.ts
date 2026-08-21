import { NextRequest, NextResponse } from "next/server";
import { JOB_STATUS_VALUES, JobStatus } from "@/lib/filters";
import { getJobsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const coll = await getJobsCollection();
  const job = await coll.findOne({ job_id: params.id });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ job });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const jobId = params.id;
  if (!jobId) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  let body: {
    status?: JobStatus;
    memo?: string | null;
    document_ids?: string[];
    hidden?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date() };

  if (body.status !== undefined) {
    if (!JOB_STATUS_VALUES.includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    update.status = body.status;
    const isApplied = ["applied", "screening", "interview", "offer", "rejected"].includes(body.status);
    update.applied = isApplied;
    if (isApplied) {
      update.applied_at = new Date();
    } else {
      update.applied_at = null;
    }
  }

  if (body.memo !== undefined) {
    update.memo = body.memo === null ? null : String(body.memo).slice(0, 5000);
  }

  if (Array.isArray(body.document_ids)) {
    update.document_ids = body.document_ids
      .filter((v): v is string => typeof v === "string")
      .slice(0, 20);
  }

  if (typeof body.hidden === "boolean") {
    update.hidden = body.hidden;
  }

  const coll = await getJobsCollection();
  const result = await coll.findOneAndUpdate(
    { job_id: jobId },
    { $set: update },
    { returnDocument: "after" },
  );

  if (!result) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ job: result });
}

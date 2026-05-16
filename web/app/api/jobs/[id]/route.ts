import { NextRequest, NextResponse } from "next/server";
import { JobStatus, getJobsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS: JobStatus[] = ["new", "interested", "applied", "rejected", "expired"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const jobId = params.id;
  if (!jobId) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  let body: { applied?: boolean; status?: JobStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date() };

  if (typeof body.applied === "boolean") {
    update.applied = body.applied;
    update.applied_at = body.applied ? new Date() : null;
    if (body.applied && !body.status) update.status = "applied";
    if (!body.applied && !body.status) update.status = "new";
  }

  if (body.status) {
    if (!ALLOWED_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    update.status = body.status;
    if (body.status === "applied" && typeof body.applied !== "boolean") {
      update.applied = true;
      update.applied_at = new Date();
    }
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

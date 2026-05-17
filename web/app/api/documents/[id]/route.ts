import { NextRequest, NextResponse } from "next/server";
import { DOCUMENT_TYPE_VALUES, DocumentType } from "@/lib/filters";
import { ObjectId, getDocumentsCollection, getJobsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const oid = toObjectId(params.id);
  if (!oid) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const coll = await getDocumentsCollection();
  const doc = await coll.findOne({ _id: oid });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ document: { ...doc, _id: doc._id?.toString() } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const oid = toObjectId(params.id);
  if (!oid) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { title?: string; type?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date() };
  if (typeof body.title === "string") update.title = body.title.trim().slice(0, 200);
  if (typeof body.content === "string") update.content = body.content.slice(0, 50000);
  if (body.type) {
    if (!DOCUMENT_TYPE_VALUES.includes(body.type as DocumentType)) {
      return NextResponse.json({ error: "invalid type" }, { status: 400 });
    }
    update.type = body.type;
  }

  const coll = await getDocumentsCollection();
  const result = await coll.findOneAndUpdate(
    { _id: oid },
    { $set: update },
    { returnDocument: "after" },
  );
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ document: { ...result, _id: result._id?.toString() } });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const oid = toObjectId(params.id);
  if (!oid) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const coll = await getDocumentsCollection();
  const result = await coll.deleteOne({ _id: oid });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // 공고에 연결된 참조 정리
  const jobs = await getJobsCollection();
  await jobs.updateMany(
    { document_ids: params.id },
    { $pull: { document_ids: params.id } },
  );

  return NextResponse.json({ ok: true });
}

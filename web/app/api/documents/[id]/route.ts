import { NextRequest, NextResponse } from "next/server";
import { DOCUMENT_TYPE_VALUES, DocumentType } from "@/lib/filters";
import {
  CoverLetterSection,
  ObjectId,
  getDocumentsCollection,
  getJobsCollection,
} from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function sanitizeUrl(value: unknown): string | undefined | null {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("/")) {
    return undefined;
  }
  return trimmed.slice(0, 1000);
}

function sanitizeSections(value: unknown): CoverLetterSection[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const question = typeof (item as { question?: unknown }).question === "string"
        ? (item as { question: string }).question.trim().slice(0, 500)
        : "";
      const answer = typeof (item as { answer?: unknown }).answer === "string"
        ? (item as { answer: string }).answer.slice(0, 20000)
        : "";
      return { question, answer };
    })
    .filter((s): s is CoverLetterSection => s !== null)
    .slice(0, 30);
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

  let body: {
    title?: string;
    type?: string;
    url?: string | null;
    sections?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date() };
  const unset: Record<string, ""> = {};

  if (typeof body.title === "string") update.title = body.title.trim().slice(0, 200);

  if (body.type) {
    if (!DOCUMENT_TYPE_VALUES.includes(body.type as DocumentType)) {
      return NextResponse.json({ error: "invalid type" }, { status: 400 });
    }
    update.type = body.type;
  }

  if ("url" in body) {
    const cleaned = sanitizeUrl(body.url);
    if (cleaned === null) unset.url = "";
    else if (typeof cleaned === "string") update.url = cleaned;
  }

  if ("sections" in body) {
    const cleaned = sanitizeSections(body.sections);
    if (cleaned !== undefined) update.sections = cleaned;
  }

  const writes: Record<string, unknown> = { $set: update };
  if (Object.keys(unset).length > 0) writes.$unset = unset;

  const coll = await getDocumentsCollection();
  const result = await coll.findOneAndUpdate({ _id: oid }, writes, {
    returnDocument: "after",
  });
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

  const jobs = await getJobsCollection();
  await jobs.updateMany(
    { document_ids: params.id },
    { $pull: { document_ids: params.id } },
  );

  return NextResponse.json({ ok: true });
}

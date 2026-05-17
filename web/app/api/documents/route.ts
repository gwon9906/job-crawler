import { NextRequest, NextResponse } from "next/server";
import { DOCUMENT_TYPE_VALUES, DocumentType } from "@/lib/filters";
import { CoverLetterSection, getDocumentsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
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

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const coll = await getDocumentsCollection();
  const filter = type && DOCUMENT_TYPE_VALUES.includes(type as DocumentType)
    ? { type: type as DocumentType }
    : {};
  const docs = await coll.find(filter).sort({ updated_at: -1 }).toArray();
  return NextResponse.json({
    documents: docs.map((d) => ({ ...d, _id: d._id?.toString() })),
  });
}

export async function POST(req: NextRequest) {
  let body: {
    title?: string;
    type?: string;
    url?: string;
    sections?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.title || !body.type || !DOCUMENT_TYPE_VALUES.includes(body.type as DocumentType)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const now = new Date();
  const coll = await getDocumentsCollection();
  const doc = {
    title: body.title.trim().slice(0, 200),
    type: body.type as DocumentType,
    url: sanitizeUrl(body.url),
    sections: sanitizeSections(body.sections),
    created_at: now,
    updated_at: now,
  };
  const result = await coll.insertOne(doc);

  return NextResponse.json({
    document: { ...doc, _id: result.insertedId.toString() },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { DOCUMENT_TYPE_VALUES, DocumentType } from "@/lib/filters";
import { getDocumentsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

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
  let body: { title?: string; type?: string; content?: string };
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
  const result = await coll.insertOne({
    title: body.title.trim().slice(0, 200),
    type: body.type as DocumentType,
    content: (body.content ?? "").slice(0, 50000),
    created_at: now,
    updated_at: now,
  });

  return NextResponse.json({
    document: {
      _id: result.insertedId.toString(),
      title: body.title,
      type: body.type,
      content: body.content ?? "",
      created_at: now,
      updated_at: now,
    },
  });
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentEditor } from "@/components/DocumentEditor";
import { DocumentType } from "@/lib/filters";
import { CoverLetterSection, ObjectId, getDocumentsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export default async function DocumentEditPage({
  params,
}: {
  params: { id: string };
}) {
  let oid: ObjectId;
  try {
    oid = new ObjectId(params.id);
  } catch {
    notFound();
  }

  const coll = await getDocumentsCollection();
  const doc = await coll.findOne({ _id: oid });
  if (!doc) notFound();

  const sections: CoverLetterSection[] = Array.isArray(doc.sections)
    ? doc.sections
    : doc.type === "cover_letter" && doc.content
      ? [{ question: "본문", answer: doc.content }]
      : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/documents"
        className="text-xs text-indigo-600 hover:underline dark:text-indigo-300"
      >
        ← 라이브러리로
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">문서 편집</h1>
      <p className="mt-1 text-sm text-slate-500">
        마지막 수정: {new Date(doc.updated_at).toLocaleString("ko-KR")}
      </p>

      <div className="mt-6">
        <DocumentEditor
          id={params.id}
          initialTitle={doc.title}
          initialType={doc.type as DocumentType}
          initialUrl={doc.url ?? ""}
          initialSections={sections}
        />
      </div>
    </main>
  );
}

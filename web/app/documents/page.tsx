import { DocumentLibrary } from "@/components/DocumentLibrary";
import { DocumentType } from "@/lib/filters";
import { getDocumentsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const coll = await getDocumentsCollection();
  const docs = await coll.find({}).sort({ updated_at: -1 }).toArray();

  const items = docs.map((d) => ({
    _id: d._id?.toString() ?? "",
    title: d.title,
    type: d.type as DocumentType,
    url: d.url ?? null,
    sectionCount: Array.isArray(d.sections) ? d.sections.length : 0,
    firstQuestion: Array.isArray(d.sections) && d.sections[0]?.question
      ? d.sections[0].question
      : null,
    updated_at:
      d.updated_at instanceof Date
        ? d.updated_at.toISOString()
        : new Date(d.updated_at as unknown as string).toISOString(),
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">이력서 / 자기소개서</h1>
        <p className="mt-1 text-sm text-slate-500">
          이력서는 외부 URL로 연결하고, 자소서는 질문·답변 블록으로 작성하세요. 공고 상세에서 다중 연결됩니다.
        </p>
      </header>
      <DocumentLibrary initialDocs={items} />
    </main>
  );
}

import { Collection, MongoClient, ObjectId } from "mongodb";
import type { DocumentType, JobStatus } from "./filters";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI 환경변수가 설정되지 않았습니다.");
  }
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  return global._mongoClientPromise;
}

function getDbName(): string {
  return process.env.MONGODB_DB || "job_crawler";
}

export interface JobDoc {
  job_id: string;
  title: string;
  company: string;
  url: string;
  platform: string;
  matched_keywords: string[];
  employee_count: number | null;
  industry: string | null;
  due_date: Date | string | null;
  collected_at: Date;
  updated_at: Date;
  applied: boolean;
  applied_at: Date | null;
  status?: JobStatus;
  memo?: string | null;
  document_ids?: string[];
}

export async function getJobsCollection(): Promise<Collection<JobDoc>> {
  const client = await getClientPromise();
  const collName = process.env.MONGODB_COLLECTION || "jobs";
  return client.db(getDbName()).collection<JobDoc>(collName);
}

export interface CoverLetterSection {
  question: string;
  answer: string;
}

export interface DocumentDoc {
  _id?: ObjectId;
  title: string;
  type: DocumentType;
  /** 이력서용: 외부 URL (깃허브 페이지 등) */
  url?: string;
  /** 자소서용: 질문-답변 블록 배열 */
  sections?: CoverLetterSection[];
  /** legacy 호환 (이전 버전 자유 텍스트) */
  content?: string;
  created_at: Date;
  updated_at: Date;
}

export async function getDocumentsCollection(): Promise<Collection<DocumentDoc>> {
  const client = await getClientPromise();
  return client.db(getDbName()).collection<DocumentDoc>("documents");
}

export { ObjectId };

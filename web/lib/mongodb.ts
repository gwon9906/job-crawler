import { Collection, MongoClient } from "mongodb";

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

export type JobStatus = "new" | "interested" | "applied" | "rejected" | "expired";

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
  status: JobStatus;
}

export async function getJobsCollection(): Promise<Collection<JobDoc>> {
  const client = await getClientPromise();
  const dbName = process.env.MONGODB_DB || "job_crawler";
  const collName = process.env.MONGODB_COLLECTION || "jobs";
  return client.db(dbName).collection<JobDoc>(collName);
}

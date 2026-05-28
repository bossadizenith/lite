import { db } from "@lite/db";
import { Session } from "@lite/auth/auth";

export interface ReqVariables {
  db: typeof db;
  session: Session | null;
}

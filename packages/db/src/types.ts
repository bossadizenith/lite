import { InferSelectModel } from "drizzle-orm";
import schema from "./schema.js";

export type User = InferSelectModel<typeof schema.user>;
export type Account = InferSelectModel<typeof schema.account>;
export type Session = InferSelectModel<typeof schema.session>;
export type Verification = InferSelectModel<typeof schema.verification>;

export type Projects = InferSelectModel<typeof schema.projects>;
export type Deployments = InferSelectModel<typeof schema.deployments>;

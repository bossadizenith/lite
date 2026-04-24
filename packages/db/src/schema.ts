import { relations } from "drizzle-orm";
import { pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const deploymentStatusEnum = pgEnum("deployment_status", [
  "queued",
  "deploying",
  "ready",
  "failed",
]);

export const projects = pgTable("projects", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  repoUrl: varchar("repo_url", { length: 255 }).notNull(),
  buildCommand: varchar("build_command", { length: 255 }).notNull(),
  subDomain: varchar("sub_domain", { length: 255 }).notNull(),
  customDomain: varchar("custom_domain", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deployments = pgTable("deployments", {
  id: varchar("id", { length: 255 }).primaryKey(),
  projectId: varchar("project_id", { length: 255 }).notNull(),
  // domain: varchar("domain", { length: 255 }).notNull().default(""),
  status: deploymentStatusEnum("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  project: one(projects, {
    fields: [deployments.projectId],
    references: [projects.id],
  }),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  deployments: many(deployments),
}));

export const schema = {
  projects,
  deployments,
};

export default schema;

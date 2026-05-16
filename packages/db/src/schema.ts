import { relations } from "drizzle-orm";
import { pgEnum, pgTable, timestamp, varchar, integer, jsonb } from "drizzle-orm/pg-core";

export const deploymentStatusEnum = pgEnum("deployment_status", [
  "queued",
  "building",
  "built",
  "deploying",
  "healthy",
  "failed",
]);

export const deploymentTypeEnum = pgEnum("deployment_type", [
  "static",
  "container",
]);

export const projects = pgTable("projects", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  repoUrl: varchar("repo_url", { length: 255 }).notNull(),
  buildCommand: varchar("build_command", { length: 255 }).notNull(),
  subDomain: varchar("sub_domain", { length: 255 }).notNull(),
  customDomain: varchar("custom_domain", { length: 255 }).notNull(),
  currentDeploymentId: varchar("current_deployment_id", {
    length: 255,
  }),
  envVars: jsonb("env_vars"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deployments = pgTable("deployments", {
  id: varchar("id", { length: 255 }).primaryKey(),
  projectId: varchar("project_id", { length: 255 })
    .notNull()
    .references(() => projects.id),
  url: varchar("url", { length: 255 }).notNull(),
  status: deploymentStatusEnum("status").notNull(),
  type: deploymentTypeEnum("type").default("static").notNull(),
  imageUrl: varchar("image_url", { length: 255 }),
  serviceName: varchar("service_name", { length: 255 }),
  taskDefinitionArn: varchar("task_definition_arn", { length: 255 }),
  runtimePort: integer("runtime_port").default(3000),
  healthCheckPath: varchar("health_check_path", { length: 255 }).default("/"),
  ipAddress: varchar("ip_address", { length: 255 }),
  errorMessage: varchar("error_message", { length: 1024 }),
  finishedAt: timestamp("finished_at"),
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

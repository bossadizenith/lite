ALTER TABLE "deployments" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."deployment_status";--> statement-breakpoint
CREATE TYPE "public"."deployment_status" AS ENUM('queued', 'building', 'built', 'deploying', 'healthy', 'failed');--> statement-breakpoint
UPDATE "deployments" SET "status" = 'healthy' WHERE "status" = 'ready';--> statement-breakpoint
ALTER TABLE "deployments" ALTER COLUMN "status" SET DATA TYPE "public"."deployment_status" USING "status"::"public"."deployment_status";--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "image_url" varchar(255);--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "service_name" varchar(255);--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "task_definition_arn" varchar(255);--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "error_message" varchar(1024);--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "finished_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "current_deployment_id" varchar(255);--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
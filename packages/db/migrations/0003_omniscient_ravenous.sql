CREATE TYPE "public"."deployment_type" AS ENUM('static', 'container');--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "type" "deployment_type" DEFAULT 'static' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "runtime_port" integer DEFAULT 3000;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "health_check_path" varchar(255) DEFAULT '/';--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "env_vars" jsonb;
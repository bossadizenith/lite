ALTER TABLE "deployments" ADD COLUMN "commit_message" text;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "commit_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "commit_author" varchar(255);--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "branch" varchar(255);--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "redeploy_of_id" varchar(255);
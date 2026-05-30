ALTER TABLE "projects" ADD COLUMN "last_commit_message" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_commit_author" varchar(255);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_deployment_branch" varchar(255);
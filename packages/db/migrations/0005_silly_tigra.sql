ALTER TABLE "projects" ADD COLUMN "env_vars" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "user_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" DROP COLUMN "env_vars";
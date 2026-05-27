ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "env_vars" jsonb;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);
--> statement-breakpoint

UPDATE "projects"
SET "user_id" = (SELECT id FROM "user" LIMIT 1)
WHERE "user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_user_id_user_id_fk'
  ) THEN
    ALTER TABLE "projects"
    ADD CONSTRAINT "projects_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "deployments" DROP COLUMN IF EXISTS "env_vars";

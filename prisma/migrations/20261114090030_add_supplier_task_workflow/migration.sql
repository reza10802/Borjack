
-- Create TaskStatus enum if it does not already exist.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'TaskStatus'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE "TaskStatus" AS ENUM (
            'TODO',
            'IN_PROGRESS',
            'COMPLETED'
        );
    END IF;
END
$$;

-- Add new task fields.
ALTER TABLE "Task"
    ADD COLUMN "completedAt" TIMESTAMP(3),
    ADD COLUMN "dueAt" TIMESTAMP(3),
    ADD COLUMN "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    ADD COLUMN "supplierResponse" TEXT,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Preserve completion status of existing tasks.
UPDATE "Task"
SET "status" = 'COMPLETED'
WHERE "done" = true;

-- Create indexes.
CREATE INDEX IF NOT EXISTS "Task_toId_status_dueAt_idx"
    ON "Task"("toId", "status", "dueAt");

CREATE INDEX IF NOT EXISTS "Task_fromId_createdAt_idx"
    ON "Task"("fromId", "createdAt");

-- CreateEnum
CREATE TYPE "Report360Status" AS ENUM ('DRAFT', 'READY');

-- AlterTable
ALTER TABLE "cycle360" ADD COLUMN "target_level" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "cycle360_reports" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "status" "Report360Status" NOT NULL DEFAULT 'DRAFT',
    "sections" JSONB NOT NULL,
    "model" TEXT,
    "generated_at" TIMESTAMP(3),
    "author_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle360_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cycle360_reports_subject_id_key" ON "cycle360_reports"("subject_id");

-- AddForeignKey
ALTER TABLE "cycle360_reports" ADD CONSTRAINT "cycle360_reports_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "cycle360_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_reports" ADD CONSTRAINT "cycle360_reports_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

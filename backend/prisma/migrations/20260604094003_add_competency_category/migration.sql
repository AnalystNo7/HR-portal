-- AlterTable
ALTER TABLE "competency_templates" ADD COLUMN     "category" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "cycle360_competencies" ADD COLUMN     "category" TEXT NOT NULL DEFAULT '';

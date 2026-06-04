-- CreateEnum
CREATE TYPE "EvaluatorRole" AS ENUM ('SELF', 'MANAGER', 'SUBORDINATE', 'PEER');

-- CreateEnum
CREATE TYPE "Cycle360Status" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubjectStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "RespondentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "competency_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_templates" (
    "id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicator_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scale_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scale_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scale_point_templates" (
    "id" TEXT NOT NULL,
    "scale_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "scale_point_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle360" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "Cycle360Status" NOT NULL DEFAULT 'DRAFT',
    "started_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle360_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle360_competencies" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "source_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cycle360_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle360_indicators" (
    "id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "source_id" TEXT,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cycle360_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle360_scale_points" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "cycle360_scale_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle360_subjects" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" "SubjectStatus" NOT NULL DEFAULT 'PENDING',
    "results_published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle360_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle360_respondents" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "evaluator_id" TEXT NOT NULL,
    "role" "EvaluatorRole" NOT NULL,
    "status" "RespondentStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle360_respondents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle360_indicator_responses" (
    "id" TEXT NOT NULL,
    "respondent_id" TEXT NOT NULL,
    "indicator_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "cycle360_indicator_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle360_open_answers" (
    "id" TEXT NOT NULL,
    "respondent_id" TEXT NOT NULL,
    "strengths" TEXT,
    "to_change" TEXT,
    "to_develop" TEXT,

    CONSTRAINT "cycle360_open_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle360_conclusions" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "author_id" TEXT,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle360_conclusions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scale_templates_name_key" ON "scale_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cycle360_subjects_cycle_id_employee_id_key" ON "cycle360_subjects"("cycle_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle360_respondents_subject_id_evaluator_id_role_key" ON "cycle360_respondents"("subject_id", "evaluator_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "cycle360_indicator_responses_respondent_id_indicator_id_key" ON "cycle360_indicator_responses"("respondent_id", "indicator_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle360_open_answers_respondent_id_key" ON "cycle360_open_answers"("respondent_id");

-- AddForeignKey
ALTER TABLE "indicator_templates" ADD CONSTRAINT "indicator_templates_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competency_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scale_point_templates" ADD CONSTRAINT "scale_point_templates_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "scale_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360" ADD CONSTRAINT "cycle360_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_competencies" ADD CONSTRAINT "cycle360_competencies_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycle360"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_indicators" ADD CONSTRAINT "cycle360_indicators_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "cycle360_competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_scale_points" ADD CONSTRAINT "cycle360_scale_points_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycle360"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_subjects" ADD CONSTRAINT "cycle360_subjects_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycle360"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_subjects" ADD CONSTRAINT "cycle360_subjects_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_respondents" ADD CONSTRAINT "cycle360_respondents_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "cycle360_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_respondents" ADD CONSTRAINT "cycle360_respondents_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_indicator_responses" ADD CONSTRAINT "cycle360_indicator_responses_respondent_id_fkey" FOREIGN KEY ("respondent_id") REFERENCES "cycle360_respondents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_indicator_responses" ADD CONSTRAINT "cycle360_indicator_responses_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "cycle360_indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_open_answers" ADD CONSTRAINT "cycle360_open_answers_respondent_id_fkey" FOREIGN KEY ("respondent_id") REFERENCES "cycle360_respondents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_conclusions" ADD CONSTRAINT "cycle360_conclusions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "cycle360_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle360_conclusions" ADD CONSTRAINT "cycle360_conclusions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

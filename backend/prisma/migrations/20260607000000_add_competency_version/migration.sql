-- CreateTable
CREATE TABLE "competency_versions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_versions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "competency_templates" ADD COLUMN "version_id" TEXT;

-- AddForeignKey
ALTER TABLE "competency_templates" ADD CONSTRAINT "competency_templates_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "competency_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

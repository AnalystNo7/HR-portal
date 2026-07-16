-- CreateTable
CREATE TABLE "llm_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "base_url" TEXT,
    "api_key" TEXT,
    "model" TEXT,
    "temperature" DOUBLE PRECISION,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_settings_pkey" PRIMARY KEY ("id")
);

-- Именованные пресеты подключения LLM: имя и признак активного (несколько строк, активна одна)
ALTER TABLE "llm_settings" ADD COLUMN "name" TEXT;
ALTER TABLE "llm_settings" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT false;

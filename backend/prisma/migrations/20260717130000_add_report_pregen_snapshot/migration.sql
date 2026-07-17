-- Снимок состояния отчёта до последней генерации (для кнопки «Сброс»)
ALTER TABLE "cycle360_reports" ADD COLUMN "pre_gen_snapshot" JSONB;

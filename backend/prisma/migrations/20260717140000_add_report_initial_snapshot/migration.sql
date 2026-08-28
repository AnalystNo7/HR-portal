-- Снимок первоначального состояния отчёта (до всех генераций) для режима «Сброс до первоначального состояния»
ALTER TABLE "cycle360_reports" ADD COLUMN "initial_snapshot" JSONB;

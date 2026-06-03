-- Persist raw manager full name from import for later re-linking
ALTER TABLE "employees" ADD COLUMN "manager_fio" TEXT;

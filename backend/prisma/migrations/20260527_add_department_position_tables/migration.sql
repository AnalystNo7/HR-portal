-- Create lookup tables
CREATE TABLE "departments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

CREATE TABLE "positions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "positions_name_key" ON "positions"("name");

-- Populate from existing employee data
INSERT INTO "departments" ("id", "name", "created_at", "updated_at")
SELECT gen_random_uuid(), "department", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "employees"
GROUP BY "department";

INSERT INTO "positions" ("id", "name", "created_at", "updated_at")
SELECT gen_random_uuid(), "position", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "employees"
GROUP BY "position";

-- Add FK columns (nullable initially)
ALTER TABLE "employees" ADD COLUMN "department_id" TEXT;
ALTER TABLE "employees" ADD COLUMN "position_id" TEXT;

-- Populate FK columns from lookup tables
UPDATE "employees" SET "department_id" = d."id"
FROM "departments" d WHERE d."name" = "employees"."department";

UPDATE "employees" SET "position_id" = p."id"
FROM "positions" p WHERE p."name" = "employees"."position";

-- Make non-nullable and add foreign key constraints
ALTER TABLE "employees" ALTER COLUMN "department_id" SET NOT NULL;
ALTER TABLE "employees" ALTER COLUMN "position_id" SET NOT NULL;

ALTER TABLE "employees"
    ADD CONSTRAINT "employees_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employees"
    ADD CONSTRAINT "employees_position_id_fkey"
    FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old string columns
ALTER TABLE "employees" DROP COLUMN "department";
ALTER TABLE "employees" DROP COLUMN "position";

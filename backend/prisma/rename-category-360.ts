/**
 * Переименование категории компетенций «Управленческие компетенции» → «Компетенции».
 * Обновляет существующие записи в каталоге шаблонов и в снапшотах циклов. Idempotent.
 * Запуск: npm run db:rename:360cat
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD = 'Управленческие компетенции';
const NEW = 'Компетенции';

export async function renameCategory360(db: PrismaClient = prisma) {
  const tmpl = await db.competencyTemplate.updateMany({ where: { category: OLD }, data: { category: NEW } });
  const cycle = await db.cycle360Competency.updateMany({ where: { category: OLD }, data: { category: NEW } });
  return { templates: tmpl.count, cycleCompetencies: cycle.count };
}

if (require.main === module) {
  renameCategory360()
    .then(({ templates, cycleCompetencies }) => {
      console.log(`Категория переименована «${OLD}» → «${NEW}»: шаблонов=${templates}, компетенций циклов=${cycleCompetencies}.`);
    })
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
}

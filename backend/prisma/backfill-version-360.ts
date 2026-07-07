/**
 * Бэкфилл версий компетенций: гарантирует «Версию 1» (по умолчанию) и
 * привязывает к ней все компетенции без версии. Idempotent.
 * Запуск: npm run db:backfill:360ver
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function backfillVersion360(db: PrismaClient = prisma) {
  return db.$transaction(async tx => {
    let def = await tx.competencyVersion.findFirst({ where: { isDefault: true } });
    if (!def) {
      const earliest = await tx.competencyVersion.findFirst({ orderBy: { createdAt: 'asc' } });
      def = earliest
        ? await tx.competencyVersion.update({ where: { id: earliest.id }, data: { isDefault: true } })
        : await tx.competencyVersion.create({ data: { name: 'Версия 1', isDefault: true } });
    }
    const linked = await tx.competencyTemplate.updateMany({ where: { versionId: null }, data: { versionId: def.id } });
    return { version: def.name, linked: linked.count };
  });
}

const isMain = typeof require !== 'undefined' ? require.main === module : !process.argv[1] || process.argv[1].includes('backfill-version-360');
if (isMain) {
  backfillVersion360()
    .then(({ version, linked }) => {
      console.log(`Версия по умолчанию «${version}» готова, привязано компетенций=${linked}.`);
    })
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
}

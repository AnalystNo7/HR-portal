/**
 * Сквозная проверка бизнес-логики «Оценка 360» напрямую через сервисы (без HTTP/Keycloak).
 * Требуется поднятый Postgres и выполненный сид (npm run db:seed).
 * Запуск: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/verify-oc360.ts
 */
import { PrismaService } from '../src/prisma/prisma.service';
import { CycleService } from '../src/oc360/cycle/cycle.service';
import { TemplateService } from '../src/oc360/template/template.service';
import { RespondentService } from '../src/oc360/respondent/respondent.service';
import { ResultsService } from '../src/oc360/results/results.service';

const prisma = new PrismaService();
const template = new TemplateService(prisma);
const cycles = new CycleService(prisma);
const respondents = new RespondentService(prisma);
const results = new ResultsService(prisma);

let failures = 0;
function check(name: string, cond: boolean, extra?: any) {
  console.log(`${cond ? '✅' : '❌'} ${name}`, extra !== undefined ? JSON.stringify(extra) : '');
  if (!cond) failures++;
}

async function main() {
  await prisma.$connect();
  await prisma.cycle360.deleteMany({ where: { name: { startsWith: 'TEST-360' } } });

  const scale = await prisma.scaleTemplate.findFirstOrThrow({ where: { isDefault: true } });
  // ТН-002: руководитель ТН-001 + 4 коллеги по «Управление ИТ» (004,005,015,019), без подчинённых
  const subjectEmp = await prisma.employee.findUniqueOrThrow({ where: { personnelNumber: 'ТН-002' } });

  // 1. Создание + снапшот шаблона (число должно совпасть с активным шаблоном)
  const tplComps = await prisma.competencyTemplate.count({ where: { isActive: true } });
  const tplInds = await prisma.indicatorTemplate.count({ where: { competency: { isActive: true } } });
  const tplPoints = await prisma.scalePointTemplate.count({ where: { scaleId: scale.id } });
  const cycle = await cycles.create({ name: 'TEST-360 Q', scaleId: scale.id }, null);
  const compCount = await prisma.cycle360Competency.count({ where: { cycleId: cycle.id } });
  const indCount = await prisma.cycle360Indicator.count({ where: { competency: { cycleId: cycle.id } } });
  const spCount = await prisma.cycle360ScalePoint.count({ where: { cycleId: cycle.id } });
  check('Снапшот: компетенции/индикаторы/шкала скопированы', compCount === tplComps && indCount === tplInds && spCount === tplPoints, { compCount, indCount, spCount });
  // категория переносится в снапшот
  const snapWithCat = await prisma.cycle360Competency.count({ where: { cycleId: cycle.id, category: { not: '' } } });
  check('Снапшот переносит категорию компетенции', snapWithCat === compCount, { snapWithCat, compCount });

  // 2. Правка глобального шаблона не меняет снапшот
  const firstTemplateComp = await prisma.competencyTemplate.findFirstOrThrow({ orderBy: { order: 'asc' } });
  await template.updateCompetency(firstTemplateComp.id, { name: 'ИЗМЕНЕНО В ШАБЛОНЕ' });
  const snapNames = (await prisma.cycle360Competency.findMany({ where: { cycleId: cycle.id } })).map(c => c.name);
  check('Снапшот не зависит от правки шаблона', !snapNames.includes('ИЗМЕНЕНО В ШАБЛОНЕ'), snapNames);
  await template.updateCompetency(firstTemplateComp.id, { name: firstTemplateComp.name });

  // 3. Авто-подбор оценивающих
  const [subject] = await cycles.addSubjects(cycle.id, [subjectEmp.id]);
  const lanes = await cycles.getRespondents(cycle.id, subject.id);
  const byRole = Object.fromEntries(lanes.map(l => [l.role, l.respondents.length]));
  check('Авто-подбор: SELF=1', byRole.SELF === 1, byRole);
  check('Авто-подбор: MANAGER=1 (ТН-001)', byRole.MANAGER === 1, byRole);
  check('Авто-подбор: PEER=4 (коллеги по отделу)', byRole.PEER === 4, byRole);

  // 4. DRAFT-guard: после активации правка снапшота запрещена
  await cycles.activate(cycle.id);
  const snapComp = await prisma.cycle360Competency.findFirstOrThrow({ where: { cycleId: cycle.id } });
  let activateBlocked = false;
  try { await cycles.updateCompetency(cycle.id, snapComp.id, { name: 'после активации' }); } catch { activateBlocked = true; }
  check('После активации правка снапшота заблокирована', activateBlocked);

  // 5. Заполнение: SELF=5, остальные=3 → BLIND_SPOT
  const form = await respondents.getForm(lanes.find(l => l.role === 'SELF')!.respondents[0].id, subjectEmp.id, false);
  const indicatorIds = form.competencies.flatMap((c: any) => c.indicators.map((i: any) => i.id));
  const fill = (rid: string, score: number, evId: string) => respondents.submit(rid, evId, false, {
    scores: indicatorIds.map(id => ({ indicatorId: id, score })),
    openAnswer: { strengths: 'тест', toChange: 'тест', toDevelop: 'тест' }, submit: true,
  });
  await fill(lanes.find(l => l.role === 'SELF')!.respondents[0].id, 5, subjectEmp.id);
  for (const r of lanes.find(l => l.role === 'MANAGER')!.respondents) await fill(r.id, 3, r.evaluator.id);
  for (const r of lanes.find(l => l.role === 'PEER')!.respondents) await fill(r.id, 3, r.evaluator.id);

  // 6. Authz
  let forbidden = false;
  try { await respondents.getForm(lanes.find(l => l.role === 'SELF')!.respondents[0].id, 'someone-else', false); } catch { forbidden = true; }
  check('Authz: чужой не получает форму', forbidden);

  // 7. Результаты: gap и зоны
  const res = await results.getResults(cycle.id, subject.id);
  const c0 = res.competencyResults[0];
  check('Результаты: self=5, others=3, gap=2', c0.self === 5 && c0.othersAvg === 3 && c0.gap === 2, c0);
  check('Результаты: зона BLIND_SPOT', c0.zone === 'BLIND_SPOT');
  check('Результаты: total (итоговая) = среднее групп (5,3,3)→3.67', c0.total === 3.67, { total: c0.total });
  check('Результаты: категория присутствует', typeof c0.category === 'string' && c0.category.length > 0, { category: c0.category });

  // 8. Публикация и анонимность для сотрудника
  let beforePublish = false;
  try { await results.getMyResults(cycle.id, subject.id, subjectEmp.id); } catch { beforePublish = true; }
  check('До публикации my-results недоступны', beforePublish);
  await results.publish(cycle.id, subject.id);
  const mine = await results.getMyResults(cycle.id, subject.id, subjectEmp.id);
  const minePeer = mine.openAnswers.find((o: any) => o.role === 'PEER');
  check('После публикации сотрудник видит результаты', mine.competencyResults.length === compCount);
  check('Анонимность: автор PEER скрыт', (minePeer?.items ?? []).every((i: any) => i.author === null));

  await prisma.cycle360.deleteMany({ where: { name: { startsWith: 'TEST-360' } } });
  console.log(failures === 0 ? '\n🎉 Все проверки пройдены' : `\n⚠️  Провалено: ${failures}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });

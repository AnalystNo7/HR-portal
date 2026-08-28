/**
 * Сид шаблона «Оценка 360» — БЕЗ сотрудников (безопасно для боевой БД).
 * Заводит шкалу и дефолтный набор компетенций с индикаторами. Idempotent.
 * Запуск: npm run db:seed:360
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Утверждённая шкала компании; 0 — служебный пункт «нет наблюдения»,
// в расчёты не входит (NO_OBSERVATION_SCORE в oc360/results/analytics.ts)
const SCALE_NAME = 'Утверждённая 0–4';
const scalePoints = [
  { value: 0, label: 'Не могу оценить / не наблюдал ситуаций для проявления поведения' },
  { value: 1, label: 'Почти никогда не демонстрирует описанное поведение' },
  { value: 2, label: 'В некоторых рабочих ситуациях' },
  { value: 3, label: 'В большинстве рабочих ситуаций' },
  { value: 4, label: 'Во всех, даже в сверхсложных ситуациях' },
];

const competencies = [
  // ─── Ценности ───
  { category: 'Ценности', name: 'Ответственность за результат', description: null, indicators: [
    'Доводит задачи до результата, не перекладывая ответственность',
    'Признаёт свои ошибки и исправляет их',
    'Держит обещания и соблюдает договорённости',
  ]},
  { category: 'Ценности', name: 'Командная работа', description: null, indicators: [
    'Помогает коллегам и делится знаниями',
    'Ставит общий результат выше личных интересов',
    'Конструктивно участвует в совместной работе',
  ]},
  { category: 'Ценности', name: 'Открытый диалог', description: null, indicators: [
    'Открыто и честно высказывает свою позицию',
    'Даёт и принимает обратную связь без перехода на личности',
    'Слушает и учитывает мнение собеседника',
  ]},
  // ─── Компетенции ───
  { category: 'Компетенции', name: 'Проактивность', description: null, indicators: [
    'Проявляет инициативу, не дожидаясь указаний',
    'Предлагает улучшения и берётся за их реализацию',
    'Предвосхищает проблемы и действует на опережение',
  ]},
  { category: 'Компетенции', name: 'Гибкость и адаптивность', description: null, indicators: [
    'Быстро перестраивается при изменении условий',
    'Спокойно воспринимает изменения и новые задачи',
    'Подбирает подход под ситуацию и собеседника',
  ]},
  { category: 'Компетенции', name: 'Системное мышление', description: null, indicators: [
    'Видит связи между процессами и последствия решений',
    'Структурирует сложную информацию',
    'Учитывает влияние решения на смежные области',
  ]},
  { category: 'Компетенции', name: 'Стратегическое мышление', description: null, indicators: [
    'Соотносит текущие задачи с долгосрочными целями',
    'Видит картину целиком, а не только свой участок',
    'Расставляет приоритеты исходя из стратегии',
  ]},
  { category: 'Компетенции', name: 'Решение проблем', description: null, indicators: [
    'Выявляет причины проблем, а не только симптомы',
    'Предлагает работающие решения и доводит их до конца',
    'Принимает взвешенные решения в условиях неопределённости',
  ]},
  { category: 'Компетенции', name: 'Лидерство', description: null, indicators: [
    'Вдохновляет и мотивирует команду',
    'Чётко ставит цели и задаёт направление',
    'Развивает сотрудников и делегирует',
  ]},
];

export async function seedOc360(db: PrismaClient = prisma) {
  // Шкала (default ровно один — как в template.service)
  await db.scaleTemplate.updateMany({
    where: { name: { not: SCALE_NAME } },
    data: { isDefault: false },
  });
  const scale = await db.scaleTemplate.upsert({
    where: { name: SCALE_NAME },
    update: { isDefault: true },
    create: { name: SCALE_NAME, isDefault: true },
  });
  const existingPoints = await db.scalePointTemplate.count({ where: { scaleId: scale.id } });
  if (existingPoints === 0) {
    await db.scalePointTemplate.createMany({
      data: scalePoints.map(p => ({ scaleId: scale.id, value: p.value, label: p.label })),
    });
  }

  // Версия по умолчанию (набор компетенций)
  let version = await db.competencyVersion.findFirst({ where: { isDefault: true } });
  if (!version) {
    version = await db.competencyVersion.create({ data: { name: 'Версия 1', isDefault: true } });
  }

  // Компетенции с индикаторами (пропускаем уже существующие по имени)
  for (let i = 0; i < competencies.length; i++) {
    const c = competencies[i];
    const existing = await db.competencyTemplate.findFirst({ where: { name: c.name } });
    if (existing) continue;
    await db.competencyTemplate.create({
      data: {
        versionId: version.id,
        name: c.name,
        description: c.description,
        category: c.category,
        order: i,
        indicators: { create: c.indicators.map((text, idx) => ({ text, order: idx })) },
      },
    });
  }

  // Подцепить компетенции без версии (ранее засеянные)
  await db.competencyTemplate.updateMany({ where: { versionId: null }, data: { versionId: version.id } });
}

// Standalone-запуск (без сотрудников)
const isMain = typeof require !== 'undefined' ? require.main === module : !process.argv[1] || process.argv[1].includes('seed-oc360');
if (isMain) {
  seedOc360()
    .then(async () => {
      const comps = await prisma.competencyTemplate.count();
      const scales = await prisma.scaleTemplate.count();
      console.log(`Шаблон 360 готов: компетенций=${comps}, шкал=${scales}. Сотрудники не затронуты.`);
    })
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
}

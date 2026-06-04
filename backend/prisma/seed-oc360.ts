/**
 * Сид шаблона «Оценка 360» — БЕЗ сотрудников (безопасно для боевой БД).
 * Заводит шкалу и дефолтный набор компетенций с индикаторами. Idempotent.
 * Запуск: npm run db:seed:360
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SCALE_NAME = 'Стандартная 1–5';
const scalePoints = [
  { value: 1, label: 'Не проявляется' },
  { value: 2, label: 'Проявляется редко' },
  { value: 3, label: 'Проявляется чаще всего' },
  { value: 4, label: 'Проявляется стабильно' },
  { value: 5, label: 'Эталон' },
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
  // ─── Управленческие компетенции ───
  { category: 'Управленческие компетенции', name: 'Проактивность', description: null, indicators: [
    'Проявляет инициативу, не дожидаясь указаний',
    'Предлагает улучшения и берётся за их реализацию',
    'Предвосхищает проблемы и действует на опережение',
  ]},
  { category: 'Управленческие компетенции', name: 'Гибкость и адаптивность', description: null, indicators: [
    'Быстро перестраивается при изменении условий',
    'Спокойно воспринимает изменения и новые задачи',
    'Подбирает подход под ситуацию и собеседника',
  ]},
  { category: 'Управленческие компетенции', name: 'Системное мышление', description: null, indicators: [
    'Видит связи между процессами и последствия решений',
    'Структурирует сложную информацию',
    'Учитывает влияние решения на смежные области',
  ]},
  { category: 'Управленческие компетенции', name: 'Стратегическое мышление', description: null, indicators: [
    'Соотносит текущие задачи с долгосрочными целями',
    'Видит картину целиком, а не только свой участок',
    'Расставляет приоритеты исходя из стратегии',
  ]},
  { category: 'Управленческие компетенции', name: 'Решение проблем', description: null, indicators: [
    'Выявляет причины проблем, а не только симптомы',
    'Предлагает работающие решения и доводит их до конца',
    'Принимает взвешенные решения в условиях неопределённости',
  ]},
  { category: 'Управленческие компетенции', name: 'Лидерство', description: null, indicators: [
    'Вдохновляет и мотивирует команду',
    'Чётко ставит цели и задаёт направление',
    'Развивает сотрудников и делегирует',
  ]},
];

export async function seedOc360(db: PrismaClient = prisma) {
  // Шкала
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

  // Компетенции с индикаторами (пропускаем уже существующие по имени)
  for (let i = 0; i < competencies.length; i++) {
    const c = competencies[i];
    const existing = await db.competencyTemplate.findFirst({ where: { name: c.name } });
    if (existing) continue;
    await db.competencyTemplate.create({
      data: {
        name: c.name,
        description: c.description,
        category: c.category,
        order: i,
        indicators: { create: c.indicators.map((text, idx) => ({ text, order: idx })) },
      },
    });
  }
}

// Standalone-запуск (без сотрудников)
if (require.main === module) {
  seedOc360()
    .then(async () => {
      const comps = await prisma.competencyTemplate.count();
      const scales = await prisma.scaleTemplate.count();
      console.log(`Шаблон 360 готов: компетенций=${comps}, шкал=${scales}. Сотрудники не затронуты.`);
    })
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
}

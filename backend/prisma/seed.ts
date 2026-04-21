import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const employees = [
  { personnelNumber: 'ТН-001', lastName: 'Козлов', firstName: 'Сергей', middleName: 'Владимирович', email: 'kozlov.sv@gazprom-cps.ru', position: 'Начальник управления', department: 'Управление ИТ', hireDate: new Date('2018-03-15') },
  { personnelNumber: 'ТН-002', lastName: 'Петров', firstName: 'Александр', middleName: 'Иванович', email: 'petrov.ai@gazprom-cps.ru', position: 'Ведущий инженер-программист', department: 'Управление ИТ', hireDate: new Date('2019-07-01') },
  { personnelNumber: 'ТН-003', lastName: 'Сидорова', firstName: 'Елена', middleName: 'Петровна', email: 'sidorova.ep@gazprom-cps.ru', position: 'HR-специалист', department: 'Управление персоналом', hireDate: new Date('2017-09-10') },
  { personnelNumber: 'ТН-004', lastName: 'Иванов', firstName: 'Дмитрий', middleName: 'Сергеевич', email: 'ivanov.ds@gazprom-cps.ru', position: 'Инженер-программист', department: 'Управление ИТ', hireDate: new Date('2020-02-20') },
  { personnelNumber: 'ТН-005', lastName: 'Кузнецова', firstName: 'Мария', middleName: 'Андреевна', email: 'kuznetsova.ma@gazprom-cps.ru', position: 'Аналитик', department: 'Управление ИТ', hireDate: new Date('2021-04-12') },
  { personnelNumber: 'ТН-006', lastName: 'Новиков', firstName: 'Андрей', middleName: 'Викторович', email: 'novikov.av@gazprom-cps.ru', position: 'Начальник отдела', department: 'Финансовый отдел', hireDate: new Date('2016-11-05') },
  { personnelNumber: 'ТН-007', lastName: 'Морозова', firstName: 'Ольга', middleName: 'Николаевна', email: 'morozova.on@gazprom-cps.ru', position: 'Бухгалтер', department: 'Финансовый отдел', hireDate: new Date('2019-01-14') },
  { personnelNumber: 'ТН-008', lastName: 'Волков', firstName: 'Игорь', middleName: 'Алексеевич', email: 'volkov.ia@gazprom-cps.ru', position: 'Экономист', department: 'Финансовый отдел', hireDate: new Date('2020-08-22') },
  { personnelNumber: 'ТН-009', lastName: 'Соколов', firstName: 'Павел', middleName: 'Дмитриевич', email: 'sokolov.pd@gazprom-cps.ru', position: 'Начальник отдела', department: 'Юридический отдел', hireDate: new Date('2015-06-30') },
  { personnelNumber: 'ТН-010', lastName: 'Лебедева', firstName: 'Анна', middleName: 'Олеговна', email: 'lebedeva.ao@gazprom-cps.ru', position: 'Юрист', department: 'Юридический отдел', hireDate: new Date('2021-10-03') },
  { personnelNumber: 'ТН-011', lastName: 'Егоров', firstName: 'Максим', middleName: 'Петрович', email: 'egorov.mp@gazprom-cps.ru', position: 'Начальник управления', department: 'Производственное управление', hireDate: new Date('2014-02-17') },
  { personnelNumber: 'ТН-012', lastName: 'Павлова', firstName: 'Татьяна', middleName: 'Ивановна', email: 'pavlova.ti@gazprom-cps.ru', position: 'Инженер-технолог', department: 'Производственное управление', hireDate: new Date('2018-05-21') },
  { personnelNumber: 'ТН-013', lastName: 'Семёнов', firstName: 'Артём', middleName: 'Михайлович', email: 'semenov.am@gazprom-cps.ru', position: 'Инженер', department: 'Производственное управление', hireDate: new Date('2022-01-10') },
  { personnelNumber: 'ТН-014', lastName: 'Голубева', firstName: 'Наталья', middleName: 'Сергеевна', email: 'golubeva.ns@gazprom-cps.ru', position: 'Специалист по охране труда', department: 'Отдел охраны труда', hireDate: new Date('2019-11-28') },
  { personnelNumber: 'ТН-015', lastName: 'Виноградов', firstName: 'Роман', middleName: 'Андреевич', email: 'vinogradov.ra@gazprom-cps.ru', position: 'Системный администратор', department: 'Управление ИТ', hireDate: new Date('2020-06-15') },
  { personnelNumber: 'ТН-016', lastName: 'Богданова', firstName: 'Ирина', middleName: 'Владимировна', email: 'bogdanova.iv@gazprom-cps.ru', position: 'HR-менеджер', department: 'Управление персоналом', hireDate: new Date('2018-04-09') },
  { personnelNumber: 'ТН-017', lastName: 'Воробьёв', firstName: 'Кирилл', middleName: 'Евгеньевич', email: 'vorobev.ke@gazprom-cps.ru', position: 'Инженер по эксплуатации', department: 'Производственное управление', hireDate: new Date('2021-03-22') },
  { personnelNumber: 'ТН-018', lastName: 'Фёдорова', firstName: 'Светлана', middleName: 'Александровна', email: 'fedorova.sa@gazprom-cps.ru', position: 'Специалист по обучению', department: 'Управление персоналом', hireDate: new Date('2020-09-01') },
  { personnelNumber: 'ТН-019', lastName: 'Михайлов', firstName: 'Владислав', middleName: 'Игоревич', email: 'mikhailov.vi@gazprom-cps.ru', position: 'Тестировщик', department: 'Управление ИТ', hireDate: new Date('2022-07-18') },
  { personnelNumber: 'ТН-020', lastName: 'Орлова', firstName: 'Екатерина', middleName: 'Дмитриевна', email: 'orlova.ed@gazprom-cps.ru', position: 'Делопроизводитель', department: 'Административный отдел', hireDate: new Date('2023-02-14') },
];

const managerMap: Record<string, string> = {
  'ТН-002': 'ТН-001',
  'ТН-004': 'ТН-001',
  'ТН-005': 'ТН-001',
  'ТН-015': 'ТН-001',
  'ТН-019': 'ТН-001',
  'ТН-007': 'ТН-006',
  'ТН-008': 'ТН-006',
  'ТН-010': 'ТН-009',
  'ТН-012': 'ТН-011',
  'ТН-013': 'ТН-011',
  'ТН-017': 'ТН-011',
  'ТН-016': 'ТН-003',
  'ТН-018': 'ТН-003',
};

async function main() {
  console.log('Seed: upsert employees...');

  for (const e of employees) {
    await prisma.employee.upsert({
      where: { personnelNumber: e.personnelNumber },
      update: e,
      create: e,
    });
  }

  console.log('Seed: set managers...');
  for (const [personnelNumber, managerPn] of Object.entries(managerMap)) {
    const manager = await prisma.employee.findUnique({ where: { personnelNumber: managerPn } });
    if (!manager) continue;
    await prisma.employee.update({
      where: { personnelNumber },
      data: { managerId: manager.id },
    });
  }

  const total = await prisma.employee.count();
  console.log(`Seed done. Total employees: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

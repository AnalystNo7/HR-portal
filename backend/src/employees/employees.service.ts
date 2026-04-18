import { Injectable } from '@nestjs/common';

export interface Employee {
  id: string;
  personnelNumber: string;
  lastName: string;
  firstName: string;
  middleName: string;
  email: string;
  position: string;
  department: string;
  hireDate: string;
  managerId: string | null;
  photoUrl: string | null;
}

export interface EmployeeListQuery {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  managerId?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const mockEmployees: Employee[] = [
  {
    id: '1',
    personnelNumber: 'ТН-001',
    lastName: 'Козлов',
    firstName: 'Сергей',
    middleName: 'Владимирович',
    email: 'kozlov.sv@gazprom-cps.ru',
    position: 'Начальник управления',
    department: 'Управление ИТ',
    hireDate: '2018-03-15',
    managerId: null,
    photoUrl: null,
  },
  {
    id: '2',
    personnelNumber: 'ТН-002',
    lastName: 'Петров',
    firstName: 'Александр',
    middleName: 'Иванович',
    email: 'petrov.ai@gazprom-cps.ru',
    position: 'Ведущий инженер-программист',
    department: 'Управление ИТ',
    hireDate: '2019-07-01',
    managerId: '1',
    photoUrl: null,
  },
  {
    id: '3',
    personnelNumber: 'ТН-003',
    lastName: 'Сидорова',
    firstName: 'Елена',
    middleName: 'Петровна',
    email: 'sidorova.ep@gazprom-cps.ru',
    position: 'HR-специалист',
    department: 'Управление персоналом',
    hireDate: '2017-09-10',
    managerId: null,
    photoUrl: null,
  },
  {
    id: '4',
    personnelNumber: 'ТН-004',
    lastName: 'Иванов',
    firstName: 'Дмитрий',
    middleName: 'Сергеевич',
    email: 'ivanov.ds@gazprom-cps.ru',
    position: 'Инженер-программист',
    department: 'Управление ИТ',
    hireDate: '2020-02-20',
    managerId: '1',
    photoUrl: null,
  },
  {
    id: '5',
    personnelNumber: 'ТН-005',
    lastName: 'Кузнецова',
    firstName: 'Мария',
    middleName: 'Андреевна',
    email: 'kuznetsova.ma@gazprom-cps.ru',
    position: 'Аналитик',
    department: 'Управление ИТ',
    hireDate: '2021-04-12',
    managerId: '1',
    photoUrl: null,
  },
  {
    id: '6',
    personnelNumber: 'ТН-006',
    lastName: 'Новиков',
    firstName: 'Андрей',
    middleName: 'Викторович',
    email: 'novikov.av@gazprom-cps.ru',
    position: 'Начальник отдела',
    department: 'Финансовый отдел',
    hireDate: '2016-11-05',
    managerId: null,
    photoUrl: null,
  },
  {
    id: '7',
    personnelNumber: 'ТН-007',
    lastName: 'Морозова',
    firstName: 'Ольга',
    middleName: 'Николаевна',
    email: 'morozova.on@gazprom-cps.ru',
    position: 'Бухгалтер',
    department: 'Финансовый отдел',
    hireDate: '2019-01-14',
    managerId: '6',
    photoUrl: null,
  },
  {
    id: '8',
    personnelNumber: 'ТН-008',
    lastName: 'Волков',
    firstName: 'Игорь',
    middleName: 'Алексеевич',
    email: 'volkov.ia@gazprom-cps.ru',
    position: 'Экономист',
    department: 'Финансовый отдел',
    hireDate: '2020-08-22',
    managerId: '6',
    photoUrl: null,
  },
  {
    id: '9',
    personnelNumber: 'ТН-009',
    lastName: 'Соколов',
    firstName: 'Павел',
    middleName: 'Дмитриевич',
    email: 'sokolov.pd@gazprom-cps.ru',
    position: 'Начальник отдела',
    department: 'Юридический отдел',
    hireDate: '2015-06-30',
    managerId: null,
    photoUrl: null,
  },
  {
    id: '10',
    personnelNumber: 'ТН-010',
    lastName: 'Лебедева',
    firstName: 'Анна',
    middleName: 'Олеговна',
    email: 'lebedeva.ao@gazprom-cps.ru',
    position: 'Юрист',
    department: 'Юридический отдел',
    hireDate: '2021-10-03',
    managerId: '9',
    photoUrl: null,
  },
  {
    id: '11',
    personnelNumber: 'ТН-011',
    lastName: 'Егоров',
    firstName: 'Максим',
    middleName: 'Петрович',
    email: 'egorov.mp@gazprom-cps.ru',
    position: 'Начальник управления',
    department: 'Производственное управление',
    hireDate: '2014-02-17',
    managerId: null,
    photoUrl: null,
  },
  {
    id: '12',
    personnelNumber: 'ТН-012',
    lastName: 'Павлова',
    firstName: 'Татьяна',
    middleName: 'Ивановна',
    email: 'pavlova.ti@gazprom-cps.ru',
    position: 'Инженер-технолог',
    department: 'Производственное управление',
    hireDate: '2018-05-21',
    managerId: '11',
    photoUrl: null,
  },
  {
    id: '13',
    personnelNumber: 'ТН-013',
    lastName: 'Семёнов',
    firstName: 'Артём',
    middleName: 'Михайлович',
    email: 'semenov.am@gazprom-cps.ru',
    position: 'Инженер',
    department: 'Производственное управление',
    hireDate: '2022-01-10',
    managerId: '11',
    photoUrl: null,
  },
  {
    id: '14',
    personnelNumber: 'ТН-014',
    lastName: 'Голубева',
    firstName: 'Наталья',
    middleName: 'Сергеевна',
    email: 'golubeva.ns@gazprom-cps.ru',
    position: 'Специалист по охране труда',
    department: 'Отдел охраны труда',
    hireDate: '2019-11-28',
    managerId: null,
    photoUrl: null,
  },
  {
    id: '15',
    personnelNumber: 'ТН-015',
    lastName: 'Виноградов',
    firstName: 'Роман',
    middleName: 'Андреевич',
    email: 'vinogradov.ra@gazprom-cps.ru',
    position: 'Системный администратор',
    department: 'Управление ИТ',
    hireDate: '2020-06-15',
    managerId: '1',
    photoUrl: null,
  },
  {
    id: '16',
    personnelNumber: 'ТН-016',
    lastName: 'Богданова',
    firstName: 'Ирина',
    middleName: 'Владимировна',
    email: 'bogdanova.iv@gazprom-cps.ru',
    position: 'HR-менеджер',
    department: 'Управление персоналом',
    hireDate: '2018-04-09',
    managerId: '3',
    photoUrl: null,
  },
  {
    id: '17',
    personnelNumber: 'ТН-017',
    lastName: 'Воробьёв',
    firstName: 'Кирилл',
    middleName: 'Евгеньевич',
    email: 'vorobev.ke@gazprom-cps.ru',
    position: 'Инженер по эксплуатации',
    department: 'Производственное управление',
    hireDate: '2021-03-22',
    managerId: '11',
    photoUrl: null,
  },
  {
    id: '18',
    personnelNumber: 'ТН-018',
    lastName: 'Фёдорова',
    firstName: 'Светлана',
    middleName: 'Александровна',
    email: 'fedorova.sa@gazprom-cps.ru',
    position: 'Специалист по обучению',
    department: 'Управление персоналом',
    hireDate: '2020-09-01',
    managerId: '3',
    photoUrl: null,
  },
  {
    id: '19',
    personnelNumber: 'ТН-019',
    lastName: 'Михайлов',
    firstName: 'Владислав',
    middleName: 'Игоревич',
    email: 'mikhailov.vi@gazprom-cps.ru',
    position: 'Тестировщик',
    department: 'Управление ИТ',
    hireDate: '2022-07-18',
    managerId: '1',
    photoUrl: null,
  },
  {
    id: '20',
    personnelNumber: 'ТН-020',
    lastName: 'Орлова',
    firstName: 'Екатерина',
    middleName: 'Дмитриевна',
    email: 'orlova.ed@gazprom-cps.ru',
    position: 'Делопроизводитель',
    department: 'Административный отдел',
    hireDate: '2023-02-14',
    managerId: null,
    photoUrl: null,
  },
];

@Injectable()
export class EmployeesService {
  private employees = mockEmployees;

  findAll(query: EmployeeListQuery): PaginatedResult<Employee> {
    const {
      page = 1,
      limit = 10,
      search,
      department,
      managerId,
      sortField = 'lastName',
      sortOrder = 'asc',
    } = query;

    let filtered = [...this.employees];

    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.lastName.toLowerCase().includes(s) ||
          e.firstName.toLowerCase().includes(s) ||
          e.middleName.toLowerCase().includes(s) ||
          e.email.toLowerCase().includes(s) ||
          e.position.toLowerCase().includes(s),
      );
    }

    if (department) {
      filtered = filtered.filter((e) => e.department === department);
    }

    if (managerId) {
      filtered = filtered.filter((e) => e.managerId === managerId);
    }

    const field = sortField as keyof Employee;
    filtered.sort((a, b) => {
      const cmp = String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'ru');
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return { data, total, page, limit, totalPages };
  }

  findById(id: string): Employee | undefined {
    return this.employees.find((e) => e.id === id);
  }

  getDepartments(): string[] {
    return [...new Set(this.employees.map((e) => e.department))].sort();
  }
}

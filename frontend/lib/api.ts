const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error: ${res.status} ${res.statusText}. ${body}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface Employee {
  id: string;
  personnelNumber: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  email: string;
  position: string;
  department: string;
  hireDate: string | null;
  managerId: string | null;
  photoUrl: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EmployeeQuery {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  managerId?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export function getEmployees(query: EmployeeQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v));
  });
  return fetchApi<PaginatedResult<Employee>>(`/employees?${params.toString()}`);
}

export function getDepartments() {
  return fetchApi<string[]>('/employees/departments');
}

export interface Me extends Employee {
  role: 'employee' | 'manager' | 'hr';
}

export function getMe(role: 'employee' | 'manager' | 'hr') {
  return fetchApi<Me>(`/me?role=${role}`);
}

export function getEmployeeById(id: string) {
  return fetchApi<Employee & {
    workExperiences: WorkExperience[];
    educations: Education[];
  }>(`/employees/${id}`);
}

export interface WorkExperience {
  id: string;
  employeeId: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
}

export interface WorkExperienceInput {
  company: string;
  position: string;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string | null;
}

export function listWorkExperiences(employeeId: string) {
  return fetchApi<WorkExperience[]>(`/employees/${employeeId}/work-experiences`);
}

export function createWorkExperience(employeeId: string, dto: WorkExperienceInput) {
  return fetchApi<WorkExperience>(`/employees/${employeeId}/work-experiences`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateWorkExperience(employeeId: string, id: string, dto: WorkExperienceInput) {
  return fetchApi<WorkExperience>(`/employees/${employeeId}/work-experiences/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export function deleteWorkExperience(employeeId: string, id: string) {
  return fetchApi<{ success: boolean }>(`/employees/${employeeId}/work-experiences/${id}`, {
    method: 'DELETE',
  });
}

export interface Education {
  id: string;
  employeeId: string;
  institution: string;
  specialization: string | null;
  level: string;
  yearCompleted: number | null;
  type: 'BASIC' | 'ADDITIONAL';
}

export interface EducationInput {
  institution: string;
  specialization?: string | null;
  level: string;
  yearCompleted?: number | null;
  type?: 'BASIC' | 'ADDITIONAL';
}

export function listEducations(employeeId: string) {
  return fetchApi<Education[]>(`/employees/${employeeId}/educations`);
}

export function createEducation(employeeId: string, dto: EducationInput) {
  return fetchApi<Education>(`/employees/${employeeId}/educations`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateEducation(employeeId: string, id: string, dto: EducationInput) {
  return fetchApi<Education>(`/employees/${employeeId}/educations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export function deleteEducation(employeeId: string, id: string) {
  return fetchApi<{ success: boolean }>(`/employees/${employeeId}/educations/${id}`, {
    method: 'DELETE',
  });
}

export type AppealStatus = 'NEW' | 'IN_PROGRESS' | 'NEEDS_CLARIFICATION' | 'RESOLVED' | 'CLOSED';

export interface Appeal {
  id: string;
  number: number;
  direction: string;
  subject: string;
  text: string;
  status: AppealStatus;
  isAnonymous: boolean;
  authorId: string | null;
  author?: { id: string; firstName: string; lastName: string; middleName: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppealComment {
  id: string;
  appealId: string;
  authorId: string;
  text: string;
  createdAt: string;
  author?: { id: string; firstName: string; lastName: string; middleName: string | null };
}

export interface CreateAppealInput {
  authorId?: string | null;
  direction: string;
  subject: string;
  text: string;
  isAnonymous?: boolean;
}

export function listAppeals(params: { authorId?: string; status?: AppealStatus; direction?: string } = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  return fetchApi<PaginatedResult<Appeal>>(`/appeals?${qs.toString()}`);
}

export function getAppealById(id: string) {
  return fetchApi<Appeal & { comments: AppealComment[] }>(`/appeals/${id}`);
}

export function createAppeal(dto: CreateAppealInput) {
  return fetchApi<Appeal>('/appeals', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateAppealStatus(id: string, status: AppealStatus) {
  return fetchApi<Appeal>(`/appeals/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function addAppealComment(id: string, dto: { authorId: string; text: string }) {
  return fetchApi<AppealComment>(`/appeals/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

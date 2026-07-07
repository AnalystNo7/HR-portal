import { getToken } from './keycloak';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? getToken() : undefined;
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let message = body;
    try {
      const parsed = JSON.parse(body);
      if (parsed?.message) message = Array.isArray(parsed.message) ? parsed.message.join('; ') : parsed.message;
    } catch { /* not JSON, keep raw body */ }
    throw new Error(message || `${res.status} ${res.statusText}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface Department {
  id: string;
  name: string;
}

export interface Position {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  personnelNumber: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  email: string;
  departmentId: string;
  positionId: string;
  department: Department;
  position: Position;
  hireDate: string | null;
  managerId: string | null;
  managerFio: string | null;
  manager?: { id: string; lastName: string; firstName: string; middleName: string | null } | null;
  photoUrl: string | null;
  keycloakId: string | null;
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
  role: 'employee' | 'manager' | 'hr' | 'admin';
}

export function getMe(role: 'employee' | 'manager' | 'hr' | 'admin') {
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

// Import

export interface ImportPreviewRow {
  rowNum: number;
  personnelNumber: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  email: string;
  position: string;
  department: string;
  hireDate: string | null;
  managerFio: string | null;
  errors: string[];
}

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: { row: number; personnelNumber: string; error: string }[];
  managerLinked: number;
  managerNotFound: { row: number; personnelNumber: string; managerFio: string }[];
  managerAmbiguous: { row: number; personnelNumber: string; managerFio: string }[];
  managersRoleAssigned: number;
  keycloakCreated: number;
  keycloakSkipped: number;
  keycloakErrors: { personnelNumber: string; error: string }[];
}

export interface ManagerMappingEntry {
  manager: Employee;
  candidates: { employee: Employee; checked: boolean }[];
}

export function getManagerMapping(managerId?: string) {
  const q = managerId ? `?managerId=${managerId}` : '';
  return fetchApi<ManagerMappingEntry[]>(`/employees/manager-mapping${q}`);
}

export function applyManagerMapping(entries: { managerId: string; subordinateIds: string[] }[]) {
  return fetchApi<{ success: boolean }>('/employees/manager-mapping', {
    method: 'POST',
    body: JSON.stringify({ entries }),
  });
}

function uploadFile<T>(path: string, file: File): Promise<T> {
  const token = typeof window !== 'undefined' ? getToken() : undefined;
  const formData = new FormData();
  formData.append('file', file);

  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(async res => {
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API error: ${res.status} ${res.statusText}. ${body}`);
    }
    return res.json();
  });
}

export function previewImport(file: File) {
  return uploadFile<ImportPreviewRow[]>('/import/preview', file);
}

export function executeImport(file: File) {
  return uploadFile<ImportResult>('/import/execute', file);
}

// Employee CRUD

export interface CreateEmployeeInput {
  personnelNumber: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  email: string;
  departmentId: string;
  positionId: string;
  hireDate?: string;
  managerId?: string;
}

export function createEmployee(dto: CreateEmployeeInput) {
  return fetchApi<Employee>('/employees', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateEmployee(id: string, dto: Partial<CreateEmployeeInput>) {
  return fetchApi<Employee>(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export function deleteEmployee(id: string, deleteKeycloak: boolean) {
  return fetchApi<{ success: boolean }>(`/employees/${id}?deleteKeycloak=${deleteKeycloak}`, {
    method: 'DELETE',
  });
}

export function resetEmployeePassword(id: string, password?: string) {
  return fetchApi<{ created: boolean; keycloakId?: string }>(`/employees/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(password ? { password } : {}),
  });
}

// Departments CRUD

export function getDepartmentsList() {
  return fetchApi<Department[]>('/departments');
}

export function createDepartment(dto: { name: string }) {
  return fetchApi<Department>('/departments', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateDepartment(id: string, dto: { name: string }) {
  return fetchApi<Department>(`/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export function deleteDepartment(id: string) {
  return fetchApi<{ success: boolean }>(`/departments/${id}`, {
    method: 'DELETE',
  });
}

// Positions CRUD

export function getPositionsList() {
  return fetchApi<Position[]>('/positions');
}

export function createPosition(dto: { name: string }) {
  return fetchApi<Position>('/positions', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updatePosition(id: string, dto: { name: string }) {
  return fetchApi<Position>(`/positions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export function deletePosition(id: string) {
  return fetchApi<{ success: boolean }>(`/positions/${id}`, {
    method: 'DELETE',
  });
}

// ─── Оценка 360 ────────────────────────────────────────

export type EvaluatorRole = 'SELF' | 'MANAGER' | 'SUBORDINATE' | 'PEER';
export type Cycle360Status = 'DRAFT' | 'ACTIVE' | 'CLOSED';
export type SubjectStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PUBLISHED';
export type RespondentStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type EvalZone = 'CONSENSUS' | 'BLIND_SPOT' | 'HIDDEN_POTENTIAL' | null;

export interface IndicatorTpl { id: string; competencyId: string; text: string; order: number; }
export interface CompetencyTpl { id: string; versionId: string | null; name: string; description: string | null; category: string; order: number; isActive: boolean; indicators: IndicatorTpl[]; }
export interface CompetencyVersion { id: string; name: string; isDefault: boolean; _count?: { competencies: number }; }
export interface ScalePoint { id?: string; value: number; label: string; }
export interface ScaleTpl { id: string; name: string; isDefault: boolean; points: ScalePoint[]; }

export interface PersonRef { id: string; firstName: string; lastName: string; middleName: string | null; }

export interface Cycle360ListItem {
  id: string; name: string; description: string | null; year: number | null; half: number | null; status: Cycle360Status;
  startedAt: string | null; closedAt: string | null; createdAt: string;
  _count: { subjects: number };
  departments: string[];
}

export const halfLabel = (h: number | null) => h === 1 ? '1 полугодие' : h === 2 ? '2 полугодие' : '';

export interface Cycle360Competency { id: string; name: string; description: string | null; category: string; order: number; indicators: { id: string; text: string; order: number }[]; }
export interface Cycle360SubjectSummary {
  id: string; status: SubjectStatus; resultsPublishedAt: string | null;
  managerEditsPeers: boolean;
  employee: PersonRef;
  respondents: { id: string; role: EvaluatorRole; status: RespondentStatus }[];
}
export interface Cycle360Detail {
  id: string; name: string; description: string | null; year: number | null; half: number | null; status: Cycle360Status;
  competencies: Cycle360Competency[];
  scalePoints: ScalePoint[];
  subjects: Cycle360SubjectSummary[];
}

export interface RespondentLane {
  role: EvaluatorRole; label: string;
  respondents: { id: string; status: RespondentStatus; name: string; evaluator: PersonRef }[];
}

export interface WorkflowLane { role: EvaluatorRole; label: string; items: { id: string; name: string; status: RespondentStatus }[]; completed: number; total: number; done: boolean; }
export interface Workflow {
  subject: { id: string; employee: PersonRef; name: string; status: SubjectStatus };
  cycleStatus: Cycle360Status; stage: 'DRAFT' | 'IN_PROGRESS' | 'RESULTS';
  published: boolean; managerEditsPeers: boolean; lanes: WorkflowLane[];
}

export interface Assignment {
  id: string; role: EvaluatorRole; roleLabel: string; status: RespondentStatus;
  cycle: { id: string; name: string }; subject: { id: string; name: string };
  subjectId: string; managerEditsPeers: boolean; peersConfirmed: boolean; isSelf: boolean;
}
export interface PeerRespondent { id: string; evaluator: PersonRef; name: string; status: RespondentStatus; }
export interface AssignmentForm {
  id: string; role: EvaluatorRole; roleLabel: string; status: RespondentStatus;
  cycle: { id: string; name: string }; subject: { id: string; name: string };
  competencies: Cycle360Competency[]; scalePoints: ScalePoint[];
  scores: Record<string, number>;
  openAnswer: { strengths: string | null; toChange: string | null; toDevelop: string | null };
}
export interface SubmitAssignmentDto {
  scores: { indicatorId: string; score: number }[];
  openAnswer?: { strengths?: string | null; toChange?: string | null; toDevelop?: string | null };
  submit?: boolean;
  employeeId?: string;
}

export interface CompetencyResult {
  id: string; name: string; category: string;
  self: number | null; manager: number | null; peers: number | null; subordinates: number | null;
  othersAvg: number | null; total: number | null; gap: number | null; zone: EvalZone;
}
export interface OpenAnswerGroup { role: EvaluatorRole; items: { author: string | null; strengths: string | null; toChange: string | null; toDevelop: string | null }[]; }
export interface Results360 {
  subject: { id: string; employee: PersonRef; name: string; status: SubjectStatus };
  published: boolean;
  scalePoints: ScalePoint[];
  competencyResults: CompetencyResult[];
  overall: { selfAvg: number | null; othersAvg: number | null; gap: number | null };
  openAnswers: OpenAnswerGroup[];
  progress: { role: EvaluatorRole; completed: number; total: number }[];
  conclusions: { id: string; text: string; createdAt: string; author?: string | null }[];
}
export interface Conclusion360 { id: string; text: string; createdAt: string; author?: { firstName: string; lastName: string; middleName: string | null } | null; }
export interface MySubject360 { subjectId: string; cycle: { id: string; name: string }; publishedAt: string | null; }

// Template — versions
export const get360Versions = () => fetchApi<CompetencyVersion[]>('/oc360/template/versions');
export const create360Version = (dto: { name: string; sourceVersionId?: string; isDefault?: boolean }) => fetchApi<CompetencyVersion>('/oc360/template/versions', { method: 'POST', body: JSON.stringify(dto) });
export const update360Version = (id: string, dto: { name?: string; isDefault?: boolean }) => fetchApi<CompetencyVersion>(`/oc360/template/versions/${id}`, { method: 'PUT', body: JSON.stringify(dto) });
export const delete360Version = (id: string) => fetchApi<{ success: boolean }>(`/oc360/template/versions/${id}`, { method: 'DELETE' });

// Template
export const get360Competencies = (versionId?: string) => fetchApi<CompetencyTpl[]>('/oc360/template/competencies' + (versionId ? `?versionId=${versionId}` : ''));
export const create360Competency = (dto: { name: string; description?: string | null; category?: string; order?: number; isActive?: boolean; versionId?: string }) => fetchApi<CompetencyTpl>('/oc360/template/competencies', { method: 'POST', body: JSON.stringify(dto) });
export const update360Competency = (id: string, dto: { name?: string; description?: string | null; category?: string; order?: number; isActive?: boolean }) => fetchApi<CompetencyTpl>(`/oc360/template/competencies/${id}`, { method: 'PUT', body: JSON.stringify(dto) });
export const delete360Competency = (id: string) => fetchApi<{ success: boolean }>(`/oc360/template/competencies/${id}`, { method: 'DELETE' });
export const add360Indicator = (competencyId: string, dto: { text: string; order?: number }) => fetchApi<IndicatorTpl>(`/oc360/template/competencies/${competencyId}/indicators`, { method: 'POST', body: JSON.stringify(dto) });
export const update360Indicator = (id: string, dto: { text?: string; order?: number }) => fetchApi<IndicatorTpl>(`/oc360/template/indicators/${id}`, { method: 'PUT', body: JSON.stringify(dto) });
export const delete360Indicator = (id: string) => fetchApi<{ success: boolean }>(`/oc360/template/indicators/${id}`, { method: 'DELETE' });
export const get360Scales = () => fetchApi<ScaleTpl[]>('/oc360/template/scales');
export const create360Scale = (dto: { name: string; isDefault?: boolean; points: ScalePoint[] }) => fetchApi<ScaleTpl>('/oc360/template/scales', { method: 'POST', body: JSON.stringify(dto) });
export const update360Scale = (id: string, dto: { name?: string; isDefault?: boolean; points?: ScalePoint[] }) => fetchApi<ScaleTpl>(`/oc360/template/scales/${id}`, { method: 'PUT', body: JSON.stringify(dto) });
export const delete360Scale = (id: string) => fetchApi<{ success: boolean }>(`/oc360/template/scales/${id}`, { method: 'DELETE' });

// Cycles
export function get360Cycles(query: { status?: Cycle360Status; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
  return fetchApi<PaginatedResult<Cycle360ListItem>>(`/oc360/cycles?${qs.toString()}`);
}
export const get360Cycle = (id: string) => fetchApi<Cycle360Detail>(`/oc360/cycles/${id}`);
export const create360Cycle = (dto: { name: string; description?: string | null; year: number; half: number; scaleId: string; versionId?: string; competencyIds?: string[] }) => fetchApi<Cycle360Detail>('/oc360/cycles', { method: 'POST', body: JSON.stringify(dto) });
export const update360Cycle = (id: string, dto: { name?: string; description?: string | null; year?: number; half?: number }) => fetchApi<Cycle360Detail>(`/oc360/cycles/${id}`, { method: 'PUT', body: JSON.stringify(dto) });
export const delete360Cycle = (id: string) => fetchApi<{ success: boolean }>(`/oc360/cycles/${id}`, { method: 'DELETE' });
export const update360CycleCompetency = (id: string, cid: string, dto: { name?: string; description?: string | null; order?: number }) => fetchApi<unknown>(`/oc360/cycles/${id}/competencies/${cid}`, { method: 'PUT', body: JSON.stringify(dto) });
export const update360CycleIndicator = (id: string, iid: string, dto: { text?: string; order?: number }) => fetchApi<unknown>(`/oc360/cycles/${id}/indicators/${iid}`, { method: 'PUT', body: JSON.stringify(dto) });
export const add360Subjects = (id: string, employeeIds: string[]) => fetchApi<Cycle360SubjectSummary[]>(`/oc360/cycles/${id}/subjects`, { method: 'POST', body: JSON.stringify({ employeeIds }) });
export const update360Subject = (id: string, sid: string, dto: { managerEditsPeers?: boolean }) => fetchApi<unknown>(`/oc360/cycles/${id}/subjects/${sid}`, { method: 'PUT', body: JSON.stringify(dto) });
export const remove360Subject = (id: string, sid: string) => fetchApi<{ success: boolean }>(`/oc360/cycles/${id}/subjects/${sid}`, { method: 'DELETE' });
export const get360Respondents = (id: string, sid: string) => fetchApi<RespondentLane[]>(`/oc360/cycles/${id}/subjects/${sid}/respondents`);
export const add360Respondent = (id: string, sid: string, dto: { evaluatorId: string; role: EvaluatorRole }) => fetchApi<unknown>(`/oc360/cycles/${id}/subjects/${sid}/respondents`, { method: 'POST', body: JSON.stringify(dto) });
export const remove360Respondent = (id: string, rid: string) => fetchApi<{ success: boolean }>(`/oc360/cycles/${id}/respondents/${rid}`, { method: 'DELETE' });
export const activate360Cycle = (id: string) => fetchApi<Cycle360Detail>(`/oc360/cycles/${id}/activate`, { method: 'POST' });
export const get360Workflow = (id: string, sid: string) => fetchApi<Workflow>(`/oc360/cycles/${id}/subjects/${sid}/workflow`);

// Assignments (заполнение)
export const get360Assignments = (employeeId: string) => fetchApi<Assignment[]>(`/oc360/assignments?employeeId=${employeeId}`);
export const get360Assignment = (respondentId: string, employeeId: string) => fetchApi<AssignmentForm>(`/oc360/assignments/${respondentId}?employeeId=${employeeId}`);
export const submit360Assignment = (respondentId: string, dto: SubmitAssignmentDto) => fetchApi<{ success: boolean; submitted: boolean }>(`/oc360/assignments/${respondentId}`, { method: 'PUT', body: JSON.stringify(dto) });
export const listPeers = (subjectId: string, employeeId: string) => fetchApi<PeerRespondent[]>(`/oc360/assignments/peers/${subjectId}?employeeId=${employeeId}`);
export const addPeer = (subjectId: string, dto: { evaluatorId: string; employeeId?: string }) => fetchApi<unknown>(`/oc360/assignments/peers/${subjectId}`, { method: 'POST', body: JSON.stringify(dto) });
export const removePeer = (subjectId: string, respondentId: string, employeeId: string) => fetchApi<{ success: boolean }>(`/oc360/assignments/peers/${subjectId}/${respondentId}?employeeId=${employeeId}`, { method: 'DELETE' });
export const confirmPeers = (subjectId: string, employeeId: string) => fetchApi<{ success: boolean }>(`/oc360/assignments/peers/${subjectId}/confirm`, { method: 'POST', body: JSON.stringify({ employeeId }) });

// Results / publish / conclusions
export const get360Results = (id: string, sid: string) => fetchApi<Results360>(`/oc360/cycles/${id}/subjects/${sid}/results`);
export const publish360 = (id: string, sid: string) => fetchApi<unknown>(`/oc360/cycles/${id}/subjects/${sid}/publish`, { method: 'POST' });
export const unpublish360 = (id: string, sid: string) => fetchApi<unknown>(`/oc360/cycles/${id}/subjects/${sid}/unpublish`, { method: 'POST' });
export const get360Conclusions = (id: string, sid: string) => fetchApi<Conclusion360[]>(`/oc360/cycles/${id}/subjects/${sid}/conclusions`);
export const add360Conclusion = (id: string, sid: string, text: string) => fetchApi<Conclusion360>(`/oc360/cycles/${id}/subjects/${sid}/conclusions`, { method: 'POST', body: JSON.stringify({ text }) });
export const update360Conclusion = (id: string, text: string) => fetchApi<Conclusion360>(`/oc360/conclusions/${id}`, { method: 'PUT', body: JSON.stringify({ text }) });
export const delete360Conclusion = (id: string) => fetchApi<{ success: boolean }>(`/oc360/conclusions/${id}`, { method: 'DELETE' });
export const get360MyResults = (employeeId: string) => fetchApi<MySubject360[]>(`/oc360/my-results?employeeId=${employeeId}`);
export const get360MyResult = (cycleId: string, sid: string, employeeId: string) => fetchApi<Results360>(`/oc360/my-results/${cycleId}/${sid}?employeeId=${employeeId}`);

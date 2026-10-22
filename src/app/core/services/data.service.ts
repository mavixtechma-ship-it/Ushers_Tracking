import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  Branch, Sector, Agency, Usher, AppUser, Supervisor, SessionLog, SupervisorLog, BreakItem,
  Invoice, InvoicePage, FeedbackPage, DashboardStats, PagedResult, TempPasswordResult,
} from '../models/models';

export type ParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, ParamValue>;

/** Builds encoded query params (HttpParams encodes values); empty values are dropped. */
export function toParams(obj: QueryParams): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    p = p.set(k, String(v));
  }
  return p;
}

/** Path segment for numeric ids — never interpolate raw user input into URLs. */
const seg = (id: number) => encodeURIComponent(String(Math.trunc(Number(id))));

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly http = inject(HttpClient);
  private readonly api = API_BASE_URL;

  private get<T>(path: string, params?: QueryParams) {
    return firstValueFrom(this.http.get<T>(`${this.api}/${path}`, { params: params ? toParams(params) : undefined }));
  }
  private post<T>(path: string, body: unknown, params?: QueryParams) {
    return firstValueFrom(this.http.post<T>(`${this.api}/${path}`, body, { params: params ? toParams(params) : undefined }));
  }
  private put<T>(path: string, body: unknown, params?: QueryParams) {
    return firstValueFrom(this.http.put<T>(`${this.api}/${path}`, body, { params: params ? toParams(params) : undefined }));
  }
  private del<T>(path: string, params?: QueryParams) {
    return firstValueFrom(this.http.delete<T>(`${this.api}/${path}`, { params: params ? toParams(params) : undefined }));
  }

  // DASHBOARD
  getDashboardStats() { return this.get<DashboardStats>('DashBoard/Stats'); }

  // BRANCHES
  getBranches(q: QueryParams) { return this.get<PagedResult<Branch>>('Branch/AllBranches', q); }
  getAllBranches() { return this.get<PagedResult<Branch>>('Branch/AllBranches', { page: 1, pageSize: 1000 }); }
  getBranchById(id: number) { return this.get<Branch>(`Branch/GetBranchById/${seg(id)}`); }
  createBranch(data: Partial<Branch>) { return this.post<Branch>('Branch/CreateBranch', data); }
  updateBranch(id: number, data: Partial<Branch>) { return this.put<Branch>(`Branch/${seg(id)}`, data); }
  toggleBranchStatus(id: number) { return this.del<Branch>(`Branch/${seg(id)}`); }
  getBranchesBySupervisor(supervisorId: number) { return this.get<Branch[]>(`Branch/GetBranchesBySupervisor/${seg(supervisorId)}`); }

  // SECTORS
  getSectors() { return this.get<Sector[]>('Branch/GetAllSector'); }
  addSector(name: string) { return this.post<Sector>('Branch/AddSector', null, { sectorname: name }); }

  // AGENCIES
  getAgencies(q: QueryParams) { return this.get<PagedResult<Agency>>('Agency', q); }
  getAllAgencies() { return this.get<PagedResult<Agency>>('Agency', { page: 1, pageSize: 1000 }); }
  getAgencyById(id: number) { return this.get<Agency>(`Agency/${seg(id)}`); }
  createAgency(body: Omit<Agency, 'id'>) { return this.post<Agency>('Agency', body); }
  updateAgency(id: number, body: Agency) { return this.put<Agency>(`Agency/${seg(id)}`, body); }
  deleteAgency(id: number) { return this.del<void>(`Agency/${seg(id)}`); }

  // USHERS
  getUshers(q: QueryParams) { return this.get<PagedResult<Usher>>('Usher', q); }
  getUsherById(id: number) { return this.get<Usher>(`Usher/${seg(id)}`); }
  createUsher(data: Partial<Usher>) { return this.post<Usher & TempPasswordResult>('Usher/Create', data); }
  updateUsher(id: number, data: Partial<Usher>) { return this.put<Usher>(`Usher/${seg(id)}`, data); }
  toggleUsherStatus(id: number) { return this.del<Usher>(`Usher/${seg(id)}`); }

  // USERS
  getUsers(q: QueryParams) { return this.get<PagedResult<AppUser>>('User/AllUsers', q); }
  getUserById(id: number) { return this.get<AppUser>(`User/${seg(id)}`); }
  createUser(data: Partial<AppUser>) { return this.post<AppUser & TempPasswordResult>('User', data); }
  updateUser(id: number, data: Partial<AppUser>) { return this.put<AppUser>(`User/${seg(id)}`, data); }
  toggleUserStatus(id: number) { return this.del<AppUser>('User', { id }); }
  getSupervisors() { return this.get<Supervisor[]>('User/Supervisors'); }
  assignBranchesToSupervisor(supervisorId: number, branchIds: number[]) {
    return this.post<void>('Supervisors/AssignBranches', { SupervisorId: supervisorId, BranchIds: branchIds, assigned_at: new Date().toISOString() });
  }
  removeBranchAssignment(supervisorId: number, branchId: number) {
    return this.del<void>('Supervisors/RemoveBranchAssignment', { supervisorId, branchId });
  }

  // SESSIONS
  getSessions(q: QueryParams) { return this.get<PagedResult<SessionLog>>('Sessions/LogsList', q); }
  getSessionById(id: number) { return this.get<SessionLog>(`Sessions/${seg(id)}`); }
  getSessionBreaks(sessionId: number) { return this.get<BreakItem[]>('Break/GetSessionBreaks', { sessionId }); }

  // SUPERVISOR LOGS
  getSupervisorLogs(q: QueryParams) { return this.get<PagedResult<SupervisorLog>>('Sessions/SupervisorsLogsList', q); }
  getSupervisorLogById(id: number) { return this.get<SupervisorLog>(`Sessions/SupervisorLog/${seg(id)}`); }

  // INVOICES
  getInvoices(q: QueryParams) { return this.get<InvoicePage>('Invoice/GetInvoices', q); }
  getInvoiceById(id: number) { return this.get<Invoice>('Invoice/GetInvoiceById', { id }); }

  // FEEDBACK
  getFeedback(q: QueryParams) { return this.get<FeedbackPage>('Sessions/GetFeedBack', q); }

  /** The backend generates a random temporary password; the UI shows it to the admin once. */
  resetPassword(id: number, type: 'Usher' | 'User') {
    return this.put<TempPasswordResult>('Auth/ResetPassword', { type }, { id });
  }
}

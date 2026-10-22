export interface PagedResult<T> {
  items: T[];
  totalItems: number;
  totalCount?: number;
  pageSize?: number;
}

export interface Branch {
  id: number;
  name: string;
  address?: string;
  sectorId?: number | null;
  sectorName?: string;
  latitude?: number | null;
  longitude?: number | null;
  geofence_range?: number;
  is_active: boolean;
}

export interface Sector { id: number; name: string; }

export interface Agency { id: number; enName: string; arName: string; }

export interface Usher {
  id: number;
  name: string;
  phone?: string;
  email?: string | null;
  profile_photo_url?: string | null;
  agency?: string | null;
  supervisor_id?: number | null;
  is_active: boolean;
  is_online?: boolean;
  last_seen?: string | null;
}

export interface AppUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  title?: string;
  agency?: string | null;
  is_active: boolean;
}

export interface Supervisor { id: number; name: string; email: string; }

export interface SessionLog {
  id: number;
  usherId?: number;
  usherName: string;
  branchName: string;
  agency?: string;
  check_in_time: string;
  check_out_time?: string | null;
  duration?: number | null;
  BreaksDuration?: number;
  status: string;
  reason?: string | null;
  check_in_photo_url?: string | null;
  check_out_photo_url?: string | null;
  sectorName?: string;
}

export interface SupervisorLog {
  id: number;
  supervisorName: string;
  branchName: string;
  startTime: string;
  endTime?: string | null;
  duration?: number | null;
  status?: string;
  check_in_photo_url?: string | null;
  check_out_photo_url?: string | null;
}

export interface BreakItem {
  id?: number;
  break_type: string;
  start_time: string;
  end_time?: string | null;
  duration?: number | null;
  reason?: string | null;
}

export interface Invoice {
  invoiceId: number;
  usherName?: string;
  usherId?: number;
  productName?: string;
  productId?: number;
  quantity?: number;
  totalPrice?: number;
  location?: string;
  createdAt?: string;
}

export interface InvoicePage extends PagedResult<Invoice> {
  summary: { revenue: number; units: number; avgTicket: number };
}

export interface Feedback {
  id: number;
  supervisorName?: string;
  usherName?: string;
  branchName?: string;
  feedbackType?: string;
  comment?: string;
  createdAt?: string;
}

export interface FeedbackPage extends PagedResult<Feedback> {
  breakdown: { Positive: number; Neutral: number; Negative: number };
}

export interface DashboardStats {
  totalUshers: number;
  totalOnlineUshers: number;
  totalOfflineUshers: number;
  totalInactiveUshers: number;
  totalCompleatedSession: number;
  totalBranches: number;
  totalUsers: number;
  totalSupervisor: number;
  revenueLast30: number;
  sessionsTrend: { date: string; count: number }[];
  salesByBranch: { branch: string; total: number }[];
  onShift: { sessionId: number; usherName: string; branchName: string; since: string }[];
}

export interface TempPasswordResult {
  id?: number;
  temporaryPassword: string;
}

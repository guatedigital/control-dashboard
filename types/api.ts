// PerfexCRM API Types
export interface PerfexCRMConfig {
  apiUrl: string;
  apiKey: string;
}

export interface PerfexCRMResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PerfexCRMCustomer {
  id: string;
  company?: string;
  firstname: string;
  lastname: string;
  email?: string;
  phone?: string;
  created?: string;
}

export interface PerfexCRMInvoice {
  id: string;
  number: string;
  clientid: string;
  total: number;
  status: number;
  date: string;
  duedate?: string;
}

export interface PerfexCRMLead {
  id: string;
  title: string;
  firstname: string;
  lastname: string;
  email?: string;
  status: number;
  source: string;
  dateadded: string;
}

// Uchat API Types
export interface UchatConfig {
  apiUrl: string;
  apiKey: string;
}

export interface UchatResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface UchatChat {
  id: string;
  visitor_id?: string;
  agent_id?: string;
  status: string;
  started_at: string;
  ended_at?: string;
}

export interface UchatMessage {
  id: string;
  chat_id: string;
  sender: string;
  message: string;
  timestamp: string;
}

export interface UchatAnalytics {
  total_chats: number;
  active_chats: number;
  average_response_time: number;
  satisfaction_score?: number;
}


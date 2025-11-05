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

export interface UchatAgentActivityLog {
  id?: string;
  agent_id?: string;
  agent_name?: string;
  action?: string;
  conversation_id?: string;
  timestamp?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UchatCustomEventSummary {
  event_name?: string;
  event_count?: number;
  first_occurrence?: string;
  last_occurrence?: string;
  [key: string]: unknown;
}

export interface UchatCustomEventData {
  id?: string;
  event_name?: string;
  user_id?: string;
  conversation_id?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}


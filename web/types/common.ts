export type ValidationError = { field: string; message: string };

export type ServiceSummary = {
  id?: number;
  service_name: string;
  status: string;
  version?: string | null;
  last_check_at: string;
  raw_json?: string | null;
  error?: string;
};

export type ServiceDetails = {
  name: string;
  active: string;
  sub_state: string;
  main_pid: number;
  uptime: string;
  raw: Record<string, string>;
  last_logs?: string[];
  version?: string;
  checked_at: string;
  status_text: string;
};

export type AuditLogItem = {
  id: number;
  admin_id?: string | null;
  admin_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  payload_json: string;
  created_at: string;
};

export type HysteriaOverview = {
  enabled_users: number;
  total_tx_bytes: number;
  total_rx_bytes: number;
  online_count: number;
};

export type SystemLiveResponse = {
  collected_at: string;
  system: {
    cpu_usage_percent: number;
    memory_used_bytes: number;
    memory_total_bytes: number;
    memory_used_percent: number;
    uptime_seconds: number;
    network_rx_bps: number;
    network_tx_bps: number;
    collected_at: string;
    source: string;
    is_stale: boolean;
  };
  hysteria: {
    enabled_users: number;
    total_tx_bytes: number;
    total_rx_bytes: number;
    online_count: number;
    collected_at: string;
    source: string;
    is_stale: boolean;
  };
  services: Array<{
    service_name: string;
    status: string;
    last_check_at: string;
    source: string;
    is_stale: boolean;
    error?: string;
  }>;
  errors: string[];
};

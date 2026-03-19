export type ValidationError = {
  field: string;
  message: string;
};

export type HysteriaUser = {
  id: string;
  username: string;
  username_normalized: string;
  password: string;
  enabled: boolean;
  note?: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at?: string | null;
  last_tx_bytes: number;
  last_rx_bytes: number;
  online_count: number;
};

export type HysteriaOverview = {
  enabled_users: number;
  total_tx_bytes: number;
  total_rx_bytes: number;
  online_count: number;
};

export type HysteriaUserArtifacts = {
  uri: string;
  uri_hy2: string;
  client_config: string;
  client_params: {
    server: string;
    port: number;
    portUnion?: string;
    sni?: string;
    insecure: boolean;
    pinSHA256?: string;
    obfsType?: string;
    obfsPassword?: string;
  };
  singbox_outbound: Record<string, unknown>;
};

export type HysteriaUserPayload = {
  user: HysteriaUser;
  artifacts: HysteriaUserArtifacts | null;
  access_state?: string;
  access_message?: string;
};

export type Hy2ConfigValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  raw_only_paths?: string[];
};

export type Hy2Settings = {
  listen: string;
  tlsEnabled: boolean;
  tlsMode: string;
  tls?: {
    cert?: string;
    key?: string;
  };
  acme?: {
    domains?: string[];
    email?: string;
  };
  obfs?: {
    type?: string;
    salamander?: {
      password?: string;
    };
  };
  masquerade?: {
    type?: string;
    proxy?: {
      url?: string;
      rewriteHost?: boolean;
      insecure?: boolean;
    };
    file?: {
      dir?: string;
    };
    string?: {
      content?: string;
    };
  };
};

export type HysteriaSettingsResponse = {
  path: string;
  raw_yaml: string;
  settings: Hy2Settings;
  settings_validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  config_validation: Hy2ConfigValidation;
  raw_only_paths?: string[];
  access_mode: string;
  access_warning: string;
};

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

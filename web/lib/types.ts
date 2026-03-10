export type Admin = {
  id: string;
  email: string;
  is_active?: boolean;
};

export type Client = {
  id: string;
  name: string;
  email?: string | null;
  note?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Hy2Account = {
  id: string;
  client_id: string;
  auth_payload: string;
  hy2_identity: string;
  is_enabled: boolean;
  last_seen_at?: string | null;
  client_name?: string;
  client_active?: boolean;
  last_tx_bytes?: number;
  last_rx_bytes?: number;
  online_count?: number;
};

export type MTProxySecret = {
  id: string;
  client_id: string;
  secret: string;
  label?: string | null;
  is_enabled: boolean;
  last_seen_at?: string | null;
  client_name?: string;
  client_active?: boolean;
  is_runtime_active?: boolean;
};

export type ServiceState = {
  service_name?: string;
  status: string;
  version?: string | null;
  last_check_at?: string;
  raw_json?: string | null;
  error?: string;
};

export type AuditLog = {
  id: number;
  admin_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  payload_json: string;
  created_at: string;
};

export type SystemMetrics = {
  cpu_usage_percent: number;
  memory_used_bytes: number;
  memory_total_bytes: number;
  memory_used_percent: number;
  uptime_seconds: number;
  collected_at: string;
};

export type Hy2Settings = {
  port: number;
  sni: string;
  obfs_enabled: boolean;
  obfs_type?: string;
  obfs_password?: string;
  masquerade_enabled: boolean;
  masquerade_type?: string;
  masquerade_url?: string;
  masquerade_rewrite_host: boolean;
};

export type Hy2SettingsValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type Hy2ConfigValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    listen?: string;
    port?: number;
    auth_type?: string;
    auth_http_url?: string;
    primary_domain?: string;
    sni?: string;
    insecure?: boolean;
    pin_sha256?: string;
    obfs_type?: string;
    obfs_password?: string;
    alpn?: string[];
    masquerade_type?: string;
    masquerade_url?: string;
    masquerade_rewrite_host?: boolean;
  };
};

export type Hy2SettingsPayload = {
  path: string;
  settings: Hy2Settings;
  settings_validation: Hy2SettingsValidation;
  config_validation: Hy2ConfigValidation;
  client_params: {
    server: string;
    port: number;
    sni: string;
    insecure: boolean;
    pin_sha256?: string;
    obfs_type?: string;
    obfs_password?: string;
    alpn?: string[];
  };
};

export type MTProxySettingsPayload = {
  public_host: string;
  port: number;
  tls_domain: string;
  stats_url: string;
  stats_token_config: boolean;
  runtime_secret_id?: string;
};

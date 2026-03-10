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

export type Hy2ServerTLS = {
  cert?: string;
  key?: string;
};

export type Hy2ServerACME = {
  domains?: string[];
  email?: string;
};

export type Hy2ServerQUIC = {
  initStreamReceiveWindow?: number;
  maxStreamReceiveWindow?: number;
  initConnReceiveWindow?: number;
  maxConnReceiveWindow?: number;
  maxIdleTimeout?: string;
  maxIncomingStreams?: number;
  disablePathMTUDiscovery?: boolean;
};

export type Hy2ServerAuth = {
  type?: string;
  password?: string;
  http?: { url?: string; insecure?: boolean };
};

export type Hy2ServerObfs = {
  type?: string;
  salamander?: { password?: string };
};

export type Hy2ServerMasquerade = {
  type?: string;
  file?: { dir?: string };
  proxy?: { url?: string; rewriteHost?: boolean; insecure?: boolean };
  string?: { content?: string; headers?: Record<string, string>; statusCode?: number };
  listenHTTP?: string;
  listenHTTPS?: string;
  forceHTTPS?: boolean;
};

export type Hy2Settings = {
  listen: string;
  tlsEnabled: boolean;
  tlsMode: string;
  tls?: Hy2ServerTLS;
  acme?: Hy2ServerACME;
  auth: Hy2ServerAuth;
  obfs?: Hy2ServerObfs;
  masquerade?: Hy2ServerMasquerade;
  quicEnabled: boolean;
  quic?: Hy2ServerQUIC;
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
  rawOnlyPaths?: string[];
  summary: {
    listen?: string;
    tlsEnabled?: boolean;
    tlsMode?: string;
    authType?: string;
    obfsType?: string;
    masqueradeType?: string;
    quicEnabled?: boolean;
    rawOnlyPathsCount?: number;
  };
};

export type Hy2SettingsPayload = {
  path: string;
  raw_yaml: string;
  settings: Hy2Settings;
  settings_validation: Hy2SettingsValidation;
  config_validation: Hy2ConfigValidation;
  raw_only_paths?: string[];
};


export type MTProxySettingsPayload = {
  public_host: string;
  port: number;
  tls_domain: string;
  stats_url: string;
  stats_token_config: boolean;
  runtime_secret_id?: string;
};

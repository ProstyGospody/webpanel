export type Admin = {
  id: string;
  email: string;
  is_active?: boolean;
};

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
  userpass?: Record<string, string>;
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

export type HysteriaSettingsPayload = {
  path: string;
  raw_yaml: string;
  settings: Hy2Settings;
  settings_validation: Hy2SettingsValidation;
  config_validation: Hy2ConfigValidation;
  raw_only_paths?: string[];
  access_mode?: string;
  access_warning?: string;
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
  singbox_outbound?: Record<string, unknown>;
};

export type HysteriaUserArtifactsPayload = {
  user: HysteriaUser;
  artifacts: HysteriaUserArtifacts | null;
  access_state?: string;
  access_message?: string;
};

export type MTProxySettings = {
  enabled: boolean;
  public_host: string;
  listen_port: number;
  canonical_secret: string;
  share_mode: string;
  proxy_tag?: string | null;
  created_at: string;
  updated_at: string;
  last_applied_at?: string | null;
};

export type MTProxyAccess = {
  settings: MTProxySettings;
  telegram_url: string;
  telegram_deep_url: string;
};

export type MTProxySettingsResponse = {
  settings: MTProxySettings;
  access?: MTProxyAccess;
};

export type MTProxyOverview = {
  access_enabled: boolean;
  connections_total?: number | null;
};

export type ServiceState = {
  service_name?: string;
  status: string;
  version?: string | null;
  last_check_at?: string;
  raw_json?: string | null;
  error?: string;
};

export type ServiceDetails = {
  name: string;
  status_text: string;
  checked_at: string;
  last_logs?: string[];
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



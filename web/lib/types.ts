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
  sniGuard?: string;
  clientCA?: string;
};

export type Hy2ServerACME = {
  domains?: string[];
  email?: string;
  ca?: string;
  listenHost?: string;
  dir?: string;
  type?: string;
  http?: { altPort?: number };
  tls?: { altPort?: number };
  dns?: { name?: string; config?: Record<string, string> };
};

export type Hy2ServerObfs = {
  type?: string;
  salamander?: { password?: string };
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

export type Hy2ServerBandwidth = {
  up?: string;
  down?: string;
};

export type Hy2ServerAuth = {
  type?: string;
  password?: string;
  userpass?: Record<string, string>;
  http?: { url?: string; insecure?: boolean };
  command?: string;
};

export type Hy2ServerResolver = {
  type?: string;
  tcp?: { addr?: string; timeout?: string };
  udp?: { addr?: string; timeout?: string };
  tls?: { addr?: string; timeout?: string; sni?: string; insecure?: boolean };
  https?: { addr?: string; timeout?: string; sni?: string; insecure?: boolean };
};

export type Hy2ServerSniff = {
  enable?: boolean;
  timeout?: string;
  rewriteDomain?: boolean;
  tcpPorts?: string;
  udpPorts?: string;
};

export type Hy2ServerACL = {
  file?: string;
  inline?: string[];
  geoip?: string;
  geosite?: string;
  geoUpdateInterval?: string;
};

export type Hy2ServerOutbound = {
  name?: string;
  type?: string;
  direct?: { mode?: string; bindIPv4?: string; bindIPv6?: string; bindDevice?: string; fastOpen?: boolean };
  socks5?: { addr?: string; username?: string; password?: string };
  http?: { url?: string; insecure?: boolean };
};

export type Hy2ServerTrafficStats = {
  listen?: string;
  secret?: string;
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
  disableUDP: boolean;
  udpIdleTimeout?: string;
  ignoreClientBandwidth: boolean;
  speedTest: boolean;
  quic?: Hy2ServerQUIC;
  bandwidth?: Hy2ServerBandwidth;
  tlsMode: string;
  tls?: Hy2ServerTLS;
  acme?: Hy2ServerACME;
  obfs?: Hy2ServerObfs;
  auth: Hy2ServerAuth;
  resolver?: Hy2ServerResolver;
  sniff?: Hy2ServerSniff;
  acl?: Hy2ServerACL;
  outbounds?: Hy2ServerOutbound[];
  trafficStats?: Hy2ServerTrafficStats;
  masquerade?: Hy2ServerMasquerade;
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
    tlsMode?: string;
    authType?: string;
    obfsType?: string;
    resolverType?: string;
    masqueradeType?: string;
    outboundsCount?: number;
    rawOnlyPathsCount?: number;
  };
};

export type Hy2ClientProfile = {
  name?: string;
  server: string;
  auth: string;
  tls: {
    sni?: string;
    insecure?: boolean;
    pinSHA256?: string[];
    ca?: string;
    clientCertificate?: string;
    clientKey?: string;
  };
  transport: {
    type?: string;
    udp?: { hopInterval?: string };
  };
  obfs?: { type?: string; salamander?: { password?: string } };
  quic?: {
    initStreamReceiveWindow?: number;
    maxStreamReceiveWindow?: number;
    initConnReceiveWindow?: number;
    maxConnReceiveWindow?: number;
    maxIdleTimeout?: string;
    keepAlivePeriod?: string;
    disablePathMTUDiscovery?: boolean;
    sockopts?: {
      bindInterface?: string;
      fwmark?: number;
      fdControlUnixSocket?: string;
    };
  };
  bandwidth?: { up?: string; down?: string };
  fastOpen?: boolean;
  lazy?: boolean;
};

export type Hy2ClientArtifacts = {
  uri: string;
  uriHy2: string;
  clientYAML: string;
};

export type Hy2ClientValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type Hy2SettingsPayload = {
  path: string;
  raw_yaml: string;
  settings: Hy2Settings;
  settings_validation: Hy2SettingsValidation;
  config_validation: Hy2ConfigValidation;
  raw_only_paths?: string[];
  client_profile: Hy2ClientProfile;
  client_artifacts: Hy2ClientArtifacts;
  client_validation: Hy2ClientValidation;
};

export type Hy2ClientParams = {
  server?: string;
  port?: number;
  portUnion?: string;
  sni?: string;
  insecure?: boolean;
  pinSHA256?: string;
  obfsType?: string;
  obfsPassword?: string;
};

export type MTProxySettingsPayload = {
  public_host: string;
  port: number;
  tls_domain: string;
  stats_url: string;
  stats_token_config: boolean;
  runtime_secret_id?: string;
};
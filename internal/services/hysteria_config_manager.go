package services

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Hy2ConfigSummary struct {
	Listen            string `json:"listen"`
	TLSMode           string `json:"tlsMode,omitempty"`
	AuthType          string `json:"authType,omitempty"`
	ObfsType          string `json:"obfsType,omitempty"`
	ResolverType      string `json:"resolverType,omitempty"`
	MasqueradeType    string `json:"masqueradeType,omitempty"`
	OutboundsCount    int    `json:"outboundsCount"`
	RawOnlyPathsCount int    `json:"rawOnlyPathsCount"`
}

type Hy2ConfigValidation struct {
	Valid        bool             `json:"valid"`
	Errors       []string         `json:"errors"`
	Warnings     []string         `json:"warnings"`
	Summary      Hy2ConfigSummary `json:"summary"`
	RawOnlyPaths []string         `json:"rawOnlyPaths,omitempty"`
}

type Hy2Settings struct {
	Listen                string                 `json:"listen"`
	DisableUDP            bool                   `json:"disableUDP"`
	UDPIdleTimeout        string                 `json:"udpIdleTimeout,omitempty"`
	IgnoreClientBandwidth bool                   `json:"ignoreClientBandwidth"`
	SpeedTest             bool                   `json:"speedTest"`
	QUIC                  *Hy2ServerQUIC         `json:"quic,omitempty"`
	Bandwidth             *Hy2ServerBandwidth    `json:"bandwidth,omitempty"`
	TLSMode               string                 `json:"tlsMode"`
	TLS                   *Hy2ServerTLS          `json:"tls,omitempty"`
	ACME                  *Hy2ServerACME         `json:"acme,omitempty"`
	Obfs                  *Hy2ServerObfs         `json:"obfs,omitempty"`
	Auth                  Hy2ServerAuth          `json:"auth"`
	Resolver              *Hy2ServerResolver     `json:"resolver,omitempty"`
	Sniff                 *Hy2ServerSniff        `json:"sniff,omitempty"`
	ACL                   *Hy2ServerACL          `json:"acl,omitempty"`
	Outbounds             []Hy2ServerOutbound    `json:"outbounds,omitempty"`
	TrafficStats          *Hy2ServerTrafficStats `json:"trafficStats,omitempty"`
	Masquerade            *Hy2ServerMasquerade   `json:"masquerade,omitempty"`
}

type Hy2ServerTLS struct {
	Cert     string   `json:"cert,omitempty"`
	Key      string   `json:"key,omitempty"`
	SNIGuard string   `json:"sniGuard,omitempty"`
	ClientCA string   `json:"clientCA,omitempty"`
}

type Hy2ServerACME struct {
	Domains    []string           `json:"domains,omitempty"`
	Email      string             `json:"email,omitempty"`
	CA         string             `json:"ca,omitempty"`
	ListenHost string             `json:"listenHost,omitempty"`
	Dir        string             `json:"dir,omitempty"`
	Type       string             `json:"type,omitempty"`
	HTTP       *Hy2ServerACMEHTTP `json:"http,omitempty"`
	TLS        *Hy2ServerACMETLS  `json:"tls,omitempty"`
	DNS        *Hy2ServerACMEDNS  `json:"dns,omitempty"`
}

type Hy2ServerACMEHTTP struct {
	AltPort int `json:"altPort,omitempty"`
}

type Hy2ServerACMETLS struct {
	AltPort int `json:"altPort,omitempty"`
}

type Hy2ServerACMEDNS struct {
	Name   string            `json:"name,omitempty"`
	Config map[string]string `json:"config,omitempty"`
}

type Hy2ServerObfs struct {
	Type       string               `json:"type,omitempty"`
	Salamander *Hy2ServerSalamander `json:"salamander,omitempty"`
}

type Hy2ServerSalamander struct {
	Password string `json:"password,omitempty"`
}

type Hy2ServerQUIC struct {
	InitStreamReceiveWindow int64  `json:"initStreamReceiveWindow,omitempty"`
	MaxStreamReceiveWindow  int64  `json:"maxStreamReceiveWindow,omitempty"`
	InitConnReceiveWindow   int64  `json:"initConnReceiveWindow,omitempty"`
	MaxConnReceiveWindow    int64  `json:"maxConnReceiveWindow,omitempty"`
	MaxIdleTimeout          string `json:"maxIdleTimeout,omitempty"`
	MaxIncomingStreams      int64  `json:"maxIncomingStreams,omitempty"`
	DisablePathMTUDiscovery bool   `json:"disablePathMTUDiscovery,omitempty"`
}

type Hy2ServerBandwidth struct {
	Up   string `json:"up,omitempty"`
	Down string `json:"down,omitempty"`
}

type Hy2ServerAuth struct {
	Type     string             `json:"type,omitempty"`
	Password string             `json:"password,omitempty"`
	Userpass map[string]string  `json:"userpass,omitempty"`
	HTTP     *Hy2ServerAuthHTTP `json:"http,omitempty"`
	Command  string             `json:"command,omitempty"`
}

type Hy2ServerAuthHTTP struct {
	URL      string `json:"url,omitempty"`
	Insecure bool   `json:"insecure,omitempty"`
}

type Hy2ServerResolver struct {
	Type  string                  `json:"type,omitempty"`
	TCP   *Hy2ServerResolverTCP   `json:"tcp,omitempty"`
	UDP   *Hy2ServerResolverUDP   `json:"udp,omitempty"`
	TLS   *Hy2ServerResolverTLS   `json:"tls,omitempty"`
	HTTPS *Hy2ServerResolverHTTPS `json:"https,omitempty"`
}

type Hy2ServerResolverTCP struct {
	Addr    string `json:"addr,omitempty"`
	Timeout string `json:"timeout,omitempty"`
}

type Hy2ServerResolverUDP struct {
	Addr    string `json:"addr,omitempty"`
	Timeout string `json:"timeout,omitempty"`
}

type Hy2ServerResolverTLS struct {
	Addr     string `json:"addr,omitempty"`
	Timeout  string `json:"timeout,omitempty"`
	SNI      string `json:"sni,omitempty"`
	Insecure bool   `json:"insecure,omitempty"`
}

type Hy2ServerResolverHTTPS struct {
	Addr     string `json:"addr,omitempty"`
	Timeout  string `json:"timeout,omitempty"`
	SNI      string `json:"sni,omitempty"`
	Insecure bool   `json:"insecure,omitempty"`
}

type Hy2ServerSniff struct {
	Enable        bool   `json:"enable"`
	Timeout       string `json:"timeout,omitempty"`
	RewriteDomain bool   `json:"rewriteDomain,omitempty"`
	TCPPorts      string `json:"tcpPorts,omitempty"`
	UDPPorts      string `json:"udpPorts,omitempty"`
}

type Hy2ServerACL struct {
	File              string   `json:"file,omitempty"`
	Inline            []string `json:"inline,omitempty"`
	GeoIP             string   `json:"geoip,omitempty"`
	GeoSite           string   `json:"geosite,omitempty"`
	GeoUpdateInterval string   `json:"geoUpdateInterval,omitempty"`
}

type Hy2ServerOutbound struct {
	Name   string                   `json:"name,omitempty"`
	Type   string                   `json:"type,omitempty"`
	Direct *Hy2ServerOutboundDirect `json:"direct,omitempty"`
	SOCKS5 *Hy2ServerOutboundSOCKS5 `json:"socks5,omitempty"`
	HTTP   *Hy2ServerOutboundHTTP   `json:"http,omitempty"`
}

type Hy2ServerOutboundDirect struct {
	Mode       string `json:"mode,omitempty"`
	BindIPv4   string `json:"bindIPv4,omitempty"`
	BindIPv6   string `json:"bindIPv6,omitempty"`
	BindDevice string `json:"bindDevice,omitempty"`
	FastOpen   bool   `json:"fastOpen,omitempty"`
}

type Hy2ServerOutboundSOCKS5 struct {
	Addr     string `json:"addr,omitempty"`
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
}

type Hy2ServerOutboundHTTP struct {
	URL      string `json:"url,omitempty"`
	Insecure bool   `json:"insecure,omitempty"`
}

type Hy2ServerTrafficStats struct {
	Listen string `json:"listen,omitempty"`
	Secret string `json:"secret,omitempty"`
}

type Hy2ServerMasquerade struct {
	Type        string                     `json:"type,omitempty"`
	File        *Hy2ServerMasqueradeFile   `json:"file,omitempty"`
	Proxy       *Hy2ServerMasqueradeProxy  `json:"proxy,omitempty"`
	String      *Hy2ServerMasqueradeString `json:"string,omitempty"`
	ListenHTTP  string                     `json:"listenHTTP,omitempty"`
	ListenHTTPS string                     `json:"listenHTTPS,omitempty"`
	ForceHTTPS  bool                       `json:"forceHTTPS,omitempty"`
}

type Hy2ServerMasqueradeFile struct {
	Dir string `json:"dir,omitempty"`
}

type Hy2ServerMasqueradeProxy struct {
	URL         string `json:"url,omitempty"`
	RewriteHost bool   `json:"rewriteHost,omitempty"`
	Insecure    bool   `json:"insecure,omitempty"`
}

type Hy2ServerMasqueradeString struct {
	Content    string            `json:"content,omitempty"`
	Headers    map[string]string `json:"headers,omitempty"`
	StatusCode int               `json:"statusCode,omitempty"`
}

type Hy2SettingsValidation struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}

type Hy2ClientParams struct {
	Server       string   `json:"server"`
	Port         int      `json:"port"`
	PortUnion    string   `json:"portUnion,omitempty"`
	SNI          string   `json:"sni,omitempty"`
	Insecure     bool     `json:"insecure"`
	PinSHA256    string   `json:"pinSHA256,omitempty"`
	ObfsType     string   `json:"obfsType,omitempty"`
	ObfsPassword string   `json:"obfsPassword,omitempty"`
}

type HysteriaConfigManager struct {
	Path string
}

type Hy2ClientProfile struct {
	Name      string              `json:"name,omitempty"`
	Server    string              `json:"server"`
	Auth      string              `json:"auth"`
	TLS       Hy2ClientTLS        `json:"tls"`
	Transport Hy2ClientTransport  `json:"transport"`
	Obfs      *Hy2ClientObfs      `json:"obfs,omitempty"`
	QUIC      *Hy2ClientQUIC      `json:"quic,omitempty"`
	Bandwidth *Hy2ClientBandwidth `json:"bandwidth,omitempty"`
	FastOpen  bool                `json:"fastOpen,omitempty"`
	Lazy      bool                `json:"lazy,omitempty"`
}

type Hy2ClientTLS struct {
	SNI       string   `json:"sni,omitempty"`
	Insecure  bool     `json:"insecure,omitempty"`
	PinSHA256 []string `json:"pinSHA256,omitempty"`
	CA        string   `json:"ca,omitempty"`
	ClientCertificate string   `json:"clientCertificate,omitempty"`
	ClientKey         string   `json:"clientKey,omitempty"`
}

type Hy2ClientTransport struct {
	Type string                 `json:"type,omitempty"`
	UDP  *Hy2ClientTransportUDP `json:"udp,omitempty"`
}

type Hy2ClientTransportUDP struct {
	HopInterval string `json:"hopInterval,omitempty"`
}

type Hy2ClientObfs struct {
	Type       string               `json:"type,omitempty"`
	Salamander *Hy2ClientSalamander `json:"salamander,omitempty"`
}

type Hy2ClientSalamander struct {
	Password string `json:"password,omitempty"`
}

type Hy2ClientQUIC struct {
	InitStreamReceiveWindow int64                   `json:"initStreamReceiveWindow,omitempty"`
	MaxStreamReceiveWindow  int64                   `json:"maxStreamReceiveWindow,omitempty"`
	InitConnReceiveWindow   int64                   `json:"initConnReceiveWindow,omitempty"`
	MaxConnReceiveWindow    int64                   `json:"maxConnReceiveWindow,omitempty"`
	MaxIdleTimeout          string                  `json:"maxIdleTimeout,omitempty"`
	KeepAlivePeriod         string                  `json:"keepAlivePeriod,omitempty"`
	DisablePathMTUDiscovery bool                    `json:"disablePathMTUDiscovery,omitempty"`
	Sockopts                *Hy2ClientQUICSockopts `json:"sockopts,omitempty"`
}

type Hy2ClientQUICSockopts struct {
	BindInterface       string `json:"bindInterface,omitempty"`
	FWMark              uint32 `json:"fwmark,omitempty"`
	FDControlUnixSocket string `json:"fdControlUnixSocket,omitempty"`
}

type Hy2ClientBandwidth struct {
	Up   string `json:"up,omitempty"`
	Down string `json:"down,omitempty"`
}

type Hy2ClientValidation struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}

type Hy2ClientArtifacts struct {
	URI        string `json:"uri"`
	URIHy2     string `json:"uriHy2"`
	ClientYAML string `json:"clientYAML"`
}

type schemaNode struct {
	Fields   map[string]*schemaNode
	ListItem *schemaNode
	AnyMap   bool
}

var (
	durationPattern  = regexp.MustCompile(`^[0-9]+(ns|us|µs|ms|s|m|h)$`)
	bandwidthPattern = regexp.MustCompile(`^[0-9]+(\.[0-9]+)?([kmgt]?b(ps)?|[kmgt])$`)
	emptySchema      = &schemaNode{}
	serverSchema     = buildServerSchema()
)

func NewHysteriaConfigManager(path string) *HysteriaConfigManager {
	return &HysteriaConfigManager{Path: strings.TrimSpace(path)}
}

func (m *HysteriaConfigManager) Read() (string, error) {
	if strings.TrimSpace(m.Path) == "" {
		return "", fmt.Errorf("hysteria config path is empty")
	}
	content, err := os.ReadFile(m.Path)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func (m *HysteriaConfigManager) Save(content string) (string, error) {
	if strings.TrimSpace(m.Path) == "" {
		return "", fmt.Errorf("hysteria config path is empty")
	}
	if err := os.MkdirAll(filepath.Dir(m.Path), 0o750); err != nil {
		return "", fmt.Errorf("create config directory: %w", err)
	}

	mode := os.FileMode(0o640)
	backupPath := ""
	if st, err := os.Stat(m.Path); err == nil {
		mode = st.Mode().Perm()
		if previous, readErr := os.ReadFile(m.Path); readErr == nil {
			backupPath = fmt.Sprintf("%s.bak.%d", m.Path, time.Now().UTC().Unix())
			if writeErr := os.WriteFile(backupPath, previous, mode); writeErr != nil {
				return "", fmt.Errorf("write backup file: %w", writeErr)
			}
		}
	}

	normalized := strings.TrimRight(content, "\n") + "\n"
	tmpPath := m.Path + ".tmp"
	if err := os.WriteFile(tmpPath, []byte(normalized), mode); err != nil {
		return "", fmt.Errorf("write config temp file: %w", err)
	}
	if err := os.Rename(tmpPath, m.Path); err != nil {
		return "", fmt.Errorf("replace config file: %w", err)
	}
	return backupPath, nil
}

func (m *HysteriaConfigManager) Parse(content string) Hy2ConfigSummary {
	settings, err := m.ExtractSettingsWithError(content, "", 443)
	if err != nil {
		return Hy2ConfigSummary{}
	}
	unknown := m.RawOnlyPaths(content)
	return Hy2ConfigSummary{
		Listen:            settings.Listen,
		TLSMode:           settings.TLSMode,
		AuthType:          strings.ToLower(strings.TrimSpace(settings.Auth.Type)),
		ObfsType:          normalizedObfsType(settings.Obfs),
		ResolverType:      normalizedResolverType(settings.Resolver),
		MasqueradeType:    normalizedMasqueradeType(settings.Masquerade),
		OutboundsCount:    len(settings.Outbounds),
		RawOnlyPathsCount: len(unknown),
	}
}

func (m *HysteriaConfigManager) Validate(content string) Hy2ConfigValidation {
	v := Hy2ConfigValidation{Errors: []string{}, Warnings: []string{}}
	root, err := parseYAMLMap(content)
	if err != nil {
		v.Errors = append(v.Errors, "invalid YAML: "+strings.TrimSpace(err.Error()))
		v.Valid = false
		return v
	}

	settings := parseSettingsFromMap(root, "", 443)
	sv := validateSettings(settings)
	v.Errors = append(v.Errors, sv.Errors...)
	v.Warnings = append(v.Warnings, sv.Warnings...)
	v.RawOnlyPaths = collectUnknown(root, serverSchema)
	if len(v.RawOnlyPaths) > 0 {
		v.Warnings = append(v.Warnings, "raw-only fields detected; keep using the YAML editor for unsupported keys")
	}

	v.Summary = Hy2ConfigSummary{
		Listen:            settings.Listen,
		TLSMode:           settings.TLSMode,
		AuthType:          strings.ToLower(strings.TrimSpace(settings.Auth.Type)),
		ObfsType:          normalizedObfsType(settings.Obfs),
		ResolverType:      normalizedResolverType(settings.Resolver),
		MasqueradeType:    normalizedMasqueradeType(settings.Masquerade),
		OutboundsCount:    len(settings.Outbounds),
		RawOnlyPathsCount: len(v.RawOnlyPaths),
	}
	v.Valid = len(v.Errors) == 0
	return v
}

func (m *HysteriaConfigManager) RawOnlyPaths(content string) []string {
	root, err := parseYAMLMap(content)
	if err != nil {
		return nil
	}
	return collectUnknown(root, serverSchema)
}

func (m *HysteriaConfigManager) ExtractSettings(content string, fallbackHost string, fallbackPort int) Hy2Settings {
	settings, err := m.ExtractSettingsWithError(content, fallbackHost, fallbackPort)
	if err != nil {
		return defaultSettings(fallbackHost, fallbackPort)
	}
	return settings
}

func (m *HysteriaConfigManager) ExtractSettingsWithError(content string, fallbackHost string, fallbackPort int) (Hy2Settings, error) {
	root, err := parseYAMLMap(content)
	if err != nil {
		return Hy2Settings{}, err
	}
	return parseSettingsFromMap(root, fallbackHost, fallbackPort), nil
}

func (m *HysteriaConfigManager) ValidateSettings(input Hy2Settings) Hy2SettingsValidation {
	return validateSettings(normalizeSettings(input))
}

func (m *HysteriaConfigManager) ApplySettings(content string, input Hy2Settings) (string, Hy2SettingsValidation) {
	settings := normalizeSettings(input)
	sv := validateSettings(settings)
	if !sv.Valid {
		return content, sv
	}

	currentMap, err := parseYAMLMap(content)
	if err != nil {
		sv.Valid = false
		sv.Errors = append(sv.Errors, "current YAML is invalid; fix it in the raw editor before using structured save")
		return content, sv
	}
	desiredMap := buildSettingsMap(settings)
	merged := mergeKnownValues(currentMap, desiredMap, serverSchema)
	mergedMap, ok := merged.(map[string]any)
	if !ok {
		sv.Valid = false
		sv.Errors = append(sv.Errors, "failed to build resulting config")
		return content, sv
	}

	next, marshalErr := marshalYAMLMap(mergedMap)
	if marshalErr != nil {
		sv.Valid = false
		sv.Errors = append(sv.Errors, "failed to render YAML: "+strings.TrimSpace(marshalErr.Error()))
		return content, sv
	}
	return next, sv
}

func (m *HysteriaConfigManager) ClientParams(content string, fallbackHost string, fallbackPort int) Hy2ClientParams {
	settings := m.ExtractSettings(content, fallbackHost, fallbackPort)
	profile := m.DefaultClientProfileFromSettings(settings, fallbackHost, fallbackPort, "")
	host, ports := splitServerForClient(profile.Server)
	port := firstPortFromUnion(ports)
	if port <= 0 {
		port = fallbackPort
	}
	if host == "" {
		host = NormalizeHost(fallbackHost)
	}
	if host == "" {
		host = "127.0.0.1"
	}
	pin := ""
	if len(profile.TLS.PinSHA256) > 0 {
		pin = strings.TrimSpace(profile.TLS.PinSHA256[0])
	}
	obfsType := ""
	obfsPassword := ""
	if profile.Obfs != nil {
		obfsType = strings.TrimSpace(profile.Obfs.Type)
		if profile.Obfs.Salamander != nil {
			obfsPassword = strings.TrimSpace(profile.Obfs.Salamander.Password)
		}
	}
	return Hy2ClientParams{
		Server:       host,
		Port:         port,
		PortUnion:    ports,
		SNI:          strings.TrimSpace(profile.TLS.SNI),
		Insecure:     profile.TLS.Insecure,
		PinSHA256:    pin,
		ObfsType:     obfsType,
		ObfsPassword: obfsPassword,
	}
}

func (m *HysteriaConfigManager) DefaultClientProfile(content string, fallbackHost string, fallbackPort int, auth string) Hy2ClientProfile {
	settings := m.ExtractSettings(content, fallbackHost, fallbackPort)
	return m.DefaultClientProfileFromSettings(settings, fallbackHost, fallbackPort, auth)
}

func (m *HysteriaConfigManager) DefaultClientProfileFromSettings(settings Hy2Settings, fallbackHost string, fallbackPort int, auth string) Hy2ClientProfile {
	listenHost, listenPorts, ok := parseListen(settings.Listen)
	if !ok || !validPortUnion(listenPorts) {
		listenPorts = strconv.Itoa(maxInt(fallbackPort, 443))
	}

	publicHost := NormalizeHost(fallbackHost)
	if publicHost == "" {
		publicHost = NormalizeHost(listenHost)
	}
	if publicHost == "" {
		publicHost = "127.0.0.1"
	}

	sni := publicHost
	if settings.TLSMode == "acme" && settings.ACME != nil && len(settings.ACME.Domains) > 0 {
		sni = NormalizeHost(settings.ACME.Domains[0])
	}
	if sni == "" {
		sni = publicHost
	}

	profile := Hy2ClientProfile{
		Server: publicHost + ":" + listenPorts,
		Auth:   strings.TrimSpace(auth),
		TLS: Hy2ClientTLS{
			SNI: sni,
		},
		Transport: Hy2ClientTransport{Type: "udp"},
		FastOpen:  false,
		Lazy:      false,
	}

	if settings.Obfs != nil && strings.EqualFold(strings.TrimSpace(settings.Obfs.Type), "salamander") {
		password := ""
		if settings.Obfs.Salamander != nil {
			password = strings.TrimSpace(settings.Obfs.Salamander.Password)
		}
		profile.Obfs = &Hy2ClientObfs{Type: "salamander", Salamander: &Hy2ClientSalamander{Password: password}}
	}

	if settings.QUIC != nil {
		profile.QUIC = &Hy2ClientQUIC{
			InitStreamReceiveWindow: settings.QUIC.InitStreamReceiveWindow,
			MaxStreamReceiveWindow:  settings.QUIC.MaxStreamReceiveWindow,
			InitConnReceiveWindow:   settings.QUIC.InitConnReceiveWindow,
			MaxConnReceiveWindow:    settings.QUIC.MaxConnReceiveWindow,
			MaxIdleTimeout:          strings.TrimSpace(settings.QUIC.MaxIdleTimeout),
			DisablePathMTUDiscovery: settings.QUIC.DisablePathMTUDiscovery,
		}
	}

	if settings.Bandwidth != nil && !settings.IgnoreClientBandwidth {
		profile.Bandwidth = &Hy2ClientBandwidth{Up: strings.TrimSpace(settings.Bandwidth.Up), Down: strings.TrimSpace(settings.Bandwidth.Down)}
	}

	return normalizeClientProfile(profile)
}

func (m *HysteriaConfigManager) ValidateClientProfile(profile Hy2ClientProfile, modeTemplate string) Hy2ClientValidation {
	return validateClientProfile(normalizeClientProfile(profile), modeTemplate)
}

func (m *HysteriaConfigManager) GenerateClientArtifacts(profile Hy2ClientProfile, modeTemplate string) (Hy2ClientArtifacts, Hy2ClientValidation) {
	normalized := normalizeClientProfile(profile)
	v := validateClientProfile(normalized, modeTemplate)
	if !v.Valid {
		return Hy2ClientArtifacts{}, v
	}

	uri, uriHy2 := buildClientURI(normalized)
	clientYAML, err := buildClientYAML(normalized, modeTemplate)
	if err != nil {
		v.Valid = false
		v.Errors = append(v.Errors, "failed to build client YAML: "+strings.TrimSpace(err.Error()))
		return Hy2ClientArtifacts{}, v
	}
	return Hy2ClientArtifacts{URI: uri, URIHy2: uriHy2, ClientYAML: clientYAML}, v
}
func defaultSettings(fallbackHost string, fallbackPort int) Hy2Settings {
	port := maxInt(fallbackPort, 443)
	host := NormalizeHost(fallbackHost)
	domains := []string{}
	if host != "" && net.ParseIP(host) == nil {
		domains = append(domains, host)
	}
	return Hy2Settings{
		Listen:  fmt.Sprintf(":%d", port),
		TLSMode: "acme",
		ACME:    &Hy2ServerACME{Domains: domains, Type: "http"},
		Auth:    Hy2ServerAuth{Type: "password"},
	}
}

func (a Hy2ServerAuth) HTTPURL() string {
	if a.HTTP == nil {
		return ""
	}
	return strings.TrimSpace(a.HTTP.URL)
}

func parseSettingsFromMap(root map[string]any, fallbackHost string, fallbackPort int) Hy2Settings {
	settings := defaultSettings(fallbackHost, fallbackPort)
	settings.Listen = firstNonEmpty(toString(root["listen"]), settings.Listen)
	settings.DisableUDP = toBool(root["disableUDP"])
	settings.UDPIdleTimeout = strings.TrimSpace(toString(root["udpIdleTimeout"]))
	settings.IgnoreClientBandwidth = toBool(root["ignoreClientBandwidth"])
	settings.SpeedTest = toBool(root["speedTest"])

	if m, ok := toStringAnyMap(root["quic"]); ok {
		settings.QUIC = parseServerQUIC(m)
	}
	if m, ok := toStringAnyMap(root["bandwidth"]); ok {
		settings.Bandwidth = parseServerBandwidth(m)
	}
	if m, ok := toStringAnyMap(root["tls"]); ok {
		settings.TLS = parseServerTLS(m)
	}
	if m, ok := toStringAnyMap(root["acme"]); ok {
		settings.ACME = parseServerACME(m)
	}
	switch {
	case settings.TLS != nil && settings.ACME != nil:
		settings.TLSMode = "conflict"
	case settings.TLS != nil:
		settings.TLSMode = "tls"
	case settings.ACME != nil:
		settings.TLSMode = "acme"
	default:
		settings.TLSMode = "acme"
	}

	if m, ok := toStringAnyMap(root["obfs"]); ok {
		settings.Obfs = parseServerObfs(m)
	}
	if m, ok := toStringAnyMap(root["auth"]); ok {
		settings.Auth = parseServerAuth(m)
	}
	if m, ok := toStringAnyMap(root["resolver"]); ok {
		settings.Resolver = parseServerResolver(m)
	}
	if m, ok := toStringAnyMap(root["sniff"]); ok {
		settings.Sniff = parseServerSniff(m)
	}
	if m, ok := toStringAnyMap(root["acl"]); ok {
		settings.ACL = parseServerACL(m)
	}
	if s, ok := toAnySlice(root["outbounds"]); ok {
		settings.Outbounds = parseServerOutbounds(s)
	}
	if m, ok := toStringAnyMap(root["trafficStats"]); ok {
		settings.TrafficStats = parseServerTrafficStats(m)
	}
	if m, ok := toStringAnyMap(root["masquerade"]); ok {
		settings.Masquerade = parseServerMasquerade(m)
	}

	return normalizeSettings(settings)
}

func parseServerQUIC(m map[string]any) *Hy2ServerQUIC {
	cfg := &Hy2ServerQUIC{
		InitStreamReceiveWindow: toInt64(m["initStreamReceiveWindow"]),
		MaxStreamReceiveWindow:  toInt64(m["maxStreamReceiveWindow"]),
		InitConnReceiveWindow:   toInt64(m["initConnReceiveWindow"]),
		MaxConnReceiveWindow:    toInt64(m["maxConnReceiveWindow"]),
		MaxIdleTimeout:          strings.TrimSpace(toString(m["maxIdleTimeout"])),
		MaxIncomingStreams:      toInt64(m["maxIncomingStreams"]),
		DisablePathMTUDiscovery: toBool(m["disablePathMTUDiscovery"]),
	}
	if isEmptyStruct(cfg) {
		return nil
	}
	return cfg
}

func parseServerBandwidth(m map[string]any) *Hy2ServerBandwidth {
	cfg := &Hy2ServerBandwidth{Up: strings.TrimSpace(toString(m["up"])), Down: strings.TrimSpace(toString(m["down"]))}
	if cfg.Up == "" && cfg.Down == "" {
		return nil
	}
	return cfg
}

func parseServerTLS(m map[string]any) *Hy2ServerTLS {
	cfg := &Hy2ServerTLS{
		Cert:     strings.TrimSpace(toString(m["cert"])),
		Key:      strings.TrimSpace(toString(m["key"])),
		SNIGuard: strings.TrimSpace(toString(m["sniGuard"])),
		ClientCA: strings.TrimSpace(toString(m["clientCA"])),
	}
	if isEmptyStruct(cfg) {
		return nil
	}
	return cfg
}

func parseServerACME(m map[string]any) *Hy2ServerACME {
	cfg := &Hy2ServerACME{
		Domains:    toStringSlice(m["domains"]),
		Email:      strings.TrimSpace(toString(m["email"])),
		CA:         strings.TrimSpace(toString(m["ca"])),
		ListenHost: strings.TrimSpace(toString(m["listenHost"])),
		Dir:        strings.TrimSpace(toString(m["dir"])),
		Type:       strings.ToLower(strings.TrimSpace(toString(m["type"]))),
	}
	if cfg.Type == "" {
		cfg.Type = "http"
	}
	if mm, ok := toStringAnyMap(m["http"]); ok {
		cfg.HTTP = &Hy2ServerACMEHTTP{AltPort: toInt(mm["altPort"])}
	}
	if mm, ok := toStringAnyMap(m["tls"]); ok {
		cfg.TLS = &Hy2ServerACMETLS{AltPort: toInt(mm["altPort"])}
	}
	if mm, ok := toStringAnyMap(m["dns"]); ok {
		cfg.DNS = &Hy2ServerACMEDNS{Name: strings.TrimSpace(toString(mm["name"])), Config: toStringStringMap(mm["config"])}
	}
	if isEmptyStruct(cfg) {
		return nil
	}
	return cfg
}

func parseServerObfs(m map[string]any) *Hy2ServerObfs {
	t := strings.ToLower(strings.TrimSpace(toString(m["type"])))
	cfg := &Hy2ServerObfs{Type: t}
	if sm, ok := toStringAnyMap(m["salamander"]); ok {
		cfg.Salamander = &Hy2ServerSalamander{Password: strings.TrimSpace(toString(sm["password"]))}
	}
	if cfg.Type == "" && cfg.Salamander != nil {
		cfg.Type = "salamander"
	}
	if cfg.Type == "" {
		return nil
	}
	return cfg
}

func parseServerAuth(m map[string]any) Hy2ServerAuth {
	auth := Hy2ServerAuth{
		Type:     strings.ToLower(strings.TrimSpace(toString(m["type"]))),
		Password: strings.TrimSpace(toString(m["password"])),
		Userpass: toStringStringMap(m["userpass"]),
		Command:  strings.TrimSpace(toString(m["command"])),
	}
	if mm, ok := toStringAnyMap(m["http"]); ok {
		auth.HTTP = &Hy2ServerAuthHTTP{URL: strings.TrimSpace(toString(mm["url"])), Insecure: toBool(mm["insecure"])}
	}
	return auth
}

func parseServerResolver(m map[string]any) *Hy2ServerResolver {
	cfg := &Hy2ServerResolver{Type: strings.ToLower(strings.TrimSpace(toString(m["type"])))}
	if mm, ok := toStringAnyMap(m["tcp"]); ok {
		cfg.TCP = &Hy2ServerResolverTCP{Addr: strings.TrimSpace(toString(mm["addr"])), Timeout: strings.TrimSpace(toString(mm["timeout"]))}
	}
	if mm, ok := toStringAnyMap(m["udp"]); ok {
		cfg.UDP = &Hy2ServerResolverUDP{Addr: strings.TrimSpace(toString(mm["addr"])), Timeout: strings.TrimSpace(toString(mm["timeout"]))}
	}
	if mm, ok := toStringAnyMap(m["tls"]); ok {
		cfg.TLS = &Hy2ServerResolverTLS{Addr: strings.TrimSpace(toString(mm["addr"])), Timeout: strings.TrimSpace(toString(mm["timeout"])), SNI: strings.TrimSpace(toString(mm["sni"])), Insecure: toBool(mm["insecure"])}
	}
	if mm, ok := toStringAnyMap(m["https"]); ok {
		cfg.HTTPS = &Hy2ServerResolverHTTPS{Addr: strings.TrimSpace(toString(mm["addr"])), Timeout: strings.TrimSpace(toString(mm["timeout"])), SNI: strings.TrimSpace(toString(mm["sni"])), Insecure: toBool(mm["insecure"])}
	}
	if cfg.Type == "" && cfg.TCP == nil && cfg.UDP == nil && cfg.TLS == nil && cfg.HTTPS == nil {
		return nil
	}
	return cfg
}

func parseServerSniff(m map[string]any) *Hy2ServerSniff {
	cfg := &Hy2ServerSniff{
		Enable:        toBool(m["enable"]),
		Timeout:       strings.TrimSpace(toString(m["timeout"])),
		RewriteDomain: toBool(m["rewriteDomain"]),
		TCPPorts:      strings.TrimSpace(toString(m["tcpPorts"])),
		UDPPorts:      strings.TrimSpace(toString(m["udpPorts"])),
	}
	if !cfg.Enable && cfg.Timeout == "" && !cfg.RewriteDomain && cfg.TCPPorts == "" && cfg.UDPPorts == "" {
		return nil
	}
	return cfg
}

func parseServerACL(m map[string]any) *Hy2ServerACL {
	cfg := &Hy2ServerACL{
		File:              strings.TrimSpace(toString(m["file"])),
		Inline:            toStringSlice(m["inline"]),
		GeoIP:             strings.TrimSpace(toString(m["geoip"])),
		GeoSite:           strings.TrimSpace(toString(m["geosite"])),
		GeoUpdateInterval: strings.TrimSpace(toString(m["geoUpdateInterval"])),
	}
	if cfg.File == "" && len(cfg.Inline) == 0 && cfg.GeoIP == "" && cfg.GeoSite == "" && cfg.GeoUpdateInterval == "" {
		return nil
	}
	return cfg
}

func parseServerOutbounds(items []any) []Hy2ServerOutbound {
	out := make([]Hy2ServerOutbound, 0, len(items))
	for _, item := range items {
		m, ok := toStringAnyMap(item)
		if !ok {
			continue
		}
		entry := Hy2ServerOutbound{Name: strings.TrimSpace(toString(m["name"])), Type: strings.ToLower(strings.TrimSpace(toString(m["type"])))}
		if mm, ok := toStringAnyMap(m["direct"]); ok {
			entry.Direct = &Hy2ServerOutboundDirect{Mode: strings.TrimSpace(toString(mm["mode"])), BindIPv4: strings.TrimSpace(toString(mm["bindIPv4"])), BindIPv6: strings.TrimSpace(toString(mm["bindIPv6"])), BindDevice: strings.TrimSpace(toString(mm["bindDevice"])), FastOpen: toBool(mm["fastOpen"])}
		}
		if mm, ok := toStringAnyMap(m["socks5"]); ok {
			entry.SOCKS5 = &Hy2ServerOutboundSOCKS5{Addr: strings.TrimSpace(toString(mm["addr"])), Username: strings.TrimSpace(toString(mm["username"])), Password: strings.TrimSpace(toString(mm["password"]))}
		}
		if mm, ok := toStringAnyMap(m["http"]); ok {
			entry.HTTP = &Hy2ServerOutboundHTTP{URL: strings.TrimSpace(toString(mm["url"])), Insecure: toBool(mm["insecure"])}
		}
		if entry.Name == "" && entry.Type == "" {
			continue
		}
		out = append(out, entry)
	}
	return out
}

func parseServerTrafficStats(m map[string]any) *Hy2ServerTrafficStats {
	cfg := &Hy2ServerTrafficStats{Listen: strings.TrimSpace(toString(m["listen"])), Secret: strings.TrimSpace(toString(m["secret"]))}
	if cfg.Listen == "" && cfg.Secret == "" {
		return nil
	}
	return cfg
}

func parseServerMasquerade(m map[string]any) *Hy2ServerMasquerade {
	cfg := &Hy2ServerMasquerade{Type: strings.ToLower(strings.TrimSpace(toString(m["type"]))), ListenHTTP: strings.TrimSpace(toString(m["listenHTTP"])), ListenHTTPS: strings.TrimSpace(toString(m["listenHTTPS"])), ForceHTTPS: toBool(m["forceHTTPS"])}
	if mm, ok := toStringAnyMap(m["file"]); ok {
		cfg.File = &Hy2ServerMasqueradeFile{Dir: strings.TrimSpace(toString(mm["dir"]))}
	}
	if mm, ok := toStringAnyMap(m["proxy"]); ok {
		cfg.Proxy = &Hy2ServerMasqueradeProxy{URL: strings.TrimSpace(toString(mm["url"])), RewriteHost: toBool(mm["rewriteHost"]), Insecure: toBool(mm["insecure"])}
	}
	if mm, ok := toStringAnyMap(m["string"]); ok {
		cfg.String = &Hy2ServerMasqueradeString{Content: strings.TrimSpace(toString(mm["content"])), Headers: toStringStringMap(mm["headers"]), StatusCode: toInt(mm["statusCode"])}
	}
	if cfg.Type == "" && cfg.File == nil && cfg.Proxy == nil && cfg.String == nil && cfg.ListenHTTP == "" && cfg.ListenHTTPS == "" && !cfg.ForceHTTPS {
		return nil
	}
	if cfg.Type == "" {
		switch {
		case cfg.Proxy != nil:
			cfg.Type = "proxy"
		case cfg.File != nil:
			cfg.Type = "file"
		case cfg.String != nil:
			cfg.Type = "string"
		}
	}
	return cfg
}
func normalizeSettings(input Hy2Settings) Hy2Settings {
	settings := input
	settings.Listen = strings.TrimSpace(settings.Listen)
	settings.UDPIdleTimeout = strings.TrimSpace(settings.UDPIdleTimeout)
	settings.TLSMode = strings.ToLower(strings.TrimSpace(settings.TLSMode))
	if settings.TLSMode == "" {
		if settings.TLS != nil {
			settings.TLSMode = "tls"
		} else {
			settings.TLSMode = "acme"
		}
	}

	settings.Auth.Type = strings.ToLower(strings.TrimSpace(settings.Auth.Type))
	settings.Auth.Password = strings.TrimSpace(settings.Auth.Password)
	settings.Auth.Command = strings.TrimSpace(settings.Auth.Command)
	settings.Auth.Userpass = trimStringStringMap(settings.Auth.Userpass)
	if settings.Auth.HTTP != nil {
		settings.Auth.HTTP.URL = strings.TrimSpace(settings.Auth.HTTP.URL)
	}

	if settings.TLS != nil {
		settings.TLS.Cert = strings.TrimSpace(settings.TLS.Cert)
		settings.TLS.Key = strings.TrimSpace(settings.TLS.Key)
		settings.TLS.SNIGuard = strings.TrimSpace(settings.TLS.SNIGuard)
		settings.TLS.ClientCA = strings.TrimSpace(settings.TLS.ClientCA)
		if isEmptyStruct(settings.TLS) {
			settings.TLS = nil
		}
	}
	if settings.ACME != nil {
		settings.ACME.Email = strings.TrimSpace(settings.ACME.Email)
		settings.ACME.CA = strings.TrimSpace(settings.ACME.CA)
		settings.ACME.ListenHost = strings.TrimSpace(settings.ACME.ListenHost)
		settings.ACME.Dir = strings.TrimSpace(settings.ACME.Dir)
		settings.ACME.Type = strings.ToLower(strings.TrimSpace(settings.ACME.Type))
		if settings.ACME.Type == "" {
			settings.ACME.Type = "http"
		}
		settings.ACME.Domains = trimStringSlice(settings.ACME.Domains)
		if settings.ACME.DNS != nil {
			settings.ACME.DNS.Name = strings.TrimSpace(settings.ACME.DNS.Name)
			settings.ACME.DNS.Config = trimStringStringMap(settings.ACME.DNS.Config)
			if settings.ACME.DNS.Name == "" && len(settings.ACME.DNS.Config) == 0 {
				settings.ACME.DNS = nil
			}
		}
	}
	if settings.Obfs != nil {
		settings.Obfs.Type = strings.ToLower(strings.TrimSpace(settings.Obfs.Type))
		if settings.Obfs.Salamander != nil {
			settings.Obfs.Salamander.Password = strings.TrimSpace(settings.Obfs.Salamander.Password)
		}
		if settings.Obfs.Type == "" {
			settings.Obfs = nil
		}
	}
	if settings.Resolver != nil {
		settings.Resolver.Type = strings.ToLower(strings.TrimSpace(settings.Resolver.Type))
		if settings.Resolver.TCP != nil {
			settings.Resolver.TCP.Addr = strings.TrimSpace(settings.Resolver.TCP.Addr)
			settings.Resolver.TCP.Timeout = strings.TrimSpace(settings.Resolver.TCP.Timeout)
		}
		if settings.Resolver.UDP != nil {
			settings.Resolver.UDP.Addr = strings.TrimSpace(settings.Resolver.UDP.Addr)
			settings.Resolver.UDP.Timeout = strings.TrimSpace(settings.Resolver.UDP.Timeout)
		}
		if settings.Resolver.TLS != nil {
			settings.Resolver.TLS.Addr = strings.TrimSpace(settings.Resolver.TLS.Addr)
			settings.Resolver.TLS.Timeout = strings.TrimSpace(settings.Resolver.TLS.Timeout)
			settings.Resolver.TLS.SNI = strings.TrimSpace(settings.Resolver.TLS.SNI)
		}
		if settings.Resolver.HTTPS != nil {
			settings.Resolver.HTTPS.Addr = strings.TrimSpace(settings.Resolver.HTTPS.Addr)
			settings.Resolver.HTTPS.Timeout = strings.TrimSpace(settings.Resolver.HTTPS.Timeout)
			settings.Resolver.HTTPS.SNI = strings.TrimSpace(settings.Resolver.HTTPS.SNI)
		}
	}
	if settings.Sniff != nil {
		settings.Sniff.Timeout = strings.TrimSpace(settings.Sniff.Timeout)
		settings.Sniff.TCPPorts = strings.TrimSpace(settings.Sniff.TCPPorts)
		settings.Sniff.UDPPorts = strings.TrimSpace(settings.Sniff.UDPPorts)
	}
	if settings.ACL != nil {
		settings.ACL.File = strings.TrimSpace(settings.ACL.File)
		settings.ACL.GeoIP = strings.TrimSpace(settings.ACL.GeoIP)
		settings.ACL.GeoSite = strings.TrimSpace(settings.ACL.GeoSite)
		settings.ACL.GeoUpdateInterval = strings.TrimSpace(settings.ACL.GeoUpdateInterval)
		settings.ACL.Inline = trimStringSlice(settings.ACL.Inline)
	}
	if settings.TrafficStats != nil {
		settings.TrafficStats.Listen = strings.TrimSpace(settings.TrafficStats.Listen)
		settings.TrafficStats.Secret = strings.TrimSpace(settings.TrafficStats.Secret)
		if settings.TrafficStats.Listen == "" && settings.TrafficStats.Secret == "" {
			settings.TrafficStats = nil
		}
	}
	if settings.Masquerade != nil {
		settings.Masquerade.Type = strings.ToLower(strings.TrimSpace(settings.Masquerade.Type))
		settings.Masquerade.ListenHTTP = strings.TrimSpace(settings.Masquerade.ListenHTTP)
		settings.Masquerade.ListenHTTPS = strings.TrimSpace(settings.Masquerade.ListenHTTPS)
		if settings.Masquerade.File != nil {
			settings.Masquerade.File.Dir = strings.TrimSpace(settings.Masquerade.File.Dir)
			if settings.Masquerade.File.Dir == "" {
				settings.Masquerade.File = nil
			}
		}
		if settings.Masquerade.Proxy != nil {
			settings.Masquerade.Proxy.URL = strings.TrimSpace(settings.Masquerade.Proxy.URL)
			if settings.Masquerade.Proxy.URL == "" && !settings.Masquerade.Proxy.RewriteHost && !settings.Masquerade.Proxy.Insecure {
				settings.Masquerade.Proxy = nil
			}
		}
		if settings.Masquerade.String != nil {
			settings.Masquerade.String.Content = strings.TrimSpace(settings.Masquerade.String.Content)
			settings.Masquerade.String.Headers = trimStringStringMap(settings.Masquerade.String.Headers)
			if settings.Masquerade.String.Content == "" && len(settings.Masquerade.String.Headers) == 0 && settings.Masquerade.String.StatusCode <= 0 {
				settings.Masquerade.String = nil
			}
		}
		if settings.Masquerade.Type == "" {
			switch {
			case settings.Masquerade.Proxy != nil:
				settings.Masquerade.Type = "proxy"
			case settings.Masquerade.File != nil:
				settings.Masquerade.Type = "file"
			case settings.Masquerade.String != nil:
				settings.Masquerade.Type = "string"
			}
		}
	}

	if settings.QUIC != nil && isEmptyStruct(settings.QUIC) {
		settings.QUIC = nil
	}
	if settings.Bandwidth != nil {
		settings.Bandwidth.Up = strings.TrimSpace(settings.Bandwidth.Up)
		settings.Bandwidth.Down = strings.TrimSpace(settings.Bandwidth.Down)
		if settings.Bandwidth.Up == "" && settings.Bandwidth.Down == "" {
			settings.Bandwidth = nil
		}
	}

	switch settings.TLSMode {
	case "tls":
		settings.ACME = nil
	case "acme":
		settings.TLS = nil
	}
	if settings.Auth.Type == "" {
		settings.Auth.Type = "password"
	}
	return settings
}

func validateSettings(input Hy2Settings) Hy2SettingsValidation {
	settings := normalizeSettings(input)
	v := Hy2SettingsValidation{Errors: []string{}, Warnings: []string{}}

	if settings.Listen == "" {
		v.Errors = append(v.Errors, "listen is required")
	} else if !validListenAddress(settings.Listen) {
		v.Errors = append(v.Errors, "listen must be host:port or :port with a single valid port")
	}

	switch settings.TLSMode {
	case "tls":
		if settings.TLS == nil {
			v.Errors = append(v.Errors, "tls mode requires tls section")
		} else {
			if settings.TLS.Cert == "" {
				v.Errors = append(v.Errors, "tls.cert is required in tls mode")
			}
			if settings.TLS.Key == "" {
				v.Errors = append(v.Errors, "tls.key is required in tls mode")
			}
		}
	case "acme":
		if settings.ACME == nil {
			v.Errors = append(v.Errors, "acme mode requires acme section")
		} else {
			if len(settings.ACME.Domains) == 0 {
				v.Errors = append(v.Errors, "acme.domains must contain at least one domain")
			}
			if settings.ACME.Email == "" {
				v.Warnings = append(v.Warnings, "acme.email is empty")
			}
			acmeType := settings.ACME.Type
			if acmeType == "" {
				acmeType = "http"
			}
			switch acmeType {
			case "http", "tls":
			case "dns":
				if settings.ACME.DNS == nil || strings.TrimSpace(settings.ACME.DNS.Name) == "" {
					v.Errors = append(v.Errors, "acme.dns.name is required when acme.type=dns")
				}
			default:
				v.Errors = append(v.Errors, "acme.type must be http, tls or dns")
			}
		}
	case "conflict":
		v.Errors = append(v.Errors, "tls and acme are mutually exclusive")
	default:
		v.Errors = append(v.Errors, "tlsMode must be either tls or acme")
	}

	switch settings.Auth.Type {
	case "password":
		if settings.Auth.Password == "" {
			v.Errors = append(v.Errors, "auth.password is required when auth.type=password")
		}
	case "userpass":
		if len(settings.Auth.Userpass) == 0 {
			v.Errors = append(v.Errors, "auth.userpass requires at least one username/password entry")
		}
	case "http":
		if !isValidAbsURL(settings.Auth.HTTPURL()) {
			v.Errors = append(v.Errors, "auth.http.url must be a valid absolute URL")
		}
	case "command":
		if settings.Auth.Command == "" {
			v.Errors = append(v.Errors, "auth.command is required when auth.type=command")
		}
	default:
		v.Errors = append(v.Errors, "auth.type must be password, userpass, http, or command")
	}

	if settings.Obfs != nil {
		if settings.Obfs.Type != "salamander" {
			v.Errors = append(v.Errors, "obfs.type must be salamander")
		} else if settings.Obfs.Salamander == nil || strings.TrimSpace(settings.Obfs.Salamander.Password) == "" {
			v.Errors = append(v.Errors, "obfs.salamander.password is required when obfs.type=salamander")
		}
	}

	if settings.UDPIdleTimeout != "" && !isValidDuration(settings.UDPIdleTimeout) {
		v.Errors = append(v.Errors, "udpIdleTimeout must be a valid Go duration")
	}
	if settings.Bandwidth != nil {
		if settings.Bandwidth.Up == "" || settings.Bandwidth.Down == "" {
			v.Errors = append(v.Errors, "bandwidth.up and bandwidth.down are both required when bandwidth is set")
		} else {
			if !isValidBandwidth(settings.Bandwidth.Up) {
				v.Errors = append(v.Errors, "bandwidth.up must use a valid format (e.g. 100 mbps)")
			}
			if !isValidBandwidth(settings.Bandwidth.Down) {
				v.Errors = append(v.Errors, "bandwidth.down must use a valid format (e.g. 100 mbps)")
			}
		}
	}

	if settings.Resolver != nil {
		switch settings.Resolver.Type {
		case "tcp":
			if settings.Resolver.TCP == nil || strings.TrimSpace(settings.Resolver.TCP.Addr) == "" {
				v.Errors = append(v.Errors, "resolver.tcp.addr is required when resolver.type=tcp")
			}
		case "udp":
			if settings.Resolver.UDP == nil || strings.TrimSpace(settings.Resolver.UDP.Addr) == "" {
				v.Errors = append(v.Errors, "resolver.udp.addr is required when resolver.type=udp")
			}
		case "tls":
			if settings.Resolver.TLS == nil || strings.TrimSpace(settings.Resolver.TLS.Addr) == "" {
				v.Errors = append(v.Errors, "resolver.tls.addr is required when resolver.type=tls")
			}
		case "https":
			if settings.Resolver.HTTPS == nil || strings.TrimSpace(settings.Resolver.HTTPS.Addr) == "" {
				v.Errors = append(v.Errors, "resolver.https.addr is required when resolver.type=https")
			}
		case "":
			v.Errors = append(v.Errors, "resolver.type is required when resolver section is present")
		default:
			v.Errors = append(v.Errors, "resolver.type must be tcp, udp, tls, or https")
		}
	}

	if settings.Sniff != nil {
		if settings.Sniff.Timeout != "" && !isValidDuration(settings.Sniff.Timeout) {
			v.Errors = append(v.Errors, "sniff.timeout must be a valid Go duration")
		}
		if settings.Sniff.TCPPorts != "" && !isValidSniffPorts(settings.Sniff.TCPPorts) {
			v.Errors = append(v.Errors, "sniff.tcpPorts must be a valid port list or 'all'")
		}
		if settings.Sniff.UDPPorts != "" && !isValidSniffPorts(settings.Sniff.UDPPorts) {
			v.Errors = append(v.Errors, "sniff.udpPorts must be a valid port list or 'all'")
		}
	}
	if settings.ACL != nil {
		if settings.ACL.GeoUpdateInterval != "" && !isValidDuration(settings.ACL.GeoUpdateInterval) {
			v.Errors = append(v.Errors, "acl.geoUpdateInterval must be a valid Go duration")
		}
		if settings.ACL.File != "" && len(settings.ACL.Inline) > 0 {
			v.Errors = append(v.Errors, "acl.file and acl.inline are mutually exclusive")
		}
	}
	for idx, outbound := range settings.Outbounds {
		if strings.TrimSpace(outbound.Name) == "" {
			v.Errors = append(v.Errors, fmt.Sprintf("outbounds[%d].name is required", idx))
		}
		switch strings.ToLower(strings.TrimSpace(outbound.Type)) {
		case "direct":
			if outbound.Direct == nil {
				v.Errors = append(v.Errors, fmt.Sprintf("outbounds[%d].direct section is required when type=direct", idx))
			}
		case "socks5":
			if outbound.SOCKS5 == nil || strings.TrimSpace(outbound.SOCKS5.Addr) == "" {
				v.Errors = append(v.Errors, fmt.Sprintf("outbounds[%d].socks5.addr is required when type=socks5", idx))
			}
		case "http":
			if outbound.HTTP == nil || !isValidAbsURL(outbound.HTTP.URL) {
				v.Errors = append(v.Errors, fmt.Sprintf("outbounds[%d].http.url must be a valid absolute URL when type=http", idx))
			}
		case "":
			v.Errors = append(v.Errors, fmt.Sprintf("outbounds[%d].type is required", idx))
		default:
			v.Errors = append(v.Errors, fmt.Sprintf("outbounds[%d].type must be direct, socks5, or http", idx))
		}
	}

	if settings.TrafficStats != nil {
		if settings.TrafficStats.Listen == "" {
			v.Warnings = append(v.Warnings, "trafficStats.listen is empty")
		} else if !validListenAddress(settings.TrafficStats.Listen) {
			v.Errors = append(v.Errors, "trafficStats.listen must be host:port or :port")
		}
		if settings.TrafficStats.Secret == "" {
			v.Warnings = append(v.Warnings, "trafficStats.secret is empty")
		}
	}

	if settings.Masquerade != nil {
		if settings.Masquerade.ListenHTTP != "" && !validListenAddress(settings.Masquerade.ListenHTTP) {
			v.Errors = append(v.Errors, "masquerade.listenHTTP must be host:port or :port")
		}
		if settings.Masquerade.ListenHTTPS != "" && !validListenAddress(settings.Masquerade.ListenHTTPS) {
			v.Errors = append(v.Errors, "masquerade.listenHTTPS must be host:port or :port")
		}
		switch settings.Masquerade.Type {
		case "file":
			if settings.Masquerade.File == nil || strings.TrimSpace(settings.Masquerade.File.Dir) == "" {
				v.Errors = append(v.Errors, "masquerade.file.dir is required when masquerade.type=file")
			}
		case "proxy":
			if settings.Masquerade.Proxy == nil || !isValidAbsURL(settings.Masquerade.Proxy.URL) {
				v.Errors = append(v.Errors, "masquerade.proxy.url must be a valid absolute URL when masquerade.type=proxy")
			}
		case "string":
			if settings.Masquerade.String == nil {
				v.Errors = append(v.Errors, "masquerade.string block is required when masquerade.type=string")
			} else if settings.Masquerade.String.StatusCode != 0 && (settings.Masquerade.String.StatusCode < 100 || settings.Masquerade.String.StatusCode > 999) {
				v.Errors = append(v.Errors, "masquerade.string.statusCode must be between 100 and 999")
			}
		case "":
			v.Errors = append(v.Errors, "masquerade.type is required when masquerade section is present")
		default:
			v.Errors = append(v.Errors, "masquerade.type must be file, proxy, or string")
		}
	}

	v.Valid = len(v.Errors) == 0
	return v
}
func buildSettingsMap(settings Hy2Settings) map[string]any {
	settings = normalizeSettings(settings)
	out := map[string]any{}
	if settings.Listen != "" {
		out["listen"] = settings.Listen
	}
	if settings.DisableUDP {
		out["disableUDP"] = true
	}
	if settings.UDPIdleTimeout != "" {
		out["udpIdleTimeout"] = settings.UDPIdleTimeout
	}
	if settings.IgnoreClientBandwidth {
		out["ignoreClientBandwidth"] = true
	}
	if settings.SpeedTest {
		out["speedTest"] = true
	}

	if m := buildServerQUICMap(settings.QUIC); len(m) > 0 {
		out["quic"] = m
	}
	if m := buildServerBandwidthMap(settings.Bandwidth); len(m) > 0 {
		out["bandwidth"] = m
	}
	if settings.TLSMode == "tls" {
		if m := buildServerTLSMap(settings.TLS); len(m) > 0 {
			out["tls"] = m
		}
	}
	if settings.TLSMode == "acme" {
		if m := buildServerACMEMap(settings.ACME); len(m) > 0 {
			out["acme"] = m
		}
	}
	if m := buildServerObfsMap(settings.Obfs); len(m) > 0 {
		out["obfs"] = m
	}
	if m := buildServerAuthMap(settings.Auth); len(m) > 0 {
		out["auth"] = m
	}
	if m := buildServerResolverMap(settings.Resolver); len(m) > 0 {
		out["resolver"] = m
	}
	if m := buildServerSniffMap(settings.Sniff); len(m) > 0 {
		out["sniff"] = m
	}
	if m := buildServerACLMap(settings.ACL); len(m) > 0 {
		out["acl"] = m
	}
	if m := buildServerOutboundsList(settings.Outbounds); len(m) > 0 {
		out["outbounds"] = m
	}
	if m := buildServerTrafficStatsMap(settings.TrafficStats); len(m) > 0 {
		out["trafficStats"] = m
	}
	if m := buildServerMasqueradeMap(settings.Masquerade); len(m) > 0 {
		out["masquerade"] = m
	}

	normalized, ok := normalizeYAMLValue(out).(map[string]any)
	if !ok {
		return map[string]any{}
	}
	return normalized
}

func buildServerQUICMap(cfg *Hy2ServerQUIC) map[string]any {
	if cfg == nil {
		return nil
	}
	out := map[string]any{}
	if cfg.InitStreamReceiveWindow > 0 {
		out["initStreamReceiveWindow"] = cfg.InitStreamReceiveWindow
	}
	if cfg.MaxStreamReceiveWindow > 0 {
		out["maxStreamReceiveWindow"] = cfg.MaxStreamReceiveWindow
	}
	if cfg.InitConnReceiveWindow > 0 {
		out["initConnReceiveWindow"] = cfg.InitConnReceiveWindow
	}
	if cfg.MaxConnReceiveWindow > 0 {
		out["maxConnReceiveWindow"] = cfg.MaxConnReceiveWindow
	}
	if strings.TrimSpace(cfg.MaxIdleTimeout) != "" {
		out["maxIdleTimeout"] = strings.TrimSpace(cfg.MaxIdleTimeout)
	}
	if cfg.MaxIncomingStreams > 0 {
		out["maxIncomingStreams"] = cfg.MaxIncomingStreams
	}
	if cfg.DisablePathMTUDiscovery {
		out["disablePathMTUDiscovery"] = true
	}
	return out
}

func buildServerBandwidthMap(cfg *Hy2ServerBandwidth) map[string]any {
	if cfg == nil {
		return nil
	}
	out := map[string]any{}
	if strings.TrimSpace(cfg.Up) != "" {
		out["up"] = strings.TrimSpace(cfg.Up)
	}
	if strings.TrimSpace(cfg.Down) != "" {
		out["down"] = strings.TrimSpace(cfg.Down)
	}
	return out
}

func buildServerTLSMap(cfg *Hy2ServerTLS) map[string]any {
	if cfg == nil {
		return nil
	}
	out := map[string]any{}
	if cfg.Cert != "" {
		out["cert"] = cfg.Cert
	}
	if cfg.Key != "" {
		out["key"] = cfg.Key
	}
	if cfg.SNIGuard != "" {
		out["sniGuard"] = cfg.SNIGuard
	}
	if cfg.ClientCA != "" {
		out["clientCA"] = cfg.ClientCA
	}
	return out
}

func buildServerACMEMap(cfg *Hy2ServerACME) map[string]any {
	if cfg == nil {
		return nil
	}
	out := map[string]any{}
	if domains := trimStringSlice(cfg.Domains); len(domains) > 0 {
		out["domains"] = domains
	}
	if cfg.Email != "" {
		out["email"] = cfg.Email
	}
	if cfg.CA != "" {
		out["ca"] = cfg.CA
	}
	if cfg.ListenHost != "" {
		out["listenHost"] = cfg.ListenHost
	}
	if cfg.Dir != "" {
		out["dir"] = cfg.Dir
	}
	if cfg.Type != "" {
		out["type"] = cfg.Type
	}
	if cfg.HTTP != nil && cfg.HTTP.AltPort > 0 {
		out["http"] = map[string]any{"altPort": cfg.HTTP.AltPort}
	}
	if cfg.TLS != nil && cfg.TLS.AltPort > 0 {
		out["tls"] = map[string]any{"altPort": cfg.TLS.AltPort}
	}
	if cfg.DNS != nil {
		dnsMap := map[string]any{}
		if cfg.DNS.Name != "" {
			dnsMap["name"] = cfg.DNS.Name
		}
		if len(cfg.DNS.Config) > 0 {
			dnsMap["config"] = cfg.DNS.Config
		}
		if len(dnsMap) > 0 {
			out["dns"] = dnsMap
		}
	}
	return out
}

func buildServerObfsMap(cfg *Hy2ServerObfs) map[string]any {
	if cfg == nil || cfg.Type == "" {
		return nil
	}
	if !strings.EqualFold(cfg.Type, "salamander") {
		return nil
	}
	password := ""
	if cfg.Salamander != nil {
		password = cfg.Salamander.Password
	}
	return map[string]any{"type": "salamander", "salamander": map[string]any{"password": password}}
}

func buildServerAuthMap(cfg Hy2ServerAuth) map[string]any {
	auth := normalizeSettings(Hy2Settings{Auth: cfg}).Auth
	if auth.Type == "" {
		return nil
	}
	out := map[string]any{"type": auth.Type}
	switch auth.Type {
	case "password":
		out["password"] = auth.Password
	case "userpass":
		out["userpass"] = auth.Userpass
	case "http":
		hm := map[string]any{}
		if auth.HTTP != nil {
			if auth.HTTP.URL != "" {
				hm["url"] = auth.HTTP.URL
			}
			if auth.HTTP.Insecure {
				hm["insecure"] = true
			}
		}
		out["http"] = hm
	case "command":
		out["command"] = auth.Command
	}
	return out
}

func buildServerResolverMap(cfg *Hy2ServerResolver) map[string]any {
	if cfg == nil {
		return nil
	}
	out := map[string]any{}
	if cfg.Type != "" {
		out["type"] = cfg.Type
	}
	if cfg.TCP != nil {
		out["tcp"] = map[string]any{"addr": cfg.TCP.Addr, "timeout": cfg.TCP.Timeout}
	}
	if cfg.UDP != nil {
		out["udp"] = map[string]any{"addr": cfg.UDP.Addr, "timeout": cfg.UDP.Timeout}
	}
	if cfg.TLS != nil {
		out["tls"] = map[string]any{"addr": cfg.TLS.Addr, "timeout": cfg.TLS.Timeout, "sni": cfg.TLS.SNI, "insecure": cfg.TLS.Insecure}
	}
	if cfg.HTTPS != nil {
		out["https"] = map[string]any{"addr": cfg.HTTPS.Addr, "timeout": cfg.HTTPS.Timeout, "sni": cfg.HTTPS.SNI, "insecure": cfg.HTTPS.Insecure}
	}
	return out
}

func buildServerSniffMap(cfg *Hy2ServerSniff) map[string]any {
	if cfg == nil {
		return nil
	}
	out := map[string]any{}
	if cfg.Enable {
		out["enable"] = true
	}
	if cfg.Timeout != "" {
		out["timeout"] = cfg.Timeout
	}
	if cfg.RewriteDomain {
		out["rewriteDomain"] = true
	}
	if cfg.TCPPorts != "" {
		out["tcpPorts"] = cfg.TCPPorts
	}
	if cfg.UDPPorts != "" {
		out["udpPorts"] = cfg.UDPPorts
	}
	return out
}

func buildServerACLMap(cfg *Hy2ServerACL) map[string]any {
	if cfg == nil {
		return nil
	}
	out := map[string]any{}
	if cfg.File != "" {
		out["file"] = cfg.File
	}
	if len(cfg.Inline) > 0 {
		out["inline"] = cfg.Inline
	}
	if cfg.GeoIP != "" {
		out["geoip"] = cfg.GeoIP
	}
	if cfg.GeoSite != "" {
		out["geosite"] = cfg.GeoSite
	}
	if cfg.GeoUpdateInterval != "" {
		out["geoUpdateInterval"] = cfg.GeoUpdateInterval
	}
	return out
}

func buildServerOutboundsList(items []Hy2ServerOutbound) []any {
	if len(items) == 0 {
		return nil
	}
	out := make([]any, 0, len(items))
	for _, item := range items {
		entry := map[string]any{}
		if item.Name != "" {
			entry["name"] = item.Name
		}
		if item.Type != "" {
			entry["type"] = item.Type
		}
		if item.Direct != nil {
			direct := map[string]any{}
			if item.Direct.Mode != "" {
				direct["mode"] = item.Direct.Mode
			}
			if item.Direct.BindIPv4 != "" {
				direct["bindIPv4"] = item.Direct.BindIPv4
			}
			if item.Direct.BindIPv6 != "" {
				direct["bindIPv6"] = item.Direct.BindIPv6
			}
			if item.Direct.BindDevice != "" {
				direct["bindDevice"] = item.Direct.BindDevice
			}
			if item.Direct.FastOpen {
				direct["fastOpen"] = true
			}
			if len(direct) > 0 {
				entry["direct"] = direct
			}
		}
		if item.SOCKS5 != nil {
			socks := map[string]any{}
			if item.SOCKS5.Addr != "" {
				socks["addr"] = item.SOCKS5.Addr
			}
			if item.SOCKS5.Username != "" {
				socks["username"] = item.SOCKS5.Username
			}
			if item.SOCKS5.Password != "" {
				socks["password"] = item.SOCKS5.Password
			}
			if len(socks) > 0 {
				entry["socks5"] = socks
			}
		}
		if item.HTTP != nil {
			httpMap := map[string]any{}
			if item.HTTP.URL != "" {
				httpMap["url"] = item.HTTP.URL
			}
			if item.HTTP.Insecure {
				httpMap["insecure"] = true
			}
			if len(httpMap) > 0 {
				entry["http"] = httpMap
			}
		}
		if len(entry) > 0 {
			out = append(out, entry)
		}
	}
	return out
}

func buildServerTrafficStatsMap(cfg *Hy2ServerTrafficStats) map[string]any {
	if cfg == nil {
		return nil
	}
	out := map[string]any{}
	if cfg.Listen != "" {
		out["listen"] = cfg.Listen
	}
	if cfg.Secret != "" {
		out["secret"] = cfg.Secret
	}
	return out
}

func buildServerMasqueradeMap(cfg *Hy2ServerMasquerade) map[string]any {
	if cfg == nil {
		return nil
	}
	out := map[string]any{}
	if cfg.Type != "" {
		out["type"] = cfg.Type
	}
	if cfg.File != nil && cfg.File.Dir != "" {
		out["file"] = map[string]any{"dir": cfg.File.Dir}
	}
	if cfg.Proxy != nil {
		proxy := map[string]any{}
		if cfg.Proxy.URL != "" {
			proxy["url"] = cfg.Proxy.URL
		}
		if cfg.Proxy.RewriteHost {
			proxy["rewriteHost"] = true
		}
		if cfg.Proxy.Insecure {
			proxy["insecure"] = true
		}
		if len(proxy) > 0 {
			out["proxy"] = proxy
		}
	}
	if cfg.String != nil {
		strMap := map[string]any{}
		if cfg.String.Content != "" {
			strMap["content"] = cfg.String.Content
		}
		if len(cfg.String.Headers) > 0 {
			strMap["headers"] = cfg.String.Headers
		}
		if cfg.String.StatusCode > 0 {
			strMap["statusCode"] = cfg.String.StatusCode
		}
		if len(strMap) > 0 {
			out["string"] = strMap
		}
	}
	if cfg.ListenHTTP != "" {
		out["listenHTTP"] = cfg.ListenHTTP
	}
	if cfg.ListenHTTPS != "" {
		out["listenHTTPS"] = cfg.ListenHTTPS
	}
	if cfg.ForceHTTPS {
		out["forceHTTPS"] = true
	}
	return out
}
func normalizeClientProfile(input Hy2ClientProfile) Hy2ClientProfile {
	profile := input
	profile.Name = strings.TrimSpace(profile.Name)
	profile.Server = strings.TrimSpace(profile.Server)
	profile.Auth = strings.TrimSpace(profile.Auth)
	profile.Transport.Type = strings.ToLower(strings.TrimSpace(profile.Transport.Type))
	if profile.Transport.Type == "" {
		profile.Transport.Type = "udp"
	}
	if profile.Transport.UDP != nil {
		profile.Transport.UDP.HopInterval = strings.TrimSpace(profile.Transport.UDP.HopInterval)
		if isEmptyStruct(profile.Transport.UDP) {
			profile.Transport.UDP = nil
		}
	}
	profile.TLS.SNI = strings.TrimSpace(profile.TLS.SNI)
	profile.TLS.PinSHA256 = trimStringSlice(profile.TLS.PinSHA256)
	profile.TLS.CA = strings.TrimSpace(profile.TLS.CA)
	profile.TLS.ClientCertificate = strings.TrimSpace(profile.TLS.ClientCertificate)
	profile.TLS.ClientKey = strings.TrimSpace(profile.TLS.ClientKey)

	if profile.Obfs != nil {
		profile.Obfs.Type = strings.ToLower(strings.TrimSpace(profile.Obfs.Type))
		if profile.Obfs.Salamander != nil {
			profile.Obfs.Salamander.Password = strings.TrimSpace(profile.Obfs.Salamander.Password)
		}
		if profile.Obfs.Type == "" {
			profile.Obfs = nil
		}
	}
	if profile.QUIC != nil {
		profile.QUIC.MaxIdleTimeout = strings.TrimSpace(profile.QUIC.MaxIdleTimeout)
		profile.QUIC.KeepAlivePeriod = strings.TrimSpace(profile.QUIC.KeepAlivePeriod)
		if profile.QUIC.Sockopts != nil {
			profile.QUIC.Sockopts.BindInterface = strings.TrimSpace(profile.QUIC.Sockopts.BindInterface)
			profile.QUIC.Sockopts.FDControlUnixSocket = strings.TrimSpace(profile.QUIC.Sockopts.FDControlUnixSocket)
			if isEmptyStruct(profile.QUIC.Sockopts) {
				profile.QUIC.Sockopts = nil
			}
		}
		if isEmptyStruct(profile.QUIC) {
			profile.QUIC = nil
		}
	}
	if profile.Bandwidth != nil {
		profile.Bandwidth.Up = strings.TrimSpace(profile.Bandwidth.Up)
		profile.Bandwidth.Down = strings.TrimSpace(profile.Bandwidth.Down)
		if profile.Bandwidth.Up == "" && profile.Bandwidth.Down == "" {
			profile.Bandwidth = nil
		}
	}
	return profile
}

func validateClientProfile(profile Hy2ClientProfile, modeTemplate string) Hy2ClientValidation {
	v := Hy2ClientValidation{Errors: []string{}, Warnings: []string{}}
	host, ports := splitServerForClient(profile.Server)
	if host == "" {
		v.Errors = append(v.Errors, "profile.server is required")
	}
	if ports != "" && !validPortUnion(ports) {
		v.Errors = append(v.Errors, "profile.server port section must be a valid port union")
	}
	if strings.TrimSpace(profile.Auth) == "" {
		v.Errors = append(v.Errors, "profile.auth is required")
	}
	if profile.TLS.SNI != "" && NormalizeHost(profile.TLS.SNI) == "" {
		v.Errors = append(v.Errors, "profile.tls.sni must be a valid host")
	}

	switch profile.Transport.Type {
	case "udp":
		if profile.Transport.UDP != nil && profile.Transport.UDP.HopInterval != "" {
			if !isValidDuration(profile.Transport.UDP.HopInterval) {
				v.Errors = append(v.Errors, "profile.transport.udp.hopInterval must be a valid Go duration")
			} else if !durationAtLeast(profile.Transport.UDP.HopInterval, 5*time.Second) {
				v.Errors = append(v.Errors, "profile.transport.udp.hopInterval must be at least 5s")
			}
		}
	default:
		v.Errors = append(v.Errors, "profile.transport.type must be udp")
	}

	if profile.Obfs != nil {
		if profile.Obfs.Type != "salamander" {
			v.Errors = append(v.Errors, "profile.obfs.type must be salamander")
		} else if profile.Obfs.Salamander == nil || strings.TrimSpace(profile.Obfs.Salamander.Password) == "" {
			v.Errors = append(v.Errors, "profile.obfs.salamander.password is required when obfs.type=salamander")
		}
	}
	if profile.Bandwidth != nil {
		if !isValidBandwidth(profile.Bandwidth.Up) {
			v.Errors = append(v.Errors, "profile.bandwidth.up must be valid")
		}
		if !isValidBandwidth(profile.Bandwidth.Down) {
			v.Errors = append(v.Errors, "profile.bandwidth.down must be valid")
		}
	}
	if profile.QUIC != nil {
		if profile.QUIC.MaxIdleTimeout != "" && !isValidDuration(profile.QUIC.MaxIdleTimeout) {
			v.Errors = append(v.Errors, "profile.quic.maxIdleTimeout must be a valid Go duration")
		}
		if profile.QUIC.KeepAlivePeriod != "" && !isValidDuration(profile.QUIC.KeepAlivePeriod) {
			v.Errors = append(v.Errors, "profile.quic.keepAlivePeriod must be a valid Go duration")
		}
	}

	mode := strings.ToLower(strings.TrimSpace(modeTemplate))
	switch mode {
	case "socks5", "http", "tun", "tcpforwarding", "udpforwarding", "tcptproxy", "udptproxy", "tcpredirect":
	default:
		v.Errors = append(v.Errors, "mode template must be socks5, http, tun, tcpForwarding, udpForwarding, tcpTProxy, udpTProxy, or tcpRedirect")
	}

	v.Valid = len(v.Errors) == 0
	return v
}

func buildClientURI(profile Hy2ClientProfile) (string, string) {
	profile = normalizeClientProfile(profile)
	host, ports := splitServerForClient(profile.Server)
	if host == "" {
		host = profile.Server
	}
	authority := host
	if strings.TrimSpace(ports) != "" {
		authority = host + ":" + strings.TrimSpace(ports)
	}
	authority = ensureBracketedIPv6(authority)

	query := url.Values{}
	if profile.TLS.SNI != "" {
		query.Set("sni", profile.TLS.SNI)
	}
	if profile.TLS.Insecure {
		query.Set("insecure", "1")
	}
	if len(profile.TLS.PinSHA256) > 0 && strings.TrimSpace(profile.TLS.PinSHA256[0]) != "" {
		query.Set("pinSHA256", strings.TrimSpace(profile.TLS.PinSHA256[0]))
	}
	if profile.Obfs != nil && strings.EqualFold(profile.Obfs.Type, "salamander") {
		query.Set("obfs", "salamander")
		if profile.Obfs.Salamander != nil && strings.TrimSpace(profile.Obfs.Salamander.Password) != "" {
			query.Set("obfs-password", strings.TrimSpace(profile.Obfs.Salamander.Password))
		}
	}

	uri := "hysteria2://" + url.PathEscape(profile.Auth) + "@" + authority + "/"
	if encoded := query.Encode(); encoded != "" {
		uri += "?" + encoded
	}
	if profile.Name != "" {
		uri += "#" + url.QueryEscape(profile.Name)
	}
	return uri, strings.Replace(uri, "hysteria2://", "hy2://", 1)
}

func buildClientYAML(profile Hy2ClientProfile, modeTemplate string) (string, error) {
	mode := strings.ToLower(strings.TrimSpace(modeTemplate))
	cfg := map[string]any{"server": profile.Server, "auth": profile.Auth}

	tlsMap := map[string]any{}
	if profile.TLS.SNI != "" {
		tlsMap["sni"] = profile.TLS.SNI
	}
	if profile.TLS.Insecure {
		tlsMap["insecure"] = true
	}
	if len(profile.TLS.PinSHA256) > 0 {
		tlsMap["pinSHA256"] = profile.TLS.PinSHA256
	}
	if profile.TLS.CA != "" {
		tlsMap["ca"] = profile.TLS.CA
	}
	if profile.TLS.ClientCertificate != "" {
		tlsMap["clientCertificate"] = profile.TLS.ClientCertificate
	}
	if profile.TLS.ClientKey != "" {
		tlsMap["clientKey"] = profile.TLS.ClientKey
	}
	if len(tlsMap) > 0 {
		cfg["tls"] = tlsMap
	}

	transport := map[string]any{"type": profile.Transport.Type}
	if profile.Transport.UDP != nil {
		udp := map[string]any{}
		if profile.Transport.UDP.HopInterval != "" {
			udp["hopInterval"] = profile.Transport.UDP.HopInterval
		}
		if len(udp) > 0 {
			transport["udp"] = udp
		}
	}
	if len(transport) > 0 {
		cfg["transport"] = transport
	}

	if profile.Obfs != nil {
		obfs := map[string]any{"type": profile.Obfs.Type}
		if profile.Obfs.Salamander != nil {
			obfs["salamander"] = map[string]any{"password": profile.Obfs.Salamander.Password}
		}
		cfg["obfs"] = obfs
	}
	if profile.QUIC != nil {
		quic := map[string]any{}
		if profile.QUIC.InitStreamReceiveWindow > 0 {
			quic["initStreamReceiveWindow"] = profile.QUIC.InitStreamReceiveWindow
		}
		if profile.QUIC.MaxStreamReceiveWindow > 0 {
			quic["maxStreamReceiveWindow"] = profile.QUIC.MaxStreamReceiveWindow
		}
		if profile.QUIC.InitConnReceiveWindow > 0 {
			quic["initConnReceiveWindow"] = profile.QUIC.InitConnReceiveWindow
		}
		if profile.QUIC.MaxConnReceiveWindow > 0 {
			quic["maxConnReceiveWindow"] = profile.QUIC.MaxConnReceiveWindow
		}
		if profile.QUIC.MaxIdleTimeout != "" {
			quic["maxIdleTimeout"] = profile.QUIC.MaxIdleTimeout
		}
		if profile.QUIC.KeepAlivePeriod != "" {
			quic["keepAlivePeriod"] = profile.QUIC.KeepAlivePeriod
		}
		if profile.QUIC.DisablePathMTUDiscovery {
			quic["disablePathMTUDiscovery"] = true
		}
		if profile.QUIC.Sockopts != nil {
			sock := map[string]any{}
			if profile.QUIC.Sockopts.BindInterface != "" {
				sock["bindInterface"] = profile.QUIC.Sockopts.BindInterface
			}
			if profile.QUIC.Sockopts.FWMark > 0 {
				sock["fwmark"] = profile.QUIC.Sockopts.FWMark
			}
			if profile.QUIC.Sockopts.FDControlUnixSocket != "" {
				sock["fdControlUnixSocket"] = profile.QUIC.Sockopts.FDControlUnixSocket
			}
			if len(sock) > 0 {
				quic["sockopts"] = sock
			}
		}
		if len(quic) > 0 {
			cfg["quic"] = quic
		}
	}
	if profile.Bandwidth != nil {
		cfg["bandwidth"] = map[string]any{"up": profile.Bandwidth.Up, "down": profile.Bandwidth.Down}
	}
	if profile.FastOpen {
		cfg["fastOpen"] = true
	}
	if profile.Lazy {
		cfg["lazy"] = true
	}

	switch mode {
	case "socks5":
		cfg["socks5"] = map[string]any{"listen": "127.0.0.1:1080"}
	case "http":
		cfg["http"] = map[string]any{"listen": "127.0.0.1:8080"}
	case "tun":
		cfg["tun"] = map[string]any{
			"name": "hysteria-tun",
			"mtu":  1500,
			"address": map[string]any{"ipv4": "172.30.0.2/30"},
			"route": map[string]any{"ipv4": []string{"0.0.0.0/0"}, "ipv6": []string{"::/0"}},
		}
	case "tcpforwarding":
		cfg["tcpForwarding"] = []any{map[string]any{"listen": "127.0.0.1:2222", "remote": "127.0.0.1:22"}}
	case "udpforwarding":
		cfg["udpForwarding"] = []any{map[string]any{"listen": "127.0.0.1:5353", "remote": "8.8.8.8:53", "timeout": "60s"}}
	case "tcptproxy":
		cfg["tcpTProxy"] = map[string]any{"listen": ":2500"}
	case "udptproxy":
		cfg["udpTProxy"] = map[string]any{"listen": ":2500", "timeout": "60s"}
	case "tcpredirect":
		cfg["tcpRedirect"] = map[string]any{"listen": ":12345"}
	default:
		return "", errors.New("mode template is required")
	}

	normalized, ok := normalizeYAMLValue(cfg).(map[string]any)
	if !ok {
		return "", errors.New("failed to render client config")
	}
	return marshalYAMLMap(normalized)
}

func mergeKnownValues(current any, desired any, schema *schemaNode) any {
	if schema == nil {
		return desired
	}
	if schema.AnyMap {
		return desired
	}

	if desiredMap, ok := toStringAnyMap(desired); ok {
		currentMap, _ := toStringAnyMap(current)
		out := make(map[string]any)
		for k, v := range currentMap {
			if schema.Fields == nil {
				out[k] = v
				continue
			}
			if _, known := schema.Fields[k]; !known {
				out[k] = v
			}
		}
		if schema.Fields == nil {
			for k, v := range desiredMap {
				out[k] = normalizeYAMLValue(v)
			}
			return out
		}
		for key, child := range schema.Fields {
			dv, exists := desiredMap[key]
			if !exists {
				continue
			}
			cv, _ := currentMap[key]
			out[key] = mergeKnownValues(cv, dv, child)
		}
		return out
	}

	if desiredSlice, ok := toAnySlice(desired); ok {
		if schema.ListItem == nil {
			return normalizeYAMLValue(desiredSlice)
		}
		currentSlice, _ := toAnySlice(current)
		out := make([]any, 0, len(desiredSlice))
		for i, item := range desiredSlice {
			var currentItem any
			if i < len(currentSlice) {
				currentItem = currentSlice[i]
			}
			out = append(out, mergeKnownValues(currentItem, item, schema.ListItem))
		}
		return out
	}
	return normalizeYAMLValue(desired)
}

func collectUnknown(root map[string]any, schema *schemaNode) []string {
	paths := make([]string, 0, 8)
	collectUnknownFromValue(root, schema, "", &paths)
	if len(paths) == 0 {
		return nil
	}
	sort.Strings(paths)
	uniq := make([]string, 0, len(paths))
	for _, item := range paths {
		if len(uniq) == 0 || uniq[len(uniq)-1] != item {
			uniq = append(uniq, item)
		}
	}
	return uniq
}

func collectUnknownFromValue(value any, schema *schemaNode, path string, out *[]string) {
	if schema == nil || schema.AnyMap {
		return
	}
	if m, ok := toStringAnyMap(value); ok {
		for key, childValue := range m {
			childPath := key
			if path != "" {
				childPath = path + "." + key
			}
			if schema.Fields == nil {
				*out = append(*out, childPath)
				continue
			}
			childSchema, known := schema.Fields[key]
			if !known {
				*out = append(*out, childPath)
				continue
			}
			collectUnknownFromValue(childValue, childSchema, childPath, out)
		}
		return
	}
	if list, ok := toAnySlice(value); ok {
		if schema.ListItem == nil {
			return
		}
		for i, item := range list {
			childPath := fmt.Sprintf("%s[%d]", path, i)
			collectUnknownFromValue(item, schema.ListItem, childPath, out)
		}
	}
}

func parseYAMLMap(content string) (map[string]any, error) {
	if strings.TrimSpace(content) == "" {
		return map[string]any{}, nil
	}
	var raw any
	if err := yaml.Unmarshal([]byte(content), &raw); err != nil {
		return nil, err
	}
	normalized := normalizeYAMLValue(raw)
	if normalized == nil {
		return map[string]any{}, nil
	}
	m, ok := normalized.(map[string]any)
	if !ok {
		return nil, errors.New("top-level YAML value must be a mapping")
	}
	return m, nil
}

func marshalYAMLMap(root map[string]any) (string, error) {
	if root == nil {
		root = map[string]any{}
	}
	buf, err := yaml.Marshal(root)
	if err != nil {
		return "", err
	}
	return strings.TrimRight(string(buf), "\n") + "\n", nil
}

func normalizeYAMLValue(value any) any {
	if value == nil {
		return nil
	}
	rv := reflect.ValueOf(value)
	switch rv.Kind() {
	case reflect.Map:
		out := make(map[string]any)
		for _, key := range rv.MapKeys() {
			out[fmt.Sprintf("%v", key.Interface())] = normalizeYAMLValue(rv.MapIndex(key).Interface())
		}
		return out
	case reflect.Slice, reflect.Array:
		out := make([]any, 0, rv.Len())
		for i := 0; i < rv.Len(); i++ {
			out = append(out, normalizeYAMLValue(rv.Index(i).Interface()))
		}
		return out
	default:
		return value
	}
}

func toStringAnyMap(value any) (map[string]any, bool) {
	if value == nil {
		return nil, false
	}
	m, ok := normalizeYAMLValue(value).(map[string]any)
	return m, ok
}

func toAnySlice(value any) ([]any, bool) {
	if value == nil {
		return nil, false
	}
	slice, ok := normalizeYAMLValue(value).([]any)
	return slice, ok
}

func toString(value any) string {
	if value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64, bool:
		return fmt.Sprintf("%v", typed)
	default:
		return ""
	}
}

func toBool(value any) bool {
	if value == nil {
		return false
	}
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		s := strings.ToLower(strings.TrimSpace(typed))
		return s == "1" || s == "true" || s == "yes" || s == "on"
	case int:
		return typed != 0
	case int64:
		return typed != 0
	case float64:
		return typed != 0
	default:
		return false
	}
}

func toInt(value any) int {
	if value == nil {
		return 0
	}
	switch typed := value.(type) {
	case int:
		return typed
	case int8:
		return int(typed)
	case int16:
		return int(typed)
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case uint:
		return int(typed)
	case uint8:
		return int(typed)
	case uint16:
		return int(typed)
	case uint32:
		return int(typed)
	case uint64:
		return int(typed)
	case float32:
		return int(typed)
	case float64:
		return int(typed)
	case string:
		parsed, _ := strconv.Atoi(strings.TrimSpace(typed))
		return parsed
	default:
		return 0
	}
}

func toInt64(value any) int64 {
	if value == nil {
		return 0
	}
	switch typed := value.(type) {
	case int:
		return int64(typed)
	case int8:
		return int64(typed)
	case int16:
		return int64(typed)
	case int32:
		return int64(typed)
	case int64:
		return typed
	case uint:
		return int64(typed)
	case uint8:
		return int64(typed)
	case uint16:
		return int64(typed)
	case uint32:
		return int64(typed)
	case uint64:
		return int64(typed)
	case float32:
		return int64(typed)
	case float64:
		return int64(typed)
	case string:
		parsed, _ := strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
		return parsed
	default:
		return 0
	}
}

func toStringSlice(value any) []string {
	items, ok := toAnySlice(value)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		text := strings.TrimSpace(toString(item))
		if text != "" {
			out = append(out, text)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func toStringStringMap(value any) map[string]string {
	m, ok := toStringAnyMap(value)
	if !ok {
		return nil
	}
	out := make(map[string]string)
	for key, val := range m {
		k := strings.TrimSpace(key)
		if k == "" {
			continue
		}
		out[k] = strings.TrimSpace(toString(val))
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
func trimStringSlice(input []string) []string {
	if len(input) == 0 {
		return nil
	}
	out := make([]string, 0, len(input))
	for _, item := range input {
		item = strings.TrimSpace(item)
		if item != "" {
			out = append(out, item)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func trimStringStringMap(input map[string]string) map[string]string {
	if len(input) == 0 {
		return nil
	}
	out := make(map[string]string)
	for key, val := range input {
		k := strings.TrimSpace(key)
		if k == "" {
			continue
		}
		out[k] = strings.TrimSpace(val)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func parseListen(listen string) (string, string, bool) {
	value := strings.TrimSpace(listen)
	if value == "" {
		return "", "", false
	}
	if strings.HasPrefix(value, ":") {
		ports := strings.TrimSpace(strings.TrimPrefix(value, ":"))
		return "", ports, ports != ""
	}
	if strings.HasPrefix(value, "[") {
		idx := strings.LastIndex(value, "]:")
		if idx < 0 {
			return "", "", false
		}
		host := strings.TrimSpace(value[1:idx])
		ports := strings.TrimSpace(value[idx+2:])
		return host, ports, ports != ""
	}
	idx := strings.LastIndex(value, ":")
	if idx <= 0 || idx >= len(value)-1 {
		return "", "", false
	}
	host := strings.TrimSpace(value[:idx])
	ports := strings.TrimSpace(value[idx+1:])
	if ports == "" {
		return "", "", false
	}
	return host, ports, true
}

func validListenAddress(listen string) bool {
	_, ports, ok := parseListen(listen)
	if !ok {
		return false
	}
	return validSinglePortSpec(ports)
}

func validSinglePortSpec(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" || strings.Contains(value, ",") || strings.Contains(value, "-") {
		return false
	}
	port, err := strconv.Atoi(value)
	if err != nil {
		return false
	}
	return validPort(port)
}

func validPortUnion(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	segments := strings.Split(value, ",")
	for _, segment := range segments {
		segment = strings.TrimSpace(segment)
		if segment == "" {
			return false
		}
		if strings.Contains(segment, "-") {
			parts := strings.SplitN(segment, "-", 2)
			if len(parts) != 2 {
				return false
			}
			start, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
			end, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
			if err1 != nil || err2 != nil || !validPort(start) || !validPort(end) || start > end {
				return false
			}
			continue
		}
		port, err := strconv.Atoi(segment)
		if err != nil || !validPort(port) {
			return false
		}
	}
	return true
}

func firstPortFromUnion(value string) int {
	segments := strings.Split(strings.TrimSpace(value), ",")
	if len(segments) == 0 {
		return 0
	}
	first := strings.TrimSpace(segments[0])
	if first == "" {
		return 0
	}
	if strings.Contains(first, "-") {
		parts := strings.SplitN(first, "-", 2)
		if len(parts) != 2 {
			return 0
		}
		port, _ := strconv.Atoi(strings.TrimSpace(parts[0]))
		return port
	}
	port, _ := strconv.Atoi(first)
	return port
}

func splitServerForClient(server string) (string, string) {
	value := strings.TrimSpace(server)
	if value == "" {
		return "", ""
	}
	if strings.Contains(value, "://") {
		if u, err := url.Parse(value); err == nil {
			h := strings.TrimSpace(u.Hostname())
			p := strings.TrimSpace(u.Port())
			if h != "" {
				return h, p
			}
		}
	}
	if strings.HasPrefix(value, "[") {
		idx := strings.LastIndex(value, "]:")
		if idx < 0 {
			return strings.Trim(value, "[]"), ""
		}
		host := strings.TrimSpace(value[:idx+1])
		ports := strings.TrimSpace(value[idx+2:])
		return host, ports
	}
	if strings.Count(value, ":") == 0 {
		return value, ""
	}
	idx := strings.LastIndex(value, ":")
	if idx <= 0 || idx >= len(value)-1 {
		return value, ""
	}
	host := strings.TrimSpace(value[:idx])
	ports := strings.TrimSpace(value[idx+1:])
	if !validPortUnion(ports) {
		return value, ""
	}
	return host, ports
}

func ensureBracketedIPv6(authority string) string {
	if strings.HasPrefix(authority, "[") {
		return authority
	}
	host, ports := splitServerForClient(authority)
	if strings.Count(host, ":") > 1 {
		if ports != "" {
			return "[" + strings.Trim(host, "[]") + "]:" + ports
		}
		return "[" + strings.Trim(host, "[]") + "]"
	}
	return authority
}

func validPort(value int) bool {
	return value >= 1 && value <= 65535
}

func isValidDuration(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	if durationPattern.MatchString(value) {
		return true
	}
	_, err := time.ParseDuration(value)
	return err == nil
}

func durationAtLeast(value string, min time.Duration) bool {
	parsed, err := time.ParseDuration(strings.TrimSpace(value))
	if err != nil {
		return false
	}
	return parsed >= min
}

func isValidBandwidth(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return false
	}
	value = strings.ReplaceAll(value, " ", "")
	if value == "0" {
		return true
	}
	return bandwidthPattern.MatchString(value)
}

func isValidSniffPorts(value string) bool {
	value = strings.TrimSpace(strings.ToLower(value))
	if value == "" {
		return true
	}
	if value == "all" {
		return true
	}
	return validPortUnion(value)
}

func isValidAbsURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return false
	}
	return parsed.Scheme != "" && parsed.Host != ""
}

func firstNonEmpty(values ...string) string {
	for _, item := range values {
		if strings.TrimSpace(item) != "" {
			return strings.TrimSpace(item)
		}
	}
	return ""
}

func maxInt(value int, fallback int) int {
	if value > 0 {
		return value
	}
	return fallback
}

func normalizedObfsType(obfs *Hy2ServerObfs) string {
	if obfs == nil {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(obfs.Type))
}

func normalizedResolverType(resolver *Hy2ServerResolver) string {
	if resolver == nil {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(resolver.Type))
}

func normalizedMasqueradeType(masquerade *Hy2ServerMasquerade) string {
	if masquerade == nil {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(masquerade.Type))
}

func isEmptyStruct(value any) bool {
	if value == nil {
		return true
	}
	rv := reflect.ValueOf(value)
	if rv.Kind() == reflect.Pointer {
		if rv.IsNil() {
			return true
		}
		rv = rv.Elem()
	}
	if rv.Kind() != reflect.Struct {
		return false
	}
	for i := 0; i < rv.NumField(); i++ {
		if !rv.Field(i).IsZero() {
			return false
		}
	}
	return true
}

func buildServerSchema() *schemaNode {
	return &schemaNode{Fields: map[string]*schemaNode{
		"listen":                 emptySchema,
		"tls":                    {Fields: map[string]*schemaNode{"cert": emptySchema, "key": emptySchema, "sniGuard": emptySchema, "clientCA": emptySchema}},
		"acme":                   {Fields: map[string]*schemaNode{"domains": emptySchema, "email": emptySchema, "ca": emptySchema, "listenHost": emptySchema, "dir": emptySchema, "type": emptySchema, "http": {Fields: map[string]*schemaNode{"altPort": emptySchema}}, "tls": {Fields: map[string]*schemaNode{"altPort": emptySchema}}, "dns": {Fields: map[string]*schemaNode{"name": emptySchema, "config": {AnyMap: true}}}}},
		"obfs":                   {Fields: map[string]*schemaNode{"type": emptySchema, "salamander": {Fields: map[string]*schemaNode{"password": emptySchema}}}},
		"quic":                   {Fields: map[string]*schemaNode{"initStreamReceiveWindow": emptySchema, "maxStreamReceiveWindow": emptySchema, "initConnReceiveWindow": emptySchema, "maxConnReceiveWindow": emptySchema, "maxIdleTimeout": emptySchema, "maxIncomingStreams": emptySchema, "disablePathMTUDiscovery": emptySchema}},
		"bandwidth":              {Fields: map[string]*schemaNode{"up": emptySchema, "down": emptySchema}},
		"ignoreClientBandwidth":  emptySchema,
		"speedTest":              emptySchema,
		"disableUDP":             emptySchema,
		"udpIdleTimeout":         emptySchema,
		"auth":                   {Fields: map[string]*schemaNode{"type": emptySchema, "password": emptySchema, "userpass": {AnyMap: true}, "http": {Fields: map[string]*schemaNode{"url": emptySchema, "insecure": emptySchema}}, "command": emptySchema}},
		"resolver":               {Fields: map[string]*schemaNode{"type": emptySchema, "tcp": {Fields: map[string]*schemaNode{"addr": emptySchema, "timeout": emptySchema}}, "udp": {Fields: map[string]*schemaNode{"addr": emptySchema, "timeout": emptySchema}}, "tls": {Fields: map[string]*schemaNode{"addr": emptySchema, "timeout": emptySchema, "sni": emptySchema, "insecure": emptySchema}}, "https": {Fields: map[string]*schemaNode{"addr": emptySchema, "timeout": emptySchema, "sni": emptySchema, "insecure": emptySchema}}}},
		"sniff":                  {Fields: map[string]*schemaNode{"enable": emptySchema, "timeout": emptySchema, "rewriteDomain": emptySchema, "tcpPorts": emptySchema, "udpPorts": emptySchema}},
		"acl":                    {Fields: map[string]*schemaNode{"file": emptySchema, "inline": emptySchema, "geoip": emptySchema, "geosite": emptySchema, "geoUpdateInterval": emptySchema}},
		"outbounds":              {ListItem: &schemaNode{Fields: map[string]*schemaNode{"name": emptySchema, "type": emptySchema, "direct": {Fields: map[string]*schemaNode{"mode": emptySchema, "bindIPv4": emptySchema, "bindIPv6": emptySchema, "bindDevice": emptySchema, "fastOpen": emptySchema}}, "socks5": {Fields: map[string]*schemaNode{"addr": emptySchema, "username": emptySchema, "password": emptySchema}}, "http": {Fields: map[string]*schemaNode{"url": emptySchema, "insecure": emptySchema}}}}},
		"trafficStats":           {Fields: map[string]*schemaNode{"listen": emptySchema, "secret": emptySchema}},
		"masquerade":             {Fields: map[string]*schemaNode{"type": emptySchema, "file": {Fields: map[string]*schemaNode{"dir": emptySchema}}, "proxy": {Fields: map[string]*schemaNode{"url": emptySchema, "rewriteHost": emptySchema, "insecure": emptySchema}}, "string": {Fields: map[string]*schemaNode{"content": emptySchema, "headers": {AnyMap: true}, "statusCode": emptySchema}}, "listenHTTP": emptySchema, "listenHTTPS": emptySchema, "forceHTTPS": emptySchema}},
	}}
}









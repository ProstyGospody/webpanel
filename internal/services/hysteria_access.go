package services

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"proxy-panel/internal/config"
	hysteriadomain "proxy-panel/internal/domain/hysteria"
	"proxy-panel/internal/repository"
)

type HysteriaUserArtifacts struct {
	URI             string                           `json:"uri"`
	URIHy2          string                           `json:"uri_hy2"`
	ClientYAML      string                           `json:"client_config"`
	ClientParams    Hy2ClientParams                  `json:"client_params"`
	ServerDefaults  Hy2ClientParams                  `json:"server_defaults"`
	ClientOverrides *hysteriadomain.ClientOverrides `json:"client_overrides,omitempty"`
	ServerOptions   HysteriaServerClientOptions      `json:"server_options"`
	SingBoxOutbound map[string]any                   `json:"singbox_outbound"`
}

type HysteriaClientDefaults struct {
	ClientParams  Hy2ClientParams             `json:"client_params"`
	ServerOptions HysteriaServerClientOptions `json:"server_options"`
}

type HysteriaServerClientOptions struct {
	TLSEnabled            bool   `json:"tls_enabled"`
	TLSMode               string `json:"tls_mode"`
	ObfsType              string `json:"obfs_type,omitempty"`
	MasqueradeType        string `json:"masquerade_type,omitempty"`
	BandwidthUp           string `json:"bandwidth_up,omitempty"`
	BandwidthDown         string `json:"bandwidth_down,omitempty"`
	IgnoreClientBandwidth bool   `json:"ignore_client_bandwidth"`
}

type HysteriaSyncResult struct {
	RawYAML    string
	BackupPath string
	Validation Hy2ConfigValidation
	Changed    bool
}

type HysteriaAccessManager struct {
	repo          *repository.Repository
	cfg           config.Config
	configManager *HysteriaConfigManager
}

func NewHysteriaAccessManager(repo *repository.Repository, cfg config.Config, configManager *HysteriaConfigManager) *HysteriaAccessManager {
	return &HysteriaAccessManager{repo: repo, cfg: cfg, configManager: configManager}
}

func (m *HysteriaAccessManager) Sync(ctx context.Context) (HysteriaSyncResult, error) {
	if m.configManager == nil {
		return HysteriaSyncResult{}, fmt.Errorf("hysteria config manager is not configured")
	}
	current, err := m.configManager.Read()
	if err != nil {
		return HysteriaSyncResult{}, err
	}
	next, err := m.InjectManagedAuth(ctx, current)
	if err != nil {
		return HysteriaSyncResult{}, err
	}
	validation := m.configManager.Validate(next)
	if !validation.Valid {
		return HysteriaSyncResult{RawYAML: next, Validation: validation}, fmt.Errorf("managed hysteria config is invalid")
	}
	if strings.TrimSpace(current) == strings.TrimSpace(next) {
		return HysteriaSyncResult{RawYAML: next, Validation: validation, Changed: false}, nil
	}
	backupPath, err := m.configManager.Save(next)
	if err != nil {
		return HysteriaSyncResult{}, err
	}
	return HysteriaSyncResult{RawYAML: next, BackupPath: backupPath, Validation: validation, Changed: true}, nil
}

func (m *HysteriaAccessManager) InjectManagedAuth(ctx context.Context, content string) (string, error) {
	if m.configManager == nil {
		return "", fmt.Errorf("hysteria config manager is not configured")
	}
	root, err := parseYAMLMap(content)
	if err != nil {
		return "", err
	}
	auth, err := m.managedAuth(ctx)
	if err != nil {
		return "", err
	}
	root["auth"] = buildServerAuthMap(auth)
	return marshalYAMLMap(root)
}

func (m *HysteriaAccessManager) ClientDefaults(ctx context.Context) (HysteriaClientDefaults, error) {
	content, err := m.managedContent(ctx)
	if err != nil {
		return HysteriaClientDefaults{}, err
	}
	settings := m.configManager.ExtractSettings(content, m.cfg.Hy2Domain, m.cfg.Hy2Port)
	return HysteriaClientDefaults{
		ClientParams:  m.currentClientParamsFromContent(content),
		ServerOptions: m.serverClientOptionsFromSettings(settings),
	}, nil
}

func (m *HysteriaAccessManager) managedAuth(ctx context.Context) (Hy2ServerAuth, error) {
	users, err := m.repo.ListEnabledHysteriaUsers(ctx)
	if err != nil {
		return Hy2ServerAuth{}, err
	}
	userPass := make(map[string]string, len(users))
	for _, user := range users {
		userPass[user.Username] = user.Password
	}
	if len(userPass) == 0 {
		bootstrapPassword := strings.TrimSpace(m.cfg.InternalAuthToken)
		if bootstrapPassword == "" {
			bootstrapPassword = "proxy-panel-bootstrap"
		}
		userPass["__bootstrap__"] = bootstrapPassword
	}
	return Hy2ServerAuth{Type: "userpass", UserPass: userPass}, nil
}

func (m *HysteriaAccessManager) BuildUserArtifacts(user repository.HysteriaUserView) (HysteriaUserArtifacts, Hy2ClientValidation, error) {
	content, err := m.managedContent(context.Background())
	if err != nil {
		return HysteriaUserArtifacts{}, Hy2ClientValidation{}, err
	}
	settings := m.configManager.ExtractSettings(content, m.cfg.Hy2Domain, m.cfg.Hy2Port)
	serverDefaults := m.currentClientParamsFromContent(content)
	profile := m.defaultClientProfileFromContent(content, user)
	effectiveProfile := applyClientOverrides(profile, user.ClientOverrides)

	artifacts, validation := m.configManager.GenerateClientArtifacts(effectiveProfile, "socks5")
	if !validation.Valid {
		return HysteriaUserArtifacts{}, validation, fmt.Errorf("invalid hysteria client profile")
	}
	effectiveParams := m.clientParamsFromProfile(effectiveProfile)
	return HysteriaUserArtifacts{
		URI:             artifacts.URI,
		URIHy2:          artifacts.URIHy2,
		ClientYAML:      artifacts.ClientYAML,
		ClientParams:    effectiveParams,
		ServerDefaults:  serverDefaults,
		ClientOverrides: hysteriadomain.NormalizeClientOverrides(user.ClientOverrides),
		ServerOptions:   m.serverClientOptionsFromSettings(settings),
		SingBoxOutbound: m.buildSingBoxOutbound(user, effectiveParams),
	}, validation, nil
}

func (m *HysteriaAccessManager) managedContent(ctx context.Context) (string, error) {
	if m.configManager == nil {
		return "", fmt.Errorf("hysteria config manager is not configured")
	}
	content, err := m.configManager.Read()
	if err != nil {
		return "", err
	}
	return m.InjectManagedAuth(ctx, content)
}

func (m *HysteriaAccessManager) currentClientParamsFromContent(content string) Hy2ClientParams {
	params := Hy2ClientParams{
		Server:   NormalizeHost(m.cfg.Hy2Domain),
		Port:     m.cfg.Hy2Port,
		SNI:      NormalizeHost(m.cfg.Hy2Domain),
		Insecure: false,
	}
	if params.Server == "" {
		params.Server = NormalizeHost(m.cfg.PanelPublicHost)
	}
	if params.SNI == "" {
		params.SNI = params.Server
	}
	if strings.TrimSpace(content) != "" {
		parsed := m.configManager.ClientParams(content, m.cfg.Hy2Domain, m.cfg.Hy2Port)
		if parsed.Server != "" {
			params = parsed
		}
	}
	if params.Server == "" {
		params.Server = NormalizeHost(m.cfg.PanelPublicHost)
	}
	if params.Port <= 0 {
		params.Port = m.cfg.Hy2Port
	}
	if params.SNI == "" {
		params.SNI = params.Server
	}
	return params
}

func (m *HysteriaAccessManager) defaultClientProfileFromContent(content string, user repository.HysteriaUserView) Hy2ClientProfile {
	auth := hysteriadomain.BuildCredential(user.User)
	profile := Hy2ClientProfile{
		Name:   user.Username,
		Server: NormalizeHost(m.cfg.Hy2Domain) + ":" + strconv.Itoa(m.cfg.Hy2Port),
		Auth:   auth,
		TLS:    Hy2ClientTLS{SNI: NormalizeHost(m.cfg.Hy2Domain)},
	}
	if strings.TrimSpace(content) != "" {
		profile = m.configManager.DefaultClientProfile(content, m.cfg.Hy2Domain, m.cfg.Hy2Port, auth)
	}
	profile.Auth = auth
	profile.Name = user.Username
	if strings.TrimSpace(profile.Server) == "" {
		host := NormalizeHost(m.cfg.Hy2Domain)
		if host == "" {
			host = NormalizeHost(m.cfg.PanelPublicHost)
		}
		if host == "" {
			host = "127.0.0.1"
		}
		profile.Server = host + ":" + strconv.Itoa(m.cfg.Hy2Port)
	}
	return profile
}

func applyClientOverrides(profile Hy2ClientProfile, overrides *hysteriadomain.ClientOverrides) Hy2ClientProfile {
	normalized := hysteriadomain.NormalizeClientOverrides(overrides)
	if normalized == nil {
		return profile
	}
	if normalized.SNI != nil {
		profile.TLS.SNI = strings.TrimSpace(*normalized.SNI)
	}
	if normalized.Insecure != nil {
		profile.TLS.Insecure = *normalized.Insecure
	}
	if normalized.PinSHA256 != nil {
		profile.TLS.PinSHA256 = []string{strings.TrimSpace(*normalized.PinSHA256)}
	}
	if normalized.ObfsType != nil && strings.EqualFold(strings.TrimSpace(*normalized.ObfsType), "salamander") {
		password := ""
		if normalized.ObfsPassword != nil {
			password = strings.TrimSpace(*normalized.ObfsPassword)
		}
		profile.Obfs = &Hy2ClientObfs{Type: "salamander", Salamander: &Hy2ClientSalamander{Password: password}}
	}
	return profile
}

func (m *HysteriaAccessManager) clientParamsFromProfile(profile Hy2ClientProfile) Hy2ClientParams {
	host, ports := splitServerForClient(profile.Server)
	if host == "" {
		host = strings.TrimSpace(profile.Server)
	}
	port := firstPortFromUnion(ports)
	if port <= 0 {
		port = m.cfg.Hy2Port
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

func (m *HysteriaAccessManager) serverClientOptionsFromSettings(settings Hy2Settings) HysteriaServerClientOptions {
	result := HysteriaServerClientOptions{
		TLSEnabled:            settings.TLSEnabled,
		TLSMode:               settings.TLSMode,
		IgnoreClientBandwidth: settings.IgnoreClientBandwidth,
	}
	if settings.Obfs != nil {
		result.ObfsType = strings.TrimSpace(settings.Obfs.Type)
	}
	if settings.Masquerade != nil {
		result.MasqueradeType = strings.TrimSpace(settings.Masquerade.Type)
	}
	if settings.Bandwidth != nil {
		result.BandwidthUp = strings.TrimSpace(settings.Bandwidth.Up)
		result.BandwidthDown = strings.TrimSpace(settings.Bandwidth.Down)
	}
	return result
}

func (m *HysteriaAccessManager) buildSingBoxOutbound(user repository.HysteriaUserView, params Hy2ClientParams) map[string]any {
	tls := map[string]any{"enabled": true}
	if strings.TrimSpace(params.SNI) != "" {
		tls["server_name"] = strings.TrimSpace(params.SNI)
	}
	if params.Insecure {
		tls["insecure"] = true
	}
	if strings.TrimSpace(params.PinSHA256) != "" {
		tls["certificate_public_key_sha256"] = []string{strings.TrimSpace(params.PinSHA256)}
	}
	serverPort := params.Port
	if serverPort <= 0 {
		serverPort = m.cfg.Hy2Port
	}
	outbound := map[string]any{
		"type":        "hysteria2",
		"tag":         "hy2-" + strings.TrimSpace(user.Username),
		"server":      params.Server,
		"server_port": serverPort,
		"password":    hysteriadomain.BuildCredential(user.User),
		"tls":         tls,
	}
	if strings.TrimSpace(params.ObfsType) != "" {
		obfs := map[string]any{"type": strings.TrimSpace(params.ObfsType)}
		if strings.TrimSpace(params.ObfsPassword) != "" {
			obfs["password"] = strings.TrimSpace(params.ObfsPassword)
		}
		outbound["obfs"] = obfs
	}
	return outbound
}

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
	URI             string         `json:"uri"`
	URIHy2          string         `json:"uri_hy2"`
	ClientYAML      string         `json:"client_config"`
	ClientParams    Hy2ClientParams `json:"client_params"`
	SingBoxOutbound map[string]any `json:"singbox_outbound"`
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

func (m *HysteriaAccessManager) managedAuth(ctx context.Context) (Hy2ServerAuth, error) {
	users, err := m.repo.ListEnabledHysteriaUsers(ctx)
	if err != nil {
		return Hy2ServerAuth{}, err
	}
	userPass := make(map[string]string, len(users))
	for _, user := range users {
		userPass[user.Username] = user.Password
	}
	return Hy2ServerAuth{Type: "userpass", UserPass: userPass}, nil
}

func (m *HysteriaAccessManager) BuildUserArtifacts(user repository.HysteriaUserView) (HysteriaUserArtifacts, Hy2ClientValidation, error) {
	content, err := m.managedContent(context.Background())
	if err != nil {
		return HysteriaUserArtifacts{}, Hy2ClientValidation{}, err
	}
	profile := m.defaultClientProfileFromContent(content, user)
	artifacts, validation := m.configManager.GenerateClientArtifacts(profile, "socks5")
	if !validation.Valid {
		return HysteriaUserArtifacts{}, validation, fmt.Errorf("invalid hysteria client profile")
	}
	params := m.currentClientParamsFromContent(content)
	return HysteriaUserArtifacts{
		URI:             artifacts.URI,
		URIHy2:          artifacts.URIHy2,
		ClientYAML:      artifacts.ClientYAML,
		ClientParams:    params,
		SingBoxOutbound: m.buildSingBoxOutbound(user, params),
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

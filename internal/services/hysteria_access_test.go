package services

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"proxy-panel/internal/config"
	hysteriadomain "proxy-panel/internal/domain/hysteria"
	"proxy-panel/internal/repository"
)

func TestHysteriaAccessManagerSyncInjectsManagedUserpassAuth(t *testing.T) {
	ctx := context.Background()
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "server.yaml")
	initial := `listen: :443
acme:
  domains:
    - hy2.example.com
auth:
  type: password
  password: should-be-replaced
`
	if err := os.WriteFile(configPath, []byte(initial), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	repo, err := repository.New(filepath.Join(tmpDir, "storage"), filepath.Join(tmpDir, "audit"), filepath.Join(tmpDir, "run"))
	if err != nil {
		t.Fatalf("open repository: %v", err)
	}
	t.Cleanup(func() { _ = repo.Close() })

	if _, err := repo.CreateHysteriaUser(ctx, "Demo.User", "supersecret88", nil, nil); err != nil {
		t.Fatalf("create user: %v", err)
	}

	manager := NewHysteriaAccessManager(repo, config.Config{Hy2ConfigPath: configPath, Hy2Domain: "hy2.example.com", Hy2Port: 443}, NewHysteriaConfigManager(configPath))
	result, err := manager.Sync(ctx)
	if err != nil {
		t.Fatalf("sync config: %v", err)
	}
	if !result.Validation.Valid {
		t.Fatalf("expected valid config, got errors: %#v", result.Validation.Errors)
	}
	if !strings.Contains(result.RawYAML, "type: userpass") {
		t.Fatalf("expected managed userpass auth in config: %s", result.RawYAML)
	}
	if !strings.Contains(result.RawYAML, "demo.user: supersecret88") {
		t.Fatalf("expected synced user credentials in config: %s", result.RawYAML)
	}
	if strings.Contains(result.RawYAML, "should-be-replaced") {
		t.Fatalf("legacy auth payload leaked into config: %s", result.RawYAML)
	}
}

func TestHysteriaAccessManagerBuildUserArtifactsUsesCurrentManagedSettings(t *testing.T) {
	ctx := context.Background()
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "server.yaml")
	content := `listen: :443
acme:
  domains:
    - hy2.example.com
auth:
  type: userpass
  userpass: {}
obfs:
  type: salamander
  salamander:
    password: managed-obfs
`
	if err := os.WriteFile(configPath, []byte(content), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	repo, err := repository.New(filepath.Join(tmpDir, "storage"), filepath.Join(tmpDir, "audit"), filepath.Join(tmpDir, "run"))
	if err != nil {
		t.Fatalf("open repository: %v", err)
	}
	t.Cleanup(func() { _ = repo.Close() })

	created, err := repo.CreateHysteriaUser(ctx, "demo-user", "supersecret88", nil, nil)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	view, err := repo.GetHysteriaUser(ctx, created.ID)
	if err != nil {
		t.Fatalf("get user: %v", err)
	}

	manager := NewHysteriaAccessManager(repo, config.Config{Hy2ConfigPath: configPath, Hy2Domain: "hy2.example.com", Hy2Port: 443}, NewHysteriaConfigManager(configPath))
	artifacts, validation, err := manager.BuildUserArtifacts(view)
	if err != nil {
		t.Fatalf("build artifacts: %v", err)
	}
	if !validation.Valid {
		t.Fatalf("expected valid artifacts, got errors: %#v", validation.Errors)
	}
	if !strings.HasPrefix(artifacts.URI, "hysteria2://") {
		t.Fatalf("unexpected uri: %s", artifacts.URI)
	}
	if !strings.Contains(artifacts.URI, "demo-user%3Asupersecret88@hy2.example.com:443/") {
		t.Fatalf("expected userpass auth and server address in uri: %s", artifacts.URI)
	}
	if !strings.Contains(artifacts.URI, "obfs-password=managed-obfs") {
		t.Fatalf("expected obfs password in uri: %s", artifacts.URI)
	}
	if !strings.Contains(artifacts.ClientYAML, "auth: demo-user:supersecret88") {
		t.Fatalf("expected client config auth to match managed credential: %s", artifacts.ClientYAML)
	}
}

func TestHysteriaAccessManagerBuildUserArtifactsAppliesClientOverrides(t *testing.T) {
	ctx := context.Background()
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "server.yaml")
	content := `listen: :443
acme:
  domains:
    - hy2.example.com
auth:
  type: userpass
  userpass: {}
obfs:
  type: salamander
  salamander:
    password: managed-obfs
`
	if err := os.WriteFile(configPath, []byte(content), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	repo, err := repository.New(filepath.Join(tmpDir, "storage"), filepath.Join(tmpDir, "audit"), filepath.Join(tmpDir, "run"))
	if err != nil {
		t.Fatalf("open repository: %v", err)
	}
	t.Cleanup(func() { _ = repo.Close() })

	sni := "cdn.example.com"
	pin := "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
	obfsType := "salamander"
	obfsPassword := "override-obfs"
	insecure := true
	created, err := repo.CreateHysteriaUser(ctx, "demo-user", "supersecret88", nil, &hysteriadomain.ClientOverrides{
		SNI:          &sni,
		Insecure:     &insecure,
		PinSHA256:    &pin,
		ObfsType:     &obfsType,
		ObfsPassword: &obfsPassword,
	})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	view, err := repo.GetHysteriaUser(ctx, created.ID)
	if err != nil {
		t.Fatalf("get user: %v", err)
	}

	manager := NewHysteriaAccessManager(repo, config.Config{Hy2ConfigPath: configPath, Hy2Domain: "hy2.example.com", Hy2Port: 443}, NewHysteriaConfigManager(configPath))
	artifacts, validation, err := manager.BuildUserArtifacts(view)
	if err != nil {
		t.Fatalf("build artifacts: %v", err)
	}
	if !validation.Valid {
		t.Fatalf("expected valid artifacts, got errors: %#v", validation.Errors)
	}
	if !strings.Contains(artifacts.URI, "sni=cdn.example.com") {
		t.Fatalf("expected overridden sni in uri: %s", artifacts.URI)
	}
	if !strings.Contains(artifacts.URI, "insecure=1") {
		t.Fatalf("expected insecure flag in uri: %s", artifacts.URI)
	}
	if !strings.Contains(artifacts.URI, "pinSHA256=aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899") {
		t.Fatalf("expected normalized tls pin in uri: %s", artifacts.URI)
	}
	if !strings.Contains(artifacts.URI, "obfs-password=override-obfs") {
		t.Fatalf("expected overridden obfs password in uri: %s", artifacts.URI)
	}
	if artifacts.ClientParams.SNI != "cdn.example.com" {
		t.Fatalf("expected overridden sni in effective params, got: %s", artifacts.ClientParams.SNI)
	}
	if !artifacts.ClientParams.Insecure {
		t.Fatalf("expected overridden insecure flag in effective params")
	}
	if artifacts.ServerDefaults.SNI == artifacts.ClientParams.SNI {
		t.Fatalf("expected effective sni to differ from inherited defaults")
	}
	tlsBlock, ok := artifacts.SingBoxOutbound["tls"].(map[string]any)
	if !ok {
		t.Fatalf("expected tls block in sing-box artifact")
	}
	if _, exists := tlsBlock["certificate_public_key_sha256"]; exists {
		t.Fatalf("expected no unsupported certificate_public_key_sha256 mapping in sing-box artifact")
	}
}

func TestHysteriaAccessManagerBuildUserArtifactsUsesACMEDomainWhenHy2DomainEmpty(t *testing.T) {
	ctx := context.Background()
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "server.yaml")
	content := `listen: :443
acme:
  domains:
    - hy2.example.com
auth:
  type: userpass
  userpass: {}`
	if err := os.WriteFile(configPath, []byte(content), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	repo, err := repository.New(filepath.Join(tmpDir, "storage"), filepath.Join(tmpDir, "audit"), filepath.Join(tmpDir, "run"))
	if err != nil {
		t.Fatalf("open repository: %v", err)
	}
	t.Cleanup(func() { _ = repo.Close() })

	created, err := repo.CreateHysteriaUser(ctx, "demo-user", "supersecret88", nil, nil)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	view, err := repo.GetHysteriaUser(ctx, created.ID)
	if err != nil {
		t.Fatalf("get user: %v", err)
	}

	manager := NewHysteriaAccessManager(repo, config.Config{
		Hy2ConfigPath:   configPath,
		Hy2Domain:       "",
		PanelPublicHost: "panel.example.net",
		Hy2Port:         443,
	}, NewHysteriaConfigManager(configPath))

	artifacts, validation, err := manager.BuildUserArtifacts(view)
	if err != nil {
		t.Fatalf("build artifacts: %v", err)
	}
	if !validation.Valid {
		t.Fatalf("expected valid artifacts, got errors: %#v", validation.Errors)
	}
	if artifacts.ClientParams.Server != "hy2.example.com" {
		t.Fatalf("expected ACME domain as resolved server host, got: %s", artifacts.ClientParams.Server)
	}
	if artifacts.ServerDefaults.Server != "hy2.example.com" {
		t.Fatalf("expected ACME domain as inherited server host, got: %s", artifacts.ServerDefaults.Server)
	}
}


func TestHysteriaAccessManagerBuildUserArtifactsKeepsInheritedObfsPassword(t *testing.T) {
	ctx := context.Background()
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "server.yaml")
	content := `listen: :443
acme:
  domains:
    - hy2.example.com
auth:
  type: userpass
  userpass: {}
obfs:
  type: salamander
  salamander:
    password: managed-obfs`
	if err := os.WriteFile(configPath, []byte(content), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	repo, err := repository.New(filepath.Join(tmpDir, "storage"), filepath.Join(tmpDir, "audit"), filepath.Join(tmpDir, "run"))
	if err != nil {
		t.Fatalf("open repository: %v", err)
	}
	t.Cleanup(func() { _ = repo.Close() })

	obfsType := "salamander"
	created, err := repo.CreateHysteriaUser(ctx, "demo-user", "supersecret88", nil, &hysteriadomain.ClientOverrides{ObfsType: &obfsType})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	view, err := repo.GetHysteriaUser(ctx, created.ID)
	if err != nil {
		t.Fatalf("get user: %v", err)
	}

	manager := NewHysteriaAccessManager(repo, config.Config{
		Hy2ConfigPath:   configPath,
		Hy2Domain:       "hy2.example.com",
		PanelPublicHost: "panel.example.net",
		Hy2Port:         443,
	}, NewHysteriaConfigManager(configPath))

	artifacts, validation, err := manager.BuildUserArtifacts(view)
	if err != nil {
		t.Fatalf("build artifacts: %v", err)
	}
	if !validation.Valid {
		t.Fatalf("expected valid artifacts, got errors: %#v", validation.Errors)
	}
	if artifacts.ClientParams.ObfsPassword != "managed-obfs" {
		t.Fatalf("expected inherited obfs password in effective params, got: %s", artifacts.ClientParams.ObfsPassword)
	}
	if !strings.Contains(artifacts.URI, "obfs-password=managed-obfs") {
		t.Fatalf("expected inherited obfs password in URI: %s", artifacts.URI)
	}
}
func TestHysteriaAccessManagerBuildUserArtifactsSupportsURIServerDomain(t *testing.T) {
	ctx := context.Background()
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "server.yaml")
	content := `listen: :443
acme:
  domains:
    - ignored.example.com
auth:
  type: userpass
  userpass: {}`
	if err := os.WriteFile(configPath, []byte(content), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	repo, err := repository.New(filepath.Join(tmpDir, "storage"), filepath.Join(tmpDir, "audit"), filepath.Join(tmpDir, "run"))
	if err != nil {
		t.Fatalf("open repository: %v", err)
	}
	t.Cleanup(func() { _ = repo.Close() })

	created, err := repo.CreateHysteriaUser(ctx, "demo-user", "supersecret88", nil, nil)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	view, err := repo.GetHysteriaUser(ctx, created.ID)
	if err != nil {
		t.Fatalf("get user: %v", err)
	}

	manager := NewHysteriaAccessManager(repo, config.Config{
		Hy2ConfigPath: configPath,
		Hy2Domain:     "hysteria2://hy2.example.com:443/?sni=cdn.example.com&insecure=1",
		Hy2Port:       443,
	}, NewHysteriaConfigManager(configPath))

	artifacts, validation, err := manager.BuildUserArtifacts(view)
	if err != nil {
		t.Fatalf("build artifacts: %v", err)
	}
	if !validation.Valid {
		t.Fatalf("expected valid artifacts, got errors: %#v", validation.Errors)
	}
	if !strings.Contains(artifacts.URI, "demo-user%3Asupersecret88@hy2.example.com:443/") {
		t.Fatalf("expected user credential embedded into URI server value: %s", artifacts.URI)
	}
	if strings.Contains(artifacts.URI, "127.0.0.1:1080") {
		t.Fatalf("share URI/QR payload must not contain local mode settings: %s", artifacts.URI)
	}
	if strings.Contains(artifacts.ClientYAML, "auth:") {
		t.Fatalf("client YAML must not duplicate auth when server is URI: %s", artifacts.ClientYAML)
	}
	if strings.Contains(artifacts.ClientYAML, "pinSHA256:") || strings.Contains(artifacts.ClientYAML, "insecure:") {
		t.Fatalf("client YAML must not duplicate URI-embedded TLS values: %s", artifacts.ClientYAML)
	}
}

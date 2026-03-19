package services

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"proxy-panel/internal/config"
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

	if _, err := repo.CreateHysteriaUser(ctx, "Demo.User", "supersecret88", nil); err != nil {
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

	created, err := repo.CreateHysteriaUser(ctx, "demo-user", "supersecret88", nil)
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
	if !strings.Contains(artifacts.URI, "@hy2.example.com:443/") {
		t.Fatalf("expected server address in uri: %s", artifacts.URI)
	}
	if !strings.Contains(artifacts.URI, "obfs-password=managed-obfs") {
		t.Fatalf("expected obfs password in uri: %s", artifacts.URI)
	}
	if !strings.Contains(artifacts.ClientYAML, "auth: demo-user:supersecret88") {
		t.Fatalf("expected client config auth to match managed credential: %s", artifacts.ClientYAML)
	}
}

package handlers

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"proxy-panel/internal/config"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/services"
)

func TestBuildHy2URIUsesCompatibleQueryParams(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "server.yaml")
	content := `listen: :443
acme:
  domains:
    - hy2.example.com
tls:
  sni: hy2.example.com
  pinSHA256: pin-value
  alpn:
    - h3
obfs:
  type: salamander
  password: obfs-pass
`
	if err := os.WriteFile(cfgPath, []byte(content), 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}

	h := &Handler{
		cfg: config.Config{
			Hy2Domain:       "hy2.example.com",
			Hy2Port:         443,
			PanelPublicHost: "panel.example.com",
		},
		hy2ConfigManager: services.NewHysteriaConfigManager(cfgPath),
	}

	account := repository.Hy2AccountWithClient{
		Hy2Account: repository.Hy2Account{
			AuthPayload: "token",
			Hy2Identity: "hy2-id",
		},
		ClientName: "demo-user",
	}

	uri := h.buildHy2URI(account)
	if !strings.HasPrefix(uri, "hysteria2://") {
		t.Fatalf("uri must use hysteria2 scheme: %s", uri)
	}
	if !strings.Contains(uri, "pinSHA256=pin-value") {
		t.Fatalf("uri must include pinSHA256: %s", uri)
	}
	if !strings.Contains(uri, "obfs=salamander") {
		t.Fatalf("uri must include obfs type: %s", uri)
	}
	if !strings.Contains(uri, "obfs-password=obfs-pass") {
		t.Fatalf("uri must include obfs password: %s", uri)
	}
	if strings.Contains(uri, "alpn=") {
		t.Fatalf("uri must not include alpn query param: %s", uri)
	}
}

func TestBuildHy2V2RayNGURIUsesHy2AndSkipsPin(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "server.yaml")
	content := `listen: :443
acme:
  domains:
    - hy2.example.com
tls:
  sni: hy2.example.com
  pinSHA256: pin-value
obfs:
  type: salamander
  password: obfs-pass
`
	if err := os.WriteFile(cfgPath, []byte(content), 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}

	h := &Handler{
		cfg: config.Config{
			Hy2Domain:       "hy2.example.com",
			Hy2Port:         443,
			PanelPublicHost: "panel.example.com",
		},
		hy2ConfigManager: services.NewHysteriaConfigManager(cfgPath),
	}

	account := repository.Hy2AccountWithClient{
		Hy2Account: repository.Hy2Account{
			AuthPayload: "token",
			Hy2Identity: "hy2-id",
		},
		ClientName: "demo-user",
	}

	uri := h.buildHy2V2RayNGURI(account)
	if !strings.HasPrefix(uri, "hy2://") {
		t.Fatalf("uri must use hy2 scheme for v2rayng: %s", uri)
	}
	if strings.Contains(uri, "pinSHA256=") {
		t.Fatalf("v2rayng uri must not include pinSHA256: %s", uri)
	}
	if !strings.Contains(uri, "obfs=salamander") {
		t.Fatalf("v2rayng uri must include obfs type: %s", uri)
	}
}

func TestBuildHy2URIEscapesAuthPayload(t *testing.T) {
	h := &Handler{
		cfg: config.Config{
			Hy2Domain:       "hy2.example.com",
			Hy2Port:         443,
			PanelPublicHost: "panel.example.com",
		},
	}

	account := repository.Hy2AccountWithClient{
		Hy2Account: repository.Hy2Account{
			AuthPayload: "user name",
			Hy2Identity: "hy2-id",
		},
		ClientName: "demo-user",
	}

	uri := h.buildHy2URI(account)
	if !strings.Contains(uri, "user%20name@") {
		t.Fatalf("auth payload should be escaped in userinfo: %s", uri)
	}
}

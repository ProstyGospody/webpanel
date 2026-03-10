package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"proxy-panel/internal/config"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/services"
)

func TestBuildHy2URIUsesOfficialParamsOnly(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "server.yaml")
	content := `listen: :443
acme:
  domains:
    - hy2.example.com
  email: admin@example.com
  type: http
auth:
  type: password
  password: secret
obfs:
  type: salamander
  salamander:
    password: obfs-pass
`
	if err := os.WriteFile(cfgPath, []byte(content), 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}

	h := &Handler{
		cfg: config.Config{Hy2Domain: "hy2.example.com", Hy2Port: 443, PanelPublicHost: "panel.example.com"},
		hy2ConfigManager: services.NewHysteriaConfigManager(cfgPath),
	}

	account := repository.Hy2AccountWithClient{
		Hy2Account: repository.Hy2Account{AuthPayload: "token", Hy2Identity: "hy2-id"},
		ClientName: "demo-user",
	}

	uri := h.buildHy2URI(account)
	if !strings.HasPrefix(uri, "hysteria2://") {
		t.Fatalf("uri must use hysteria2 scheme: %s", uri)
	}
	if !strings.Contains(uri, "obfs=salamander") {
		t.Fatalf("uri must include obfs type: %s", uri)
	}
	if !strings.Contains(uri, "obfs-password=obfs-pass") {
		t.Fatalf("uri must include obfs password: %s", uri)
	}
	if strings.Contains(uri, "mbps=") || strings.Contains(uri, "mport=") {
		t.Fatalf("uri must not include unsupported params: %s", uri)
	}
}

func TestBuildHy2V2RayNGURIUsesHy2Scheme(t *testing.T) {
	h := &Handler{}
	account := repository.Hy2AccountWithClient{Hy2Account: repository.Hy2Account{AuthPayload: "token", Hy2Identity: "hy2-id"}}
	uri := h.buildHy2V2RayNGURI(account)
	if !strings.HasPrefix(uri, "hy2://") {
		t.Fatalf("uri must use hy2 scheme: %s", uri)
	}
}

func TestBuildHy2SingBoxOutboundIncludesCoreFields(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "server.yaml")
	content := `listen: :443
acme:
  domains:
    - hy2.example.com
  email: admin@example.com
  type: http
auth:
  type: password
  password: secret
obfs:
  type: salamander
  salamander:
    password: obfs-pass
`
	if err := os.WriteFile(cfgPath, []byte(content), 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}

	h := &Handler{
		cfg: config.Config{Hy2Domain: "hy2.example.com", Hy2Port: 443, PanelPublicHost: "panel.example.com"},
		hy2ConfigManager: services.NewHysteriaConfigManager(cfgPath),
	}
	account := repository.Hy2AccountWithClient{Hy2Account: repository.Hy2Account{AuthPayload: "token", Hy2Identity: "hy2-id"}}

	outbound := h.buildHy2SingBoxOutbound(account)
	if outbound["type"] != "hysteria2" {
		t.Fatalf("unexpected outbound type: %#v", outbound["type"])
	}
	if outbound["password"] != "secret" {
		t.Fatalf("unexpected password: %#v", outbound["password"])
	}
	if outbound["server"] != "hy2.example.com" {
		t.Fatalf("unexpected server: %#v", outbound["server"])
	}
}

func TestParseInternalAuthAcceptsExtendedTokens(t *testing.T) {
	req, err := http.NewRequest(http.MethodPost, "/internal/hy2/auth?auth_token=query-token", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	if got := parseInternalAuth(req); got != "query-token" {
		t.Fatalf("unexpected token from query: %s", got)
	}

	req2, err := http.NewRequest(http.MethodPost, "/internal/hy2/auth", nil)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req2.Header.Set("X-Internal-Auth-Token", "header-token")
	if got := parseInternalAuth(req2); got != "header-token" {
		t.Fatalf("unexpected token from header: %s", got)
	}
}
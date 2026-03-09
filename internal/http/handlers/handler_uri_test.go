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

func TestBuildHy2SingBoxOutboundIncludesCoreFields(t *testing.T) {
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
  salamander:
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

	outbound := h.buildHy2SingBoxOutbound(account)
	if outbound["type"] != "hysteria2" {
		t.Fatalf("unexpected outbound type: %#v", outbound["type"])
	}
	if outbound["server"] != "hy2.example.com" {
		t.Fatalf("unexpected server: %#v", outbound["server"])
	}
	if outbound["password"] != "token" {
		t.Fatalf("unexpected password: %#v", outbound["password"])
	}

	tls, ok := outbound["tls"].(map[string]any)
	if !ok {
		t.Fatalf("tls block is missing or invalid: %#v", outbound["tls"])
	}
	if tls["server_name"] != "hy2.example.com" {
		t.Fatalf("unexpected tls.server_name: %#v", tls["server_name"])
	}
	pins, ok := tls["certificate_public_key_sha256"].([]string)
	if !ok || len(pins) != 1 || pins[0] != "pin-value" {
		t.Fatalf("unexpected tls.certificate_public_key_sha256: %#v", tls["certificate_public_key_sha256"])
	}

	obfs, ok := outbound["obfs"].(map[string]any)
	if !ok {
		t.Fatalf("obfs block is missing or invalid: %#v", outbound["obfs"])
	}
	if obfs["type"] != "salamander" {
		t.Fatalf("unexpected obfs type: %#v", obfs["type"])
	}
	if obfs["password"] != "obfs-pass" {
		t.Fatalf("unexpected obfs password: %#v", obfs["password"])
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

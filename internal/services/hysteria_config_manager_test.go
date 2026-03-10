package services

import (
	"strings"
	"testing"
)

func TestHysteriaConfigManagerValidateServerConfig(t *testing.T) {
	cfg := `listen: :443
acme:
  domains:
    - hy2.example.com
  email: admin@example.com
  type: http
auth:
  type: password
  password: secret-pass
obfs:
  type: salamander
  salamander:
    password: obfs-pass
`

	manager := NewHysteriaConfigManager("/tmp/unused")
	validation := manager.Validate(cfg)
	if !validation.Valid {
		t.Fatalf("expected valid config, got errors: %#v", validation.Errors)
	}
	if validation.Summary.Listen != ":443" {
		t.Fatalf("unexpected listen summary: %s", validation.Summary.Listen)
	}
	if validation.Summary.TLSMode != "acme" {
		t.Fatalf("unexpected tls mode: %s", validation.Summary.TLSMode)
	}
	if validation.Summary.ObfsType != "salamander" {
		t.Fatalf("unexpected obfs type: %s", validation.Summary.ObfsType)
	}
}

func TestHysteriaConfigManagerApplySettingsRoundTrip(t *testing.T) {
	cfg := `listen: :443
acme:
  domains:
    - hy2.example.com
  email: admin@example.com
  type: http
auth:
  type: password
  password: old-secret
`

	manager := NewHysteriaConfigManager("/tmp/unused")
	next, validation := manager.ApplySettings(cfg, Hy2Settings{
		Listen:  ":8443",
		TLSMode: "acme",
		ACME: &Hy2ServerACME{
			Domains: []string{"hy2.example.com"},
			Email:   "admin@example.com",
			Type:    "http",
		},
		Auth: Hy2ServerAuth{Type: "password", Password: "new-secret"},
		Obfs: &Hy2ServerObfs{Type: "salamander", Salamander: &Hy2ServerSalamander{Password: "obfs-pass"}},
	})
	if !validation.Valid {
		t.Fatalf("apply validation failed: %#v", validation.Errors)
	}

	summary := manager.Parse(next)
	if summary.Listen != ":8443" {
		t.Fatalf("listen not updated: %s", summary.Listen)
	}
	if summary.ObfsType != "salamander" {
		t.Fatalf("obfs not updated: %s", summary.ObfsType)
	}
	if !strings.Contains(next, "password: new-secret") {
		t.Fatalf("auth password was not updated: %s", next)
	}
}

func TestHysteriaConfigManagerGenerateClientArtifacts(t *testing.T) {
	manager := NewHysteriaConfigManager("/tmp/unused")
	profile := Hy2ClientProfile{
		Name:   "demo",
		Server: "hy2.example.com:443",
		Auth:   "token",
		TLS: Hy2ClientTLS{
			SNI:      "hy2.example.com",
			Insecure: true,
			PinSHA256: []string{"pin-value"},
		},
		Transport: Hy2ClientTransport{Type: "udp"},
		Obfs: &Hy2ClientObfs{
			Type: "salamander",
			Salamander: &Hy2ClientSalamander{Password: "obfs-pass"},
		},
	}

	artifacts, validation := manager.GenerateClientArtifacts(profile, "socks5")
	if !validation.Valid {
		t.Fatalf("profile validation failed: %#v", validation.Errors)
	}
	if !strings.HasPrefix(artifacts.URI, "hysteria2://") {
		t.Fatalf("unexpected URI scheme: %s", artifacts.URI)
	}
	if !strings.Contains(artifacts.URI, "obfs=salamander") {
		t.Fatalf("obfs type is missing in URI: %s", artifacts.URI)
	}
	if !strings.Contains(artifacts.URI, "obfs-password=obfs-pass") {
		t.Fatalf("obfs password is missing in URI: %s", artifacts.URI)
	}
	if !strings.Contains(artifacts.URI, "pinSHA256=pin-value") {
		t.Fatalf("pinSHA256 is missing in URI: %s", artifacts.URI)
	}
	if !strings.Contains(artifacts.ClientYAML, "socks5:") {
		t.Fatalf("client YAML does not contain socks5 mode: %s", artifacts.ClientYAML)
	}
}
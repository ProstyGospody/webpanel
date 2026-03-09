package services

import (
	"strings"
	"testing"
)

func TestHysteriaConfigManagerParseCaseInsensitivePaths(t *testing.T) {
	cfg := `listen: :8443

acme:
  domains:
    - hy2.example.com

auth:
  type: http
  http:
    url: http://127.0.0.1:18080/internal/hy2/auth

trafficStats:
  listen: 127.0.0.1:8999
  secret: stats-secret

tls:
  sni: hy2.example.com
  insecure: false
  pinSHA256: abcdef123
  alpn:
    - h3

obfs:
  type: salamander
  salamander:
    password: obfs-pass
`

	manager := NewHysteriaConfigManager("/tmp/unused")
	summary := manager.Parse(cfg)

	if summary.Port != 8443 {
		t.Fatalf("unexpected port: %d", summary.Port)
	}
	if summary.AuthType != "http" {
		t.Fatalf("unexpected auth type: %s", summary.AuthType)
	}
	if summary.TrafficStatsListen != "127.0.0.1:8999" {
		t.Fatalf("unexpected trafficStats.listen: %s", summary.TrafficStatsListen)
	}
	if !summary.HasTrafficStatsSecret {
		t.Fatalf("expected traffic stats secret to be detected")
	}
	if summary.PinSHA256 != "abcdef123" {
		t.Fatalf("unexpected pinSHA256: %s", summary.PinSHA256)
	}
	if summary.ObfsType != "salamander" {
		t.Fatalf("unexpected obfs type: %s", summary.ObfsType)
	}
	if summary.ObfsPassword != "obfs-pass" {
		t.Fatalf("unexpected obfs password: %s", summary.ObfsPassword)
	}
}

func TestHysteriaConfigManagerClientParamsIncludePinAndObfs(t *testing.T) {
	cfg := `listen: :8443

tls:
  pinSHA256: pin-value

obfs:
  type: salamander
  salamander:
    password: obfs-pass
`

	manager := NewHysteriaConfigManager("/tmp/unused")
	params := manager.ClientParams(cfg, "hy2.example.com", 443)

	if params.Server != "hy2.example.com" {
		t.Fatalf("unexpected server: %s", params.Server)
	}
	if params.PinSHA256 != "pin-value" {
		t.Fatalf("unexpected pinSHA256: %s", params.PinSHA256)
	}
	if params.ObfsType != "salamander" {
		t.Fatalf("unexpected obfs type: %s", params.ObfsType)
	}
	if params.ObfsPassword != "obfs-pass" {
		t.Fatalf("unexpected obfs password: %s", params.ObfsPassword)
	}
}

func TestHysteriaConfigManagerValidateWarnsWhenObfsPasswordMissing(t *testing.T) {
	cfg := `listen: :8443

auth:
  type: http
  http:
    url: http://127.0.0.1:18080/internal/hy2/auth

obfs:
  type: salamander
`

	manager := NewHysteriaConfigManager("/tmp/unused")
	validation := manager.Validate(cfg)

	if !validation.Valid {
		t.Fatalf("validation should stay valid for this config")
	}
	found := false
	for _, warning := range validation.Warnings {
		if warning == "obfs is enabled but password is empty" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected obfs password warning, got: %#v", validation.Warnings)
	}
}

func TestHysteriaConfigManagerSupportsLegacyObfsPasswordPath(t *testing.T) {
	cfg := `listen: :8443

obfs:
  type: salamander
  password: legacy-pass
`

	manager := NewHysteriaConfigManager("/tmp/unused")
	summary := manager.Parse(cfg)

	if summary.ObfsType != "salamander" {
		t.Fatalf("unexpected obfs type: %s", summary.ObfsType)
	}
	if summary.ObfsPassword != "legacy-pass" {
		t.Fatalf("unexpected obfs password: %s", summary.ObfsPassword)
	}
}

func TestHysteriaConfigManagerApplySettingsUpdatesCoreFields(t *testing.T) {
	cfg := `listen: :443

auth:
  type: http
  http:
    url: http://127.0.0.1:18080/internal/hy2/auth

tls:
  sni: old.example.com
`

	manager := NewHysteriaConfigManager("/tmp/unused")
	next, validation := manager.ApplySettings(cfg, Hy2Settings{
		Port:                  8443,
		SNI:                   "new.example.com",
		ObfsEnabled:           true,
		ObfsType:              "salamander",
		ObfsPassword:          "secret-pass",
		MasqueradeEnabled:     true,
		MasqueradeType:        "proxy",
		MasqueradeURL:         "https://www.cloudflare.com",
		MasqueradeRewriteHost: true,
	})

	if !validation.Valid {
		t.Fatalf("settings should be valid: %#v", validation)
	}

	warningFound := false
	for _, warning := range validation.Warnings {
		if warning == "obfs and masquerade cannot be enabled together; masquerade has been disabled" {
			warningFound = true
			break
		}
	}
	if !warningFound {
		t.Fatalf("expected conflict warning, got: %#v", validation.Warnings)
	}

	summary := manager.Parse(next)
	if summary.Port != 8443 {
		t.Fatalf("unexpected port: %d", summary.Port)
	}
	if summary.SNI != "new.example.com" {
		t.Fatalf("unexpected sni: %s", summary.SNI)
	}
	if summary.ObfsType != "salamander" {
		t.Fatalf("unexpected obfs type: %s", summary.ObfsType)
	}
	if summary.ObfsPassword != "secret-pass" {
		t.Fatalf("unexpected obfs password: %s", summary.ObfsPassword)
	}
	if summary.MasqueradeType != "" {
		t.Fatalf("masquerade must be disabled when obfs is enabled: %s", summary.MasqueradeType)
	}
	if summary.MasqueradeURL != "" {
		t.Fatalf("masquerade url must be empty when obfs is enabled: %s", summary.MasqueradeURL)
	}
	if strings.Contains(next, "masquerade:") {
		t.Fatalf("masquerade block must be removed when obfs is enabled: %s", next)
	}
}

func TestHysteriaConfigManagerApplySettingsGeneratesObfsPasswordWhenMissing(t *testing.T) {
	cfg := `listen: :443

auth:
  type: http
  http:
    url: http://127.0.0.1:18080/internal/hy2/auth

tls:
  sni: hy2.example.com
`

	manager := NewHysteriaConfigManager("/tmp/unused")
	next, validation := manager.ApplySettings(cfg, Hy2Settings{
		Port:                  443,
		SNI:                   "hy2.example.com",
		ObfsEnabled:           true,
		ObfsType:              "salamander",
		ObfsPassword:          "",
		MasqueradeEnabled:     false,
		MasqueradeType:        "",
		MasqueradeURL:         "",
		MasqueradeRewriteHost: true,
	})

	if !validation.Valid {
		t.Fatalf("settings should be valid: %#v", validation)
	}

	summary := manager.Parse(next)
	if summary.ObfsType != "salamander" {
		t.Fatalf("unexpected obfs type: %s", summary.ObfsType)
	}
	if strings.TrimSpace(summary.ObfsPassword) == "" {
		t.Fatalf("obfs password should be auto-generated")
	}
	if len(summary.ObfsPassword) < 8 {
		t.Fatalf("generated obfs password is too short: %s", summary.ObfsPassword)
	}
}

func TestHysteriaConfigManagerApplySettingsCanDisableOptionalBlocks(t *testing.T) {
	cfg := `listen: :443

auth:
  type: http
  http:
    url: http://127.0.0.1:18080/internal/hy2/auth

obfs:
  type: salamander
  salamander:
    password: old-pass

masquerade:
  type: proxy
  proxy:
    url: https://www.cloudflare.com
    rewriteHost: true
`

	manager := NewHysteriaConfigManager("/tmp/unused")
	next, validation := manager.ApplySettings(cfg, Hy2Settings{
		Port:                  443,
		SNI:                   "hy2.example.com",
		ObfsEnabled:           false,
		MasqueradeEnabled:     false,
		MasqueradeType:        "",
		MasqueradeURL:         "",
		MasqueradeRewriteHost: true,
	})

	if !validation.Valid {
		t.Fatalf("settings should be valid: %#v", validation)
	}

	if strings.Contains(next, "obfs:") {
		t.Fatalf("obfs block should be removed: %s", next)
	}
	if strings.Contains(next, "masquerade:") {
		t.Fatalf("masquerade block should be removed: %s", next)
	}
}


package services

import "testing"

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
}

func TestHysteriaConfigManagerClientParamsIncludePin(t *testing.T) {
	cfg := `listen: :8443

tls:
  pinSHA256: pin-value
`

	manager := NewHysteriaConfigManager("/tmp/unused")
	params := manager.ClientParams(cfg, "hy2.example.com", 443)

	if params.Server != "hy2.example.com" {
		t.Fatalf("unexpected server: %s", params.Server)
	}
	if params.PinSHA256 != "pin-value" {
		t.Fatalf("unexpected pinSHA256: %s", params.PinSHA256)
	}
}

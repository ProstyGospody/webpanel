package services

import "testing"

func TestNormalizeMTProxySecret(t *testing.T) {
	secret, err := NormalizeMTProxySecret("aabbccddeeff00112233445566778899")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if secret != "aabbccddeeff00112233445566778899" {
		t.Fatalf("unexpected normalized secret: %s", secret)
	}
}

func TestNormalizeMTProxySecretFromDDFormat(t *testing.T) {
	input := "ddaabbccddeeff00112233445566778899" + "6578616d706c652e636f6d"
	secret, err := NormalizeMTProxySecret(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if secret != "aabbccddeeff00112233445566778899" {
		t.Fatalf("unexpected normalized secret: %s", secret)
	}
}

func TestBuildTelegramMTProxySecretUsesDDPrefix(t *testing.T) {
	built := BuildTelegramMTProxySecret("aabbccddeeff00112233445566778899", "proxy.example.com", "tls.example.com")
	if built != "ddaabbccddeeff00112233445566778899" {
		t.Fatalf("unexpected link secret: %s", built)
	}
}

func TestBuildTelegramMTProxySecretReturnsInputOnInvalid(t *testing.T) {
	built := BuildTelegramMTProxySecret("not-a-secret", "proxy.example.com", "tls.example.com")
	if built != "not-a-secret" {
		t.Fatalf("unexpected value for invalid secret: %s", built)
	}
}

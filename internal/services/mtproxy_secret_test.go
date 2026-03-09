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

func TestNormalizeMTProxySecretFromEEFormat(t *testing.T) {
	input := "eeaabbccddeeff00112233445566778899" + "746c732e6578616d706c652e636f6d"
	secret, err := NormalizeMTProxySecret(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if secret != "aabbccddeeff00112233445566778899" {
		t.Fatalf("unexpected normalized secret: %s", secret)
	}
}

func TestBuildTelegramMTProxySecretUsesEEPrefixWithTLSDomain(t *testing.T) {
	built := BuildTelegramMTProxySecret("aabbccddeeff00112233445566778899", "proxy.example.com", "tls.example.com")
	if built != "eeaabbccddeeff00112233445566778899746c732e6578616d706c652e636f6d" {
		t.Fatalf("unexpected link secret: %s", built)
	}
}

func TestBuildTelegramMTProxySecretFallsBackToDDForIP(t *testing.T) {
	built := BuildTelegramMTProxySecret("aabbccddeeff00112233445566778899", "203.0.113.10", "")
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

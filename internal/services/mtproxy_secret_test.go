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

func TestBuildTelegramLinksUseCanonicalFormats(t *testing.T) {
	shareURL, err := BuildTelegramShareURL("proxy.example.com", 443, "aabbccddeeff00112233445566778899")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if shareURL != "https://t.me/proxy?server=proxy.example.com&port=443&secret=aabbccddeeff00112233445566778899" {
		t.Fatalf("unexpected share URL: %s", shareURL)
	}

	deepURL, err := BuildTelegramDeepLink("proxy.example.com", 443, "aabbccddeeff00112233445566778899")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if deepURL != "tg://proxy?server=proxy.example.com&port=443&secret=aabbccddeeff00112233445566778899" {
		t.Fatalf("unexpected deep link: %s", deepURL)
	}
}


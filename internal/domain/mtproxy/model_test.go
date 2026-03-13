package mtproxy

import "testing"

func TestNormalizeSecretAcceptsCanonicalAndLegacyPrefixedFormats(t *testing.T) {
	cases := []string{
		"aabbccddeeff00112233445566778899",
		"ddaabbccddeeff001122334455667788996578616d706c652e636f6d",
		"eeaabbccddeeff00112233445566778899746c732e6578616d706c652e636f6d",
	}
	for _, input := range cases {
		secret, err := NormalizeSecret(input)
		if err != nil {
			t.Fatalf("unexpected error for %q: %v", input, err)
		}
		if secret != "aabbccddeeff00112233445566778899" {
			t.Fatalf("unexpected normalized secret for %q: %s", input, secret)
		}
	}
}

func TestBuildTelegramShareURLUsesCanonicalTMEDomain(t *testing.T) {
	url, err := BuildTelegramShareURL("Proxy.EXAMPLE.com", 443, "aabbccddeeff00112233445566778899")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url != "https://t.me/proxy?server=proxy.example.com&port=443&secret=aabbccddeeff00112233445566778899" {
		t.Fatalf("unexpected share URL: %s", url)
	}

	deepURL, err := BuildTelegramDeepLink("proxy.example.com", 443, "aabbccddeeff00112233445566778899")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if deepURL != "tg://proxy?server=proxy.example.com&port=443&secret=aabbccddeeff00112233445566778899" {
		t.Fatalf("unexpected deep link: %s", deepURL)
	}
}

func TestValidateSettingsRejectsBrokenHostPortAndSecret(t *testing.T) {
	errs := ValidateSettings(Settings{
		PublicHost:      "",
		ListenPort:      70000,
		CanonicalSecret: "broken",
		ShareMode:       "custom",
	})
	if len(errs) != 4 {
		t.Fatalf("expected 4 validation errors, got %d", len(errs))
	}
}


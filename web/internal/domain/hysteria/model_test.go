package hysteria

import "testing"

func TestNormalizeUsernameLowercasesAndRejectsInvalidValues(t *testing.T) {
	username, err := NormalizeUsername(" Demo.User ")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if username != "demo.user" {
		t.Fatalf("unexpected normalized username: %s", username)
	}

	if _, err := NormalizeUsername("A"); err == nil {
		t.Fatalf("expected short username to be rejected")
	}
	if _, err := NormalizeUsername("bad value"); err == nil {
		t.Fatalf("expected username with spaces to be rejected")
	}
}

func TestValidateUserInputReportsFieldErrors(t *testing.T) {
	errs := ValidateUserInput("bad value", "short")
	if len(errs) != 2 {
		t.Fatalf("expected 2 validation errors, got %d", len(errs))
	}
	if errs[0].Field != "username" {
		t.Fatalf("unexpected first field: %s", errs[0].Field)
	}
	if errs[1].Field != "password" {
		t.Fatalf("unexpected second field: %s", errs[1].Field)
	}
}

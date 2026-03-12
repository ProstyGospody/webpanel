package repository

import "testing"

func TestNormalizeJSONDocumentKeepsJSONPayload(t *testing.T) {
	input := `{"total_connections":149,"users_total":17}`
	got := normalizeJSONDocument(input)
	if got != input {
		t.Fatalf("expected JSON payload to be preserved, got %q", got)
	}
}

func TestNormalizeJSONDocumentWrapsPlainTextPayload(t *testing.T) {
	input := "total_connections 149\nusers_total 17"
	got := normalizeJSONDocument(input)
	expected := `{"format":"text/plain","raw":"total_connections 149\nusers_total 17"}`
	if got != expected {
		t.Fatalf("unexpected wrapped payload: %q", got)
	}
}

func TestNormalizeJSONDocumentReturnsEmptyObjectForBlankInput(t *testing.T) {
	if got := normalizeJSONDocument("   "); got != "{}" {
		t.Fatalf("unexpected payload for blank input: %q", got)
	}
}
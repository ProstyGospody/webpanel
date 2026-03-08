package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestHysteriaFetchTrafficUsesRawAuthorizationSecret(t *testing.T) {
	const expectedSecret = "secret-token"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/traffic" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != expectedSecret {
			t.Fatalf("unexpected authorization header: %q", got)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"user-1": map[string]any{"tx": 100, "rx": 50},
		})
	}))
	defer server.Close()

	client := NewHysteriaClient(server.URL, expectedSecret)
	traffic, err := client.FetchTraffic(context.Background())
	if err != nil {
		t.Fatalf("FetchTraffic returned error: %v", err)
	}

	expected := map[string]Hy2Traffic{"user-1": {TxBytes: 100, RxBytes: 50}}
	if !reflect.DeepEqual(traffic, expected) {
		t.Fatalf("unexpected traffic payload: %+v", traffic)
	}
}

func TestHysteriaKickUsesArrayPayload(t *testing.T) {
	const expectedSecret = "secret-token"
	const identity = "hy2-user-1"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/kick" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != expectedSecret {
			t.Fatalf("unexpected authorization header: %q", got)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Fatalf("unexpected content-type: %q", ct)
		}
		var body []string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("failed to decode payload: %v", err)
		}
		expected := []string{identity}
		if !reflect.DeepEqual(body, expected) {
			t.Fatalf("unexpected kick payload: %+v", body)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewHysteriaClient(server.URL, expectedSecret)
	if err := client.Kick(context.Background(), identity); err != nil {
		t.Fatalf("Kick returned error: %v", err)
	}
}

package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMTProxyFetchStatsParsesPlainTextStats(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/stats" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte("active_connections 73\ntotal_connections 149\nusers_total 17\n"))
	}))
	defer server.Close()

	client := NewMTProxyClient(server.URL, "")
	stats, err := client.FetchStats(context.Background())
	if err != nil {
		t.Fatalf("FetchStats returned error: %v", err)
	}

	if stats.ConnectionsTotal == nil || *stats.ConnectionsTotal != 149 {
		t.Fatalf("unexpected connections total: %+v", stats.ConnectionsTotal)
	}
	if stats.UsersTotal == nil || *stats.UsersTotal != 17 {
		t.Fatalf("unexpected users total: %+v", stats.UsersTotal)
	}
}

func TestMTProxyFetchStatsFallsBackToRoot(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/stats":
			http.NotFound(w, r)
		case "/":
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			_, _ = w.Write([]byte(">>>>>>connections>>>>>> start\ntotal_connections 149\n<<<<<<connections<<<<<< end\n"))
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	client := NewMTProxyClient(server.URL, "")
	stats, err := client.FetchStats(context.Background())
	if err != nil {
		t.Fatalf("FetchStats returned error: %v", err)
	}

	if stats.ConnectionsTotal == nil || *stats.ConnectionsTotal != 149 {
		t.Fatalf("unexpected connections total: %+v", stats.ConnectionsTotal)
	}
}
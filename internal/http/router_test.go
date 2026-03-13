package httpserver

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"proxy-panel/internal/config"
	"proxy-panel/internal/http/handlers"
)

func TestRouterExposesNewAccessRoutesAndDropsLegacyClientRoutes(t *testing.T) {
	cfg := config.Config{
		SessionCookieName: "pp_session",
		CSRFCookieName:    "pp_csrf",
		CSRFHeaderName:    "X-CSRF-Token",
	}
	router := NewRouter(cfg, slog.Default(), nil, &handlers.Handler{})

	for _, path := range []string{"/api/hysteria/users", "/api/mtproxy/access", "/api/mtproxy/settings"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)
		if resp.Code != http.StatusUnauthorized {
			t.Fatalf("expected %s to require auth and return 401, got %d", path, resp.Code)
		}
	}

	for _, path := range []string{"/api/clients", "/api/hy2/accounts", "/api/mtproxy/secrets"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)
		if resp.Code != http.StatusNotFound {
			t.Fatalf("expected legacy path %s to be removed with 404, got %d", path, resp.Code)
		}
	}
}

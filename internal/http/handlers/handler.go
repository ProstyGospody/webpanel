package handlers

import (
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"proxy-panel/internal/config"
	"proxy-panel/internal/http/middleware"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/security"
	"proxy-panel/internal/services"
)

type Handler struct {
	cfg            config.Config
	logger         *slog.Logger
	repo           *repository.Repository
	rateLimiter    *middleware.LoginRateLimiter
	hy2Client      *services.HysteriaClient
	mtProxyClient  *services.MTProxyClient
	serviceManager *services.ServiceManager
	runtimeManager *services.MTProxyRuntimeManager
}

func New(
	cfg config.Config,
	logger *slog.Logger,
	repo *repository.Repository,
	rateLimiter *middleware.LoginRateLimiter,
	hy2Client *services.HysteriaClient,
	mtProxyClient *services.MTProxyClient,
	serviceManager *services.ServiceManager,
	runtimeManager *services.MTProxyRuntimeManager,
) *Handler {
	return &Handler{
		cfg:            cfg,
		logger:         logger,
		repo:           repo,
		rateLimiter:    rateLimiter,
		hy2Client:      hy2Client,
		mtProxyClient:  mtProxyClient,
		serviceManager: serviceManager,
		runtimeManager: runtimeManager,
	}
}

func (h *Handler) setAuthCookies(w http.ResponseWriter, sessionToken string, csrfToken string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     h.cfg.SessionCookieName,
		Value:    sessionToken,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   int(h.cfg.SessionTTL.Seconds()),
		Secure:   h.cfg.SecureCookies,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     h.cfg.CSRFCookieName,
		Value:    csrfToken,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   int(h.cfg.SessionTTL.Seconds()),
		Secure:   h.cfg.SecureCookies,
		HttpOnly: false,
		SameSite: http.SameSiteStrictMode,
	})
}

func (h *Handler) clearAuthCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     h.cfg.SessionCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		Secure:   h.cfg.SecureCookies,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     h.cfg.CSRFCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		Secure:   h.cfg.SecureCookies,
		HttpOnly: false,
		SameSite: http.SameSiteStrictMode,
	})
}

func (h *Handler) requestIP(r *http.Request) string {
	for _, header := range []string{"X-Forwarded-For", "X-Real-IP"} {
		value := strings.TrimSpace(r.Header.Get(header))
		if value == "" {
			continue
		}
		if header == "X-Forwarded-For" {
			items := strings.Split(value, ",")
			if len(items) > 0 {
				value = strings.TrimSpace(items[0])
			}
		}
		if host, _, err := net.SplitHostPort(value); err == nil {
			value = host
		}
		if value != "" {
			return value
		}
	}
	remote := strings.TrimSpace(r.RemoteAddr)
	if host, _, err := net.SplitHostPort(remote); err == nil {
		return host
	}
	return remote
}

func (h *Handler) parsePagination(r *http.Request) (limit int, offset int) {
	limit = 50
	offset = 0
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("offset")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 0 {
			offset = parsed
		}
	}
	return
}

func (h *Handler) parseBool(raw string) *bool {
	raw = strings.TrimSpace(strings.ToLower(raw))
	switch raw {
	case "1", "true", "yes", "on":
		v := true
		return &v
	case "0", "false", "no", "off":
		v := false
		return &v
	default:
		return nil
	}
}

func (h *Handler) audit(r *http.Request, action string, entityType string, entityID *string, payload any) {
	admin, ok := middleware.AdminFromContext(r.Context())
	var adminID *string
	if ok {
		adminID = &admin.ID
	}
	if err := h.repo.InsertAuditLog(r.Context(), adminID, action, entityType, entityID, payload); err != nil {
		h.logger.Warn("audit insert failed", "error", err, "action", action)
	}
}

func (h *Handler) buildHy2URI(account repository.Hy2AccountWithClient) string {
	host := h.cfg.Hy2Domain
	if host == "" {
		host = h.cfg.PanelPublicHost
	}
	query := "sni=" + url.QueryEscape(host)
	fragment := url.QueryEscape(account.ClientName)
	credential := url.QueryEscape(account.AuthPayload)
	return "hysteria2://" + credential + "@" + host + ":" + strconv.Itoa(h.cfg.Hy2Port) + "?" + query + "#" + fragment
}

func (h *Handler) buildMTProxyLink(secret string) string {
	host := h.cfg.MTProxyPublicHost
	if host == "" {
		host = h.cfg.PanelPublicHost
	}
	return "tg://proxy?server=" + url.QueryEscape(host) + "&port=" + strconv.Itoa(h.cfg.MTProxyPort) + "&secret=" + url.QueryEscape(secret)
}

func parseInternalAuth(r *http.Request) string {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token != "" {
		return token
	}
	token = strings.TrimSpace(r.Header.Get("X-Internal-Token"))
	if token != "" {
		return token
	}
	authorization := strings.TrimSpace(r.Header.Get("Authorization"))
	if authorization == "" {
		return ""
	}
	parts := strings.SplitN(authorization, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return strings.TrimSpace(parts[1])
	}
	return ""
}

func extractHy2AuthPayload(body map[string]any) string {
	for _, key := range []string{"auth", "auth_payload", "token", "password", "credential"} {
		if value, ok := body[key]; ok {
			switch typed := value.(type) {
			case string:
				if strings.TrimSpace(typed) != "" {
					return strings.TrimSpace(typed)
				}
			default:
				encoded, _ := json.Marshal(typed)
				if strings.TrimSpace(string(encoded)) != "" {
					return strings.TrimSpace(string(encoded))
				}
			}
		}
	}
	return ""
}

func generateHy2Identity() string {
	raw, err := security.RandomHex(6)
	if err != nil {
		return "hy2-default"
	}
	return "hy2-" + raw
}

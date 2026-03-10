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
	cfg              config.Config
	logger           *slog.Logger
	repo             *repository.Repository
	rateLimiter      *middleware.LoginRateLimiter
	hy2Client        *services.HysteriaClient
	mtProxyClient    *services.MTProxyClient
	serviceManager   *services.ServiceManager
	runtimeManager   *services.MTProxyRuntimeManager
	hy2ConfigManager *services.HysteriaConfigManager
	prometheus       *services.PrometheusClient
	systemMetrics    *services.SystemMetricsCollector
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
	hy2ConfigManager *services.HysteriaConfigManager,
	prometheus       *services.PrometheusClient,
	systemMetrics    *services.SystemMetricsCollector,
) *Handler {
	return &Handler{
		cfg:              cfg,
		logger:           logger,
		repo:             repo,
		rateLimiter:      rateLimiter,
		hy2Client:        hy2Client,
		mtProxyClient:    mtProxyClient,
		serviceManager:   serviceManager,
		runtimeManager:   runtimeManager,
		hy2ConfigManager: hy2ConfigManager,
		prometheus:      prometheus,
		systemMetrics:   systemMetrics,
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
	profile := h.resolveHy2ClientProfile(account.AuthPayload)
	fragment := strings.TrimSpace(account.ClientName)
	if fragment == "" {
		fragment = strings.TrimSpace(account.Hy2Identity)
	}
	profile.Name = fragment

	if h.hy2ConfigManager != nil {
		if artifacts, validation := h.hy2ConfigManager.GenerateClientArtifacts(profile, "socks5"); validation.Valid {
			return artifacts.URI
		}
	}

	params := h.resolveHy2ClientParams()
	base := "hysteria2://" + url.PathEscape(account.AuthPayload) + "@" + params.Server + ":" + strconv.Itoa(params.Port) + "/"
	if params.SNI != "" {
		base += "?sni=" + url.QueryEscape(params.SNI)
	}
	if fragment != "" {
		base += "#" + url.QueryEscape(fragment)
	}
	return base
}

func (h *Handler) buildHy2V2RayNGURI(account repository.Hy2AccountWithClient) string {
	profile := h.resolveHy2ClientProfile(account.AuthPayload)
	profile.Name = strings.TrimSpace(account.ClientName)
	if profile.Name == "" {
		profile.Name = strings.TrimSpace(account.Hy2Identity)
	}
	if h.hy2ConfigManager != nil {
		if artifacts, validation := h.hy2ConfigManager.GenerateClientArtifacts(profile, "socks5"); validation.Valid {
			return artifacts.URIHy2
		}
	}
	return strings.Replace(h.buildHy2URI(account), "hysteria2://", "hy2://", 1)
}

func (h *Handler) buildHy2SingBoxOutbound(account repository.Hy2AccountWithClient) map[string]any {
	params := h.resolveHy2ClientParams()

	tls := map[string]any{"enabled": true}
	if strings.TrimSpace(params.SNI) != "" {
		tls["server_name"] = strings.TrimSpace(params.SNI)
	}
	if params.Insecure {
		tls["insecure"] = true
	}
	if strings.TrimSpace(params.PinSHA256) != "" {
		tls["certificate_public_key_sha256"] = []string{strings.TrimSpace(params.PinSHA256)}
	}

	serverPort := params.Port
	if serverPort <= 0 {
		serverPort = h.cfg.Hy2Port
	}

	outbound := map[string]any{
		"type":        "hysteria2",
		"tag":         "hy2-" + strings.TrimSpace(account.Hy2Identity),
		"server":      params.Server,
		"server_port": serverPort,
		"password":    account.AuthPayload,
		"tls":         tls,
	}

	if strings.TrimSpace(params.ObfsType) != "" {
		obfs := map[string]any{"type": strings.TrimSpace(params.ObfsType)}
		if strings.TrimSpace(params.ObfsPassword) != "" {
			obfs["password"] = strings.TrimSpace(params.ObfsPassword)
		}
		outbound["obfs"] = obfs
	}

	return outbound
}

func (h *Handler) resolveHy2ClientParams() services.Hy2ClientParams {
	params := services.Hy2ClientParams{
		Server:   services.NormalizeHost(h.cfg.Hy2Domain),
		Port:     h.cfg.Hy2Port,
		SNI:      services.NormalizeHost(h.cfg.Hy2Domain),
		Insecure: false,
	}
	if params.Server == "" {
		params.Server = services.NormalizeHost(h.cfg.PanelPublicHost)
	}
	if params.SNI == "" {
		params.SNI = params.Server
	}

	if h.hy2ConfigManager != nil {
		if content, err := h.hy2ConfigManager.Read(); err == nil {
			parsed := h.hy2ConfigManager.ClientParams(content, h.cfg.Hy2Domain, h.cfg.Hy2Port)
			if parsed.Server != "" {
				params = parsed
			}
		} else {
			h.logger.Debug("failed to read hysteria config for client params", "error", err)
		}
	}

	if params.Server == "" {
		params.Server = services.NormalizeHost(h.cfg.PanelPublicHost)
	}
	if params.Port <= 0 {
		params.Port = h.cfg.Hy2Port
	}
	if params.SNI == "" {
		params.SNI = params.Server
	}

	return params
}

func (h *Handler) resolveHy2ClientProfile(auth string) services.Hy2ClientProfile {
	profile := services.Hy2ClientProfile{
		Server:    services.NormalizeHost(h.cfg.Hy2Domain) + ":" + strconv.Itoa(h.cfg.Hy2Port),
		Auth:      strings.TrimSpace(auth),
		TLS:       services.Hy2ClientTLS{SNI: services.NormalizeHost(h.cfg.Hy2Domain)},
	}
	if h.hy2ConfigManager != nil {
		if content, err := h.hy2ConfigManager.Read(); err == nil {
			profile = h.hy2ConfigManager.DefaultClientProfile(content, h.cfg.Hy2Domain, h.cfg.Hy2Port, auth)
		}
	}
	profile.Auth = strings.TrimSpace(auth)
	if strings.TrimSpace(profile.Server) == "" {
		host := services.NormalizeHost(h.cfg.Hy2Domain)
		if host == "" {
			host = services.NormalizeHost(h.cfg.PanelPublicHost)
		}
		if host == "" {
			host = "127.0.0.1"
		}
		profile.Server = host + ":" + strconv.Itoa(h.cfg.Hy2Port)
	}
	return profile
}
func (h *Handler) buildMTProxyLink(secret string) string {
	host := services.NormalizeHost(h.cfg.MTProxyPublicHost)
	if host == "" {
		host = services.NormalizeHost(h.cfg.PanelPublicHost)
	}
	if host == "" {
		host = "127.0.0.1"
	}
	secretForLink := services.BuildTelegramMTProxySecret(secret, host, h.cfg.MTProxyTLSDomain)
	return "tg://proxy?server=" + url.QueryEscape(host) + "&port=" + strconv.Itoa(h.cfg.MTProxyPort) + "&secret=" + url.QueryEscape(secretForLink)
}

func parseInternalAuth(r *http.Request) string {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token != "" {
		return token
	}
	token = strings.TrimSpace(r.URL.Query().Get("auth_token"))
	if token != "" {
		return token
	}
	token = strings.TrimSpace(r.Header.Get("X-Internal-Token"))
	if token != "" {
		return token
	}
	token = strings.TrimSpace(r.Header.Get("X-Internal-Auth-Token"))
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







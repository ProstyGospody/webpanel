package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env                 string
	ListenAddr          string
	PublicPanelURL      string
	PanelPublicHost     string
	PanelPublicPort     int
	DatabaseURL         string
	MigrationsDir       string
	SessionCookieName   string
	CSRFCookieName      string
	CSRFHeaderName      string
	SessionTTL          time.Duration
	SecureCookies       bool
	InternalAuthToken   string
	Hy2Domain           string
	Hy2Port             int
	Hy2ConfigPath       string
	Hy2StatsURL         string
	Hy2StatsSecret      string
	Hy2PollInterval     time.Duration
	MTProxyPublicHost   string
	MTProxyPort         int
	MTProxyTLSDomain    string
	MTProxyStatsURL     string
	MTProxyStatsToken   string
	MTProxyPollInterval time.Duration
	ServicePollInterval time.Duration
	ManagedServices     []string
	SystemctlPath       string
	SudoPath            string
	JournalctlPath      string
	LogLinesMax         int
	RateLimitWindow     time.Duration
	RateLimitBurst      int
	MTProxySecretsPath  string
	MTProxyBinaryPath   string
	Hy2BinaryPath       string
	PrometheusEnabled   bool
	PrometheusURL       string
	PrometheusQueryTTL  time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Env:                 getEnv("APP_ENV", "production"),
		ListenAddr:          getEnv("PANEL_API_LISTEN_ADDR", "127.0.0.1:18080"),
		PublicPanelURL:      strings.TrimRight(getEnv("PANEL_PUBLIC_URL", ""), "/"),
		PanelPublicHost:     getEnv("PANEL_PUBLIC_HOST", "127.0.0.1"),
		PanelPublicPort:     getEnvInt("PANEL_PUBLIC_PORT", 8443),
		DatabaseURL:         getEnv("DATABASE_URL", ""),
		MigrationsDir:       getEnv("MIGRATIONS_DIR", "./migrations"),
		SessionCookieName:   getEnv("SESSION_COOKIE_NAME", "pp_session"),
		CSRFCookieName:      getEnv("CSRF_COOKIE_NAME", "pp_csrf"),
		CSRFHeaderName:      getEnv("CSRF_HEADER_NAME", "X-CSRF-Token"),
		SessionTTL:          getEnvDuration("SESSION_TTL", 24*time.Hour),
		SecureCookies:       getEnvBool("SECURE_COOKIES", true),
		InternalAuthToken:   getEnv("INTERNAL_AUTH_TOKEN", ""),
		Hy2Domain:           getEnv("HY2_DOMAIN", ""),
		Hy2Port:             getEnvInt("HY2_PORT", 443),
		Hy2ConfigPath:       getEnv("HY2_CONFIG_PATH", "/etc/proxy-panel/hysteria/server.yaml"),
		Hy2StatsURL:         strings.TrimRight(getEnv("HY2_STATS_URL", "http://127.0.0.1:8999"), "/"),
		Hy2StatsSecret:      getEnv("HY2_STATS_SECRET", ""),
		Hy2PollInterval:     getEnvDuration("HY2_POLL_INTERVAL", 10*time.Second),
		MTProxyPublicHost:   getEnv("MTPROXY_PUBLIC_HOST", ""),
		MTProxyPort:         getEnvInt("MTPROXY_PORT", 443),
		MTProxyTLSDomain:    getEnv("MTPROXY_TLS_DOMAIN", ""),
		MTProxyStatsURL:     strings.TrimRight(getEnv("MTPROXY_STATS_URL", "http://127.0.0.1:3129"), "/"),
		MTProxyStatsToken:   getEnv("MTPROXY_STATS_TOKEN", ""),
		MTProxyPollInterval: getEnvDuration("MTPROXY_POLL_INTERVAL", 10*time.Second),
		ServicePollInterval: getEnvDuration("SERVICE_POLL_INTERVAL", 30*time.Second),
		ManagedServices:     parseCSV(getEnv("MANAGED_SERVICES", "proxy-panel-api,proxy-panel-web,hysteria-server,mtproxy")),
		SystemctlPath:       getEnv("SYSTEMCTL_PATH", "/usr/bin/systemctl"),
		SudoPath:            getEnv("SUDO_PATH", "/usr/bin/sudo"),
		JournalctlPath:      getEnv("JOURNALCTL_PATH", "/usr/bin/journalctl"),
		LogLinesMax:         getEnvInt("SERVICE_LOG_LINES_MAX", 200),
		RateLimitWindow:     getEnvDuration("AUTH_RATE_LIMIT_WINDOW", 15*time.Minute),
		RateLimitBurst:      getEnvInt("AUTH_RATE_LIMIT_BURST", 10),
		MTProxySecretsPath:  getEnv("MTPROXY_SECRETS_PATH", "/etc/proxy-panel/mtproxy/secrets.list"),
		MTProxyBinaryPath:   getEnv("MTPROXY_BINARY_PATH", "/usr/local/bin/mtproto-proxy"),
		Hy2BinaryPath:       getEnv("HY2_BINARY_PATH", "/usr/local/bin/hysteria"),
		PrometheusEnabled:   getEnvBool("PROMETHEUS_ENABLED", false),
		PrometheusURL:       strings.TrimRight(getEnv("PROMETHEUS_URL", "http://127.0.0.1:9090"), "/"),
		PrometheusQueryTTL:  getEnvDuration("PROMETHEUS_QUERY_TIMEOUT", 2*time.Second),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.InternalAuthToken == "" {
		return Config{}, fmt.Errorf("INTERNAL_AUTH_TOKEN is required")
	}
	if cfg.Hy2StatsSecret == "" {
		return Config{}, fmt.Errorf("HY2_STATS_SECRET is required")
	}

	if cfg.PublicPanelURL == "" {
		scheme := "https"
		cfg.PublicPanelURL = fmt.Sprintf("%s://%s:%d", scheme, cfg.PanelPublicHost, cfg.PanelPublicPort)
	}

	return cfg, nil
}

func parseCSV(value string) []string {
	parts := strings.Split(value, ",")
	res := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed == "" {
			continue
		}
		res = append(res, trimmed)
	}
	return res
}

func getEnv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

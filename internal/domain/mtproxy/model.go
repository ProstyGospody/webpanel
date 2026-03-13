package mtproxy

import (
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const ShareModeTelegram = "telegram"

type Settings struct {
	Enabled         bool       `json:"enabled"`
	PublicHost      string     `json:"public_host"`
	ListenPort      int        `json:"listen_port"`
	CanonicalSecret string     `json:"canonical_secret"`
	ShareMode       string     `json:"share_mode"`
	ProxyTag        *string    `json:"proxy_tag,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	LastAppliedAt   *time.Time `json:"last_applied_at,omitempty"`
}

type Access struct {
	Settings        Settings `json:"settings"`
	TelegramURL     string   `json:"telegram_url"`
	TelegramDeepURL string   `json:"telegram_deep_url"`
}

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func NormalizeHost(raw string) string {
	host := strings.TrimSpace(raw)
	if host == "" {
		return ""
	}
	if strings.Contains(host, "://") {
		if parsed, err := url.Parse(host); err == nil {
			host = parsed.Host
		}
	}
	if idx := strings.IndexAny(host, "/?#"); idx >= 0 {
		host = host[:idx]
	}
	if parsedHost, _, err := net.SplitHostPort(host); err == nil {
		host = parsedHost
	}
	host = strings.Trim(strings.TrimSpace(host), "[]")
	host = strings.TrimSuffix(host, ".")
	return strings.ToLower(host)
}

func NormalizeSecret(input string) (string, error) {
	secret := strings.ToLower(strings.TrimSpace(input))
	secret = strings.TrimPrefix(secret, "0x")
	secret = strings.ReplaceAll(secret, " ", "")
	if strings.HasPrefix(secret, "dd") || strings.HasPrefix(secret, "ee") {
		if len(secret) < 34 {
			return "", fmt.Errorf("secret prefix is incomplete")
		}
		secret = secret[2:34]
	}
	if len(secret) != 32 {
		return "", fmt.Errorf("secret must be 32 hex characters")
	}
	for _, ch := range secret {
		if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'f') {
			return "", fmt.Errorf("secret must be hexadecimal")
		}
	}
	return secret, nil
}

func NormalizeShareMode(input string) string {
	value := strings.TrimSpace(strings.ToLower(input))
	if value == "" {
		return ShareModeTelegram
	}
	return value
}

func ValidateSettings(input Settings) []ValidationError {
	errors := make([]ValidationError, 0, 4)
	if NormalizeHost(input.PublicHost) == "" {
		errors = append(errors, ValidationError{Field: "public_host", Message: "public host is required"})
	}
	if input.ListenPort < 1 || input.ListenPort > 65535 {
		errors = append(errors, ValidationError{Field: "listen_port", Message: "listen port must be between 1 and 65535"})
	}
	if _, err := NormalizeSecret(input.CanonicalSecret); err != nil {
		errors = append(errors, ValidationError{Field: "canonical_secret", Message: err.Error()})
	}
	if NormalizeShareMode(input.ShareMode) != ShareModeTelegram {
		errors = append(errors, ValidationError{Field: "share_mode", Message: "share mode must be telegram"})
	}
	return errors
}

func BuildTelegramShareURL(host string, port int, canonicalSecret string) (string, error) {
	return buildTelegramLink("https://t.me/proxy", host, port, canonicalSecret)
}

func BuildTelegramDeepLink(host string, port int, canonicalSecret string) (string, error) {
	return buildTelegramLink("tg://proxy", host, port, canonicalSecret)
}

func buildTelegramLink(base string, host string, port int, canonicalSecret string) (string, error) {
	host = NormalizeHost(host)
	if host == "" {
		return "", fmt.Errorf("public host is required")
	}
	secret, err := NormalizeSecret(canonicalSecret)
	if err != nil {
		return "", err
	}
	if port < 1 || port > 65535 {
		return "", fmt.Errorf("listen port must be between 1 and 65535")
	}
	return fmt.Sprintf(
		"%s?server=%s&port=%s&secret=%s",
		base,
		url.QueryEscape(host),
		url.QueryEscape(strconv.Itoa(port)),
		url.QueryEscape(secret),
	), nil
}

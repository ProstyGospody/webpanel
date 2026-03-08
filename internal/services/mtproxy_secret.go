package services

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

func NormalizeMTProxySecret(input string) (string, error) {
	secret := strings.ToLower(strings.TrimSpace(input))
	secret = strings.TrimPrefix(secret, "0x")
	secret = strings.ReplaceAll(secret, " ", "")

	if strings.HasPrefix(secret, "dd") && len(secret) >= 34 {
		candidate := secret[2:34]
		if isHex(candidate) {
			return candidate, nil
		}
		return "", fmt.Errorf("invalid mtproxy dd secret")
	}

	if len(secret) != 32 || !isHex(secret) {
		return "", fmt.Errorf("mtproxy secret must be 32 hex characters")
	}

	return secret, nil
}

func BuildTelegramMTProxySecret(runtimeSecret string, _ string, _ string) string {
	normalized, err := NormalizeMTProxySecret(runtimeSecret)
	if err != nil {
		return strings.TrimSpace(runtimeSecret)
	}

	return "dd" + normalized
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

	host = strings.TrimSpace(strings.Trim(host, "[]"))
	host = strings.TrimSuffix(host, ".")
	return strings.ToLower(host)
}

func isHex(value string) bool {
	if value == "" {
		return false
	}
	for _, ch := range value {
		if (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') {
			continue
		}
		return false
	}
	return true
}

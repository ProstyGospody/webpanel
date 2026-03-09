package services

import (
	"encoding/hex"
	"fmt"
	"net"
	"net/url"
	"strings"
)

func NormalizeMTProxySecret(input string) (string, error) {
	secret := strings.ToLower(strings.TrimSpace(input))
	secret = strings.TrimPrefix(secret, "0x")
	secret = strings.ReplaceAll(secret, " ", "")

	if (strings.HasPrefix(secret, "dd") || strings.HasPrefix(secret, "ee")) && len(secret) >= 34 {
		candidate := secret[2:34]
		if isHex(candidate) {
			return candidate, nil
		}
		return "", fmt.Errorf("invalid mtproxy prefixed secret")
	}

	if len(secret) != 32 || !isHex(secret) {
		return "", fmt.Errorf("mtproxy secret must be 32 hex characters")
	}

	return secret, nil
}

func BuildTelegramMTProxySecret(runtimeSecret string, publicHost string, tlsDomain string) string {
	normalized, err := NormalizeMTProxySecret(runtimeSecret)
	if err != nil {
		return strings.TrimSpace(runtimeSecret)
	}

	domain := NormalizeHost(tlsDomain)
	if domain == "" {
		domain = NormalizeHost(publicHost)
	}
	if isValidMTProxyTLSDomain(domain) {
		return "ee" + normalized + hex.EncodeToString([]byte(domain))
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

func isValidMTProxyTLSDomain(domain string) bool {
	if domain == "" {
		return false
	}
	if net.ParseIP(domain) != nil {
		return false
	}
	if !strings.Contains(domain, ".") {
		return false
	}
	for _, ch := range domain {
		switch {
		case ch >= 'a' && ch <= 'z':
		case ch >= '0' && ch <= '9':
		case ch == '.':
		case ch == '-':
		default:
			return false
		}
	}
	return true
}

package services

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Hy2ConfigSummary struct {
	Listen                string   `json:"listen"`
	Port                  int      `json:"port"`
	AuthType              string   `json:"auth_type"`
	AuthHTTPURL           string   `json:"auth_http_url,omitempty"`
	PrimaryDomain         string   `json:"primary_domain,omitempty"`
	SNI                   string   `json:"sni,omitempty"`
	Insecure              bool     `json:"insecure"`
	ObfsType              string   `json:"obfs_type,omitempty"`
	ObfsPassword          string   `json:"obfs_password,omitempty"`
	ALPN                  []string `json:"alpn,omitempty"`
	TrafficStatsListen    string   `json:"traffic_stats_listen,omitempty"`
	HasTrafficStatsSecret bool     `json:"has_traffic_stats_secret"`
}

type Hy2ConfigValidation struct {
	Valid    bool             `json:"valid"`
	Errors   []string         `json:"errors"`
	Warnings []string         `json:"warnings"`
	Summary  Hy2ConfigSummary `json:"summary"`
}

type Hy2ClientParams struct {
	Server       string   `json:"server"`
	Port         int      `json:"port"`
	SNI          string   `json:"sni"`
	Insecure     bool     `json:"insecure"`
	ObfsType     string   `json:"obfs_type,omitempty"`
	ObfsPassword string   `json:"obfs_password,omitempty"`
	ALPN         []string `json:"alpn,omitempty"`
}

type HysteriaConfigManager struct {
	Path string
}

func NewHysteriaConfigManager(path string) *HysteriaConfigManager {
	return &HysteriaConfigManager{Path: strings.TrimSpace(path)}
}

func (m *HysteriaConfigManager) Read() (string, error) {
	if strings.TrimSpace(m.Path) == "" {
		return "", fmt.Errorf("hysteria config path is empty")
	}
	content, err := os.ReadFile(m.Path)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func (m *HysteriaConfigManager) Parse(content string) Hy2ConfigSummary {
	summary := Hy2ConfigSummary{}
	frames := make([]yamlFrame, 0, 8)
	lines := strings.Split(content, "\n")

	for _, raw := range lines {
		line := strings.TrimRight(raw, "\r")
		if strings.TrimSpace(line) == "" {
			continue
		}
		noComments := stripYAMLComments(line)
		if strings.TrimSpace(noComments) == "" {
			continue
		}

		indent := countLeadingSpaces(noComments)
		trimmed := strings.TrimSpace(noComments)

		for len(frames) > 0 && indent <= frames[len(frames)-1].Indent {
			frames = frames[:len(frames)-1]
		}

		if strings.HasPrefix(trimmed, "- ") {
			item := cleanScalar(trimmed[2:])
			if item == "" {
				continue
			}
			switch framePath(frames) {
			case "acme.domains":
				if summary.PrimaryDomain == "" {
					summary.PrimaryDomain = NormalizeHost(item)
				}
			case "tls.alpn":
				summary.ALPN = append(summary.ALPN, item)
			}
			continue
		}

		key, value, ok := splitYAMLKeyValue(trimmed)
		if !ok {
			continue
		}

		path := key
		if len(frames) > 0 {
			path = framePath(frames) + "." + key
		}

		if value == "" {
			frames = append(frames, yamlFrame{Indent: indent, Key: key})
			continue
		}

		parsed := cleanScalar(value)
		switch path {
		case "listen":
			summary.Listen = parsed
			if port, ok := parseListenPort(parsed); ok {
				summary.Port = port
			}
		case "auth.type":
			summary.AuthType = strings.ToLower(parsed)
		case "auth.http.url":
			summary.AuthHTTPURL = parsed
		case "tls.sni":
			summary.SNI = NormalizeHost(parsed)
		case "tls.insecure":
			summary.Insecure = parseYAMLBool(parsed)
		case "obfs.type":
			summary.ObfsType = parsed
		case "obfs.password":
			summary.ObfsPassword = parsed
		case "trafficStats.listen":
			summary.TrafficStatsListen = parsed
		case "trafficStats.secret":
			summary.HasTrafficStatsSecret = parsed != ""
		case "acme.domains":
			if summary.PrimaryDomain == "" {
				summary.PrimaryDomain = NormalizeHost(parsed)
			}
		case "tls.alpn":
			summary.ALPN = append(summary.ALPN, parsed)
		}
	}

	return summary
}

func (m *HysteriaConfigManager) Validate(content string) Hy2ConfigValidation {
	validation := Hy2ConfigValidation{
		Errors:   make([]string, 0, 4),
		Warnings: make([]string, 0, 4),
	}

	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		validation.Errors = append(validation.Errors, "config is empty")
		validation.Valid = false
		return validation
	}

	summary := m.Parse(content)
	validation.Summary = summary

	if strings.TrimSpace(summary.Listen) == "" {
		validation.Errors = append(validation.Errors, "listen is required")
	} else if summary.Port <= 0 || summary.Port > 65535 {
		validation.Errors = append(validation.Errors, "listen port is invalid")
	}

	if strings.TrimSpace(summary.AuthType) == "" {
		validation.Errors = append(validation.Errors, "auth.type is required")
	}
	if summary.AuthType == "http" && strings.TrimSpace(summary.AuthHTTPURL) == "" {
		validation.Errors = append(validation.Errors, "auth.http.url is required when auth.type=http")
	}

	if strings.TrimSpace(summary.TrafficStatsListen) == "" {
		validation.Warnings = append(validation.Warnings, "trafficStats.listen is empty, stats polling may fail")
	}
	if !summary.HasTrafficStatsSecret {
		validation.Warnings = append(validation.Warnings, "trafficStats.secret is empty, stats polling may fail")
	}
	if summary.PrimaryDomain == "" && summary.SNI == "" {
		validation.Warnings = append(validation.Warnings, "no acme/tls domain detected, client SNI may be invalid")
	}

	validation.Valid = len(validation.Errors) == 0
	return validation
}

func (m *HysteriaConfigManager) Save(content string) (string, error) {
	if strings.TrimSpace(m.Path) == "" {
		return "", fmt.Errorf("hysteria config path is empty")
	}

	dir := filepath.Dir(m.Path)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", fmt.Errorf("create config directory: %w", err)
	}

	mode := os.FileMode(0o640)
	backupPath := ""
	if st, err := os.Stat(m.Path); err == nil {
		mode = st.Mode().Perm()
		previous, readErr := os.ReadFile(m.Path)
		if readErr == nil {
			backupPath = fmt.Sprintf("%s.bak.%d", m.Path, time.Now().UTC().Unix())
			if writeErr := os.WriteFile(backupPath, previous, mode); writeErr != nil {
				return "", fmt.Errorf("write backup file: %w", writeErr)
			}
		}
	}

	normalized := strings.TrimRight(content, "\n") + "\n"
	tmpPath := m.Path + ".tmp"
	if err := os.WriteFile(tmpPath, []byte(normalized), mode); err != nil {
		return "", fmt.Errorf("write config temp file: %w", err)
	}
	if err := os.Rename(tmpPath, m.Path); err != nil {
		return "", fmt.Errorf("replace config file: %w", err)
	}
	return backupPath, nil
}

func (m *HysteriaConfigManager) ClientParams(content string, fallbackHost string, fallbackPort int) Hy2ClientParams {
	summary := m.Parse(content)

	host := NormalizeHost(summary.PrimaryDomain)
	if host == "" {
		host = NormalizeHost(fallbackHost)
	}
	if host == "" {
		host = "127.0.0.1"
	}

	sni := NormalizeHost(summary.SNI)
	if sni == "" {
		sni = host
	}

	port := summary.Port
	if port <= 0 {
		port = fallbackPort
	}

	return Hy2ClientParams{
		Server:       host,
		Port:         port,
		SNI:          sni,
		Insecure:     summary.Insecure,
		ObfsType:     summary.ObfsType,
		ObfsPassword: summary.ObfsPassword,
		ALPN:         summary.ALPN,
	}
}

type yamlFrame struct {
	Indent int
	Key    string
}

func framePath(frames []yamlFrame) string {
	if len(frames) == 0 {
		return ""
	}
	parts := make([]string, 0, len(frames))
	for _, frame := range frames {
		parts = append(parts, frame.Key)
	}
	return strings.Join(parts, ".")
}

func splitYAMLKeyValue(line string) (string, string, bool) {
	idx := strings.Index(line, ":")
	if idx <= 0 {
		return "", "", false
	}
	key := strings.TrimSpace(line[:idx])
	if key == "" {
		return "", "", false
	}
	value := strings.TrimSpace(line[idx+1:])
	return key, value, true
}

func cleanScalar(value string) string {
	trimmed := strings.TrimSpace(value)
	trimmed = strings.Trim(trimmed, "\"'")
	return strings.TrimSpace(trimmed)
}

func stripYAMLComments(line string) string {
	var b strings.Builder
	inSingle := false
	inDouble := false

	for _, ch := range line {
		switch ch {
		case '\'':
			if !inDouble {
				inSingle = !inSingle
			}
		case '"':
			if !inSingle {
				inDouble = !inDouble
			}
		case '#':
			if !inSingle && !inDouble {
				return b.String()
			}
		}
		b.WriteRune(ch)
	}
	return b.String()
}

func countLeadingSpaces(line string) int {
	count := 0
	for _, ch := range line {
		if ch != ' ' {
			break
		}
		count++
	}
	return count
}

func parseListenPort(listen string) (int, bool) {
	value := strings.TrimSpace(listen)
	if value == "" {
		return 0, false
	}
	value = strings.Trim(value, "\"'")

	if strings.HasPrefix(value, ":") {
		port, err := strconv.Atoi(strings.TrimPrefix(value, ":"))
		if err == nil {
			return port, true
		}
	}

	if port, err := strconv.Atoi(value); err == nil {
		return port, true
	}

	if host, portText, err := net.SplitHostPort(value); err == nil {
		_ = host
		if port, convErr := strconv.Atoi(portText); convErr == nil {
			return port, true
		}
	}

	idx := strings.LastIndex(value, ":")
	if idx > 0 && idx < len(value)-1 {
		if port, err := strconv.Atoi(value[idx+1:]); err == nil {
			return port, true
		}
	}

	return 0, false
}

func parseYAMLBool(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

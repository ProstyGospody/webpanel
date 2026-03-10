package services

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type Hy2ConfigSummary struct {
	Listen                string `json:"listen"`
	Port                  int    `json:"port"`
	AuthType              string `json:"auth_type"`
	AuthHTTPURL           string `json:"auth_http_url,omitempty"`
	PrimaryDomain         string `json:"primary_domain,omitempty"`
	SNI                   string `json:"sni,omitempty"`
	Insecure              bool   `json:"insecure"`
	PinSHA256             string `json:"pin_sha256,omitempty"`
	ObfsType              string `json:"obfs_type,omitempty"`
	ObfsPassword          string `json:"obfs_password,omitempty"`
	MasqueradeType        string `json:"masquerade_type,omitempty"`
	MasqueradeURL         string `json:"masquerade_url,omitempty"`
	MasqueradeRewriteHost *bool  `json:"masquerade_rewrite_host,omitempty"`
	ALPN                  []string `json:"alpn,omitempty"`
	TrafficStatsListen    string `json:"traffic_stats_listen,omitempty"`
	HasTrafficStatsSecret bool   `json:"has_traffic_stats_secret"`
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
	PinSHA256    string   `json:"pin_sha256,omitempty"`
	ObfsType     string   `json:"obfs_type,omitempty"`
	ObfsPassword string   `json:"obfs_password,omitempty"`
	ALPN         []string `json:"alpn,omitempty"`
}

type Hy2Settings struct {
	Port                 int    `json:"port"`
	SNI                  string `json:"sni"`
	ObfsEnabled          bool   `json:"obfs_enabled"`
	ObfsType             string `json:"obfs_type,omitempty"`
	ObfsPassword         string `json:"obfs_password,omitempty"`
	MasqueradeEnabled    bool   `json:"masquerade_enabled"`
	MasqueradeType       string `json:"masquerade_type,omitempty"`
	MasqueradeURL        string `json:"masquerade_url,omitempty"`
	MasqueradeRewriteHost bool  `json:"masquerade_rewrite_host"`
}

type Hy2SettingsValidation struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}

type HysteriaConfigManager struct {
	Path string
}

var yamlSafeScalarPattern = regexp.MustCompile(`^[a-zA-Z0-9._:/@-]+$`)

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
			switch strings.ToLower(framePath(frames)) {
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
		pathLower := strings.ToLower(path)

		if value == "" {
			frames = append(frames, yamlFrame{Indent: indent, Key: key})
			continue
		}

		parsed := cleanScalar(value)
		switch pathLower {
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
		case "tls.pinsha256":
			summary.PinSHA256 = parsed
		case "obfs.type":
			summary.ObfsType = strings.ToLower(parsed)
		case "obfs.password":
			summary.ObfsPassword = parsed
		case "obfs.salamander.password":
			summary.ObfsPassword = parsed
		case "masquerade.type":
			summary.MasqueradeType = strings.ToLower(parsed)
		case "masquerade.proxy.url":
			summary.MasqueradeURL = parsed
		case "masquerade.proxy.rewritehost":
			value := parseYAMLBool(parsed)
			summary.MasqueradeRewriteHost = &value
		case "trafficstats.listen":
			summary.TrafficStatsListen = parsed
		case "trafficstats.secret":
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
	if strings.TrimSpace(summary.ObfsType) != "" && strings.TrimSpace(summary.ObfsPassword) == "" {
		validation.Warnings = append(validation.Warnings, "obfs is enabled but password is empty")
	}
	if strings.TrimSpace(summary.MasqueradeType) != "" && summary.MasqueradeType != "proxy" {
		validation.Warnings = append(validation.Warnings, "masquerade type is not proxy; UI supports proxy mode")
	}

	validation.Valid = len(validation.Errors) == 0
	return validation
}

func (m *HysteriaConfigManager) ExtractSettings(content string, fallbackHost string, fallbackPort int) Hy2Settings {
	summary := m.Parse(content)

	port := summary.Port
	if port <= 0 {
		port = fallbackPort
	}

	sni := NormalizeHost(summary.SNI)
	if sni == "" {
		sni = NormalizeHost(summary.PrimaryDomain)
	}
	if sni == "" {
		sni = NormalizeHost(fallbackHost)
	}

	obfsType := strings.TrimSpace(strings.ToLower(summary.ObfsType))
	obfsEnabled := obfsType != ""
	if obfsEnabled && obfsType == "" {
		obfsType = "salamander"
	}

	masqueradeType := strings.TrimSpace(strings.ToLower(summary.MasqueradeType))
	masqueradeEnabled := masqueradeType != "" || strings.TrimSpace(summary.MasqueradeURL) != ""
	if masqueradeEnabled && masqueradeType == "" {
		masqueradeType = "proxy"
	}

	rewriteHost := true
	if summary.MasqueradeRewriteHost != nil {
		rewriteHost = *summary.MasqueradeRewriteHost
	}

	return Hy2Settings{
		Port:                  port,
		SNI:                   sni,
		ObfsEnabled:           obfsEnabled,
		ObfsType:              obfsType,
		ObfsPassword:          strings.TrimSpace(summary.ObfsPassword),
		MasqueradeEnabled:     masqueradeEnabled,
		MasqueradeType:        masqueradeType,
		MasqueradeURL:         strings.TrimSpace(summary.MasqueradeURL),
		MasqueradeRewriteHost: rewriteHost,
	}
}

func (m *HysteriaConfigManager) ValidateSettings(input Hy2Settings) Hy2SettingsValidation {
	settings := normalizeSettings(input)
	validation := Hy2SettingsValidation{
		Errors:   make([]string, 0, 4),
		Warnings: make([]string, 0, 3),
	}

	if input.ObfsEnabled && input.MasqueradeEnabled {
		validation.Errors = append(validation.Errors, "obfs and masquerade are mutually exclusive; choose one mode")
	}

	if settings.Port <= 0 || settings.Port > 65535 {
		validation.Errors = append(validation.Errors, "port must be between 1 and 65535")
	}

	if NormalizeHost(settings.SNI) == "" {
		validation.Errors = append(validation.Errors, "sni must be a valid host")
	}

	if settings.ObfsEnabled {
		if settings.ObfsType == "" {
			validation.Errors = append(validation.Errors, "obfs type is required")
		}
		if strings.TrimSpace(settings.ObfsPassword) == "" {
			validation.Errors = append(validation.Errors, "obfs password is required when obfs is enabled")
		} else if len(strings.TrimSpace(settings.ObfsPassword)) < 8 {
			validation.Warnings = append(validation.Warnings, "obfs password is short; use at least 8 characters")
		}
	}

	if settings.MasqueradeEnabled {
		if settings.MasqueradeType != "proxy" {
			validation.Errors = append(validation.Errors, "masquerade type must be proxy")
		}

		target := strings.TrimSpace(settings.MasqueradeURL)
		if target == "" {
			validation.Errors = append(validation.Errors, "masquerade URL is required when masquerade is enabled")
		} else {
			parsed, err := url.Parse(target)
			if err != nil || parsed.Scheme == "" || parsed.Host == "" {
				validation.Errors = append(validation.Errors, "masquerade URL must be a valid absolute URL")
			} else if parsed.Scheme != "http" && parsed.Scheme != "https" {
				validation.Errors = append(validation.Errors, "masquerade URL must use http or https scheme")
			}
		}
	}

	validation.Valid = len(validation.Errors) == 0
	return validation
}

func (m *HysteriaConfigManager) ApplySettings(content string, input Hy2Settings) (string, Hy2SettingsValidation) {
	settings := normalizeSettings(input)
	validation := m.ValidateSettings(input)
	if !validation.Valid {
		return content, validation
	}

	lines := splitConfigLines(content)

	listenBlock := []string{fmt.Sprintf("listen: :%d", settings.Port)}
	lines = replaceTopLevelBlock(lines, "listen", listenBlock)
	lines = setNestedScalar(lines, "tls", "sni", yamlScalar(settings.SNI))

	if settings.ObfsEnabled {
		obfsBlock := buildObfsBlock(settings)
		lines = replaceTopLevelBlock(lines, "obfs", obfsBlock)
	} else {
		lines = removeTopLevelBlock(lines, "obfs")
	}

	if settings.MasqueradeEnabled {
		masqueradeBlock := buildMasqueradeBlock(settings)
		lines = replaceTopLevelBlock(lines, "masquerade", masqueradeBlock)
	} else {
		lines = removeTopLevelBlock(lines, "masquerade")
	}

	next := strings.Join(trimEdgeEmptyLines(lines), "\n")
	if strings.TrimSpace(next) == "" {
		next = content
	}
	next = strings.TrimRight(next, "\n") + "\n"
	return next, validation
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
		PinSHA256:    summary.PinSHA256,
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

func normalizeSettings(input Hy2Settings) Hy2Settings {
	settings := Hy2Settings{
		Port:                  input.Port,
		SNI:                   NormalizeHost(input.SNI),
		ObfsEnabled:           input.ObfsEnabled,
		ObfsType:              strings.ToLower(strings.TrimSpace(input.ObfsType)),
		ObfsPassword:          strings.TrimSpace(input.ObfsPassword),
		MasqueradeEnabled:     input.MasqueradeEnabled,
		MasqueradeType:        strings.ToLower(strings.TrimSpace(input.MasqueradeType)),
		MasqueradeURL:         strings.TrimSpace(input.MasqueradeURL),
		MasqueradeRewriteHost: input.MasqueradeRewriteHost,
	}

	if settings.ObfsEnabled {
		if settings.ObfsType == "" {
			settings.ObfsType = "salamander"
		}
		if settings.ObfsPassword == "" {
			settings.ObfsPassword = generateObfsPassword()
		}
	}

	if settings.MasqueradeEnabled {
		if settings.MasqueradeType == "" {
			settings.MasqueradeType = "proxy"
		}
	}

	if !settings.ObfsEnabled {
		settings.ObfsType = ""
		settings.ObfsPassword = ""
	}

	if !settings.MasqueradeEnabled {
		settings.MasqueradeType = ""
		settings.MasqueradeURL = ""
	}

	return settings
}

func generateObfsPassword() string {
	raw := make([]byte, 18)
	if _, err := rand.Read(raw); err != nil {
		return fmt.Sprintf("obfs-%d", time.Now().UTC().UnixNano())
	}
	return base64.RawURLEncoding.EncodeToString(raw)
}

func splitConfigLines(content string) []string {
	normalized := strings.ReplaceAll(content, "\r\n", "\n")
	normalized = strings.ReplaceAll(normalized, "\r", "\n")
	normalized = strings.TrimRight(normalized, "\n")
	if strings.TrimSpace(normalized) == "" {
		return []string{}
	}
	return strings.Split(normalized, "\n")
}

func findTopLevelBlock(lines []string, key string) (int, int, bool) {
	search := strings.ToLower(strings.TrimSpace(key))
	start := -1

	for idx, raw := range lines {
		line := strings.TrimRight(raw, "\r")
		withoutComments := stripYAMLComments(line)
		trimmed := strings.TrimSpace(withoutComments)
		if trimmed == "" {
			continue
		}
		if countLeadingSpaces(withoutComments) != 0 {
			continue
		}
		parsedKey, _, ok := splitYAMLKeyValue(trimmed)
		if !ok {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(parsedKey), search) {
			start = idx
			break
		}
	}

	if start == -1 {
		return -1, -1, false
	}

	end := len(lines)
	for idx := start + 1; idx < len(lines); idx++ {
		line := strings.TrimRight(lines[idx], "\r")
		withoutComments := stripYAMLComments(line)
		trimmed := strings.TrimSpace(withoutComments)
		if trimmed == "" {
			continue
		}
		if countLeadingSpaces(withoutComments) == 0 {
			end = idx
			break
		}
	}

	return start, end, true
}

func replaceTopLevelBlock(lines []string, key string, block []string) []string {
	start, end, found := findTopLevelBlock(lines, key)
	if found {
		replaced := make([]string, 0, len(lines)-(end-start)+len(block))
		replaced = append(replaced, lines[:start]...)
		replaced = append(replaced, block...)
		replaced = append(replaced, lines[end:]...)
		return replaced
	}

	if len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) != "" {
		lines = append(lines, "")
	}
	lines = append(lines, block...)
	return lines
}

func removeTopLevelBlock(lines []string, key string) []string {
	start, end, found := findTopLevelBlock(lines, key)
	if !found {
		return lines
	}
	trimmed := make([]string, 0, len(lines)-(end-start))
	trimmed = append(trimmed, lines[:start]...)
	trimmed = append(trimmed, lines[end:]...)
	return trimEdgeEmptyLines(trimmed)
}

func setNestedScalar(lines []string, topKey string, nestedKey string, value string) []string {
	start, end, found := findTopLevelBlock(lines, topKey)
	line := "  " + nestedKey + ": " + value

	if !found {
		block := []string{topKey + ":", line}
		return replaceTopLevelBlock(lines, topKey, block)
	}

	for idx := start + 1; idx < end; idx++ {
		withoutComments := stripYAMLComments(lines[idx])
		trimmed := strings.TrimSpace(withoutComments)
		if trimmed == "" {
			continue
		}
		if countLeadingSpaces(withoutComments) != 2 {
			continue
		}
		candidate, _, ok := splitYAMLKeyValue(trimmed)
		if !ok {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(candidate), nestedKey) {
			lines[idx] = line
			return lines
		}
	}

	insertAt := start + 1
	for insertAt < end && strings.TrimSpace(lines[insertAt]) == "" {
		insertAt++
	}

	updated := make([]string, 0, len(lines)+1)
	updated = append(updated, lines[:insertAt]...)
	updated = append(updated, line)
	updated = append(updated, lines[insertAt:]...)
	return updated
}

func buildObfsBlock(settings Hy2Settings) []string {
	if strings.EqualFold(settings.ObfsType, "salamander") {
		return []string{
			"obfs:",
			"  type: salamander",
			"  salamander:",
			"    password: " + yamlScalar(settings.ObfsPassword),
		}
	}

	return []string{
		"obfs:",
		"  type: " + yamlScalar(settings.ObfsType),
		"  password: " + yamlScalar(settings.ObfsPassword),
	}
}

func buildMasqueradeBlock(settings Hy2Settings) []string {
	return []string{
		"masquerade:",
		"  type: proxy",
		"  proxy:",
		"    url: " + yamlScalar(settings.MasqueradeURL),
		fmt.Sprintf("    rewriteHost: %t", settings.MasqueradeRewriteHost),
	}
}

func yamlScalar(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "''"
	}
	if yamlSafeScalarPattern.MatchString(trimmed) {
		return trimmed
	}
	escaped := strings.ReplaceAll(trimmed, "'", "''")
	return "'" + escaped + "'"
}

func trimEdgeEmptyLines(lines []string) []string {
	start := 0
	for start < len(lines) && strings.TrimSpace(lines[start]) == "" {
		start++
	}
	end := len(lines)
	for end > start && strings.TrimSpace(lines[end-1]) == "" {
		end--
	}
	if start >= end {
		return []string{}
	}
	return lines[start:end]
}


package handlers

import (
	"net/http"

	"proxy-panel/internal/http/render"
	"proxy-panel/internal/services"
)

type hy2SettingsValidateResponse struct {
	Settings          services.Hy2Settings          `json:"settings"`
	SettingsValidation services.Hy2SettingsValidation `json:"settings_validation"`
	ConfigValidation  services.Hy2ConfigValidation  `json:"config_validation"`
	RawYAML           string                        `json:"raw_yaml"`
	ClientProfile     services.Hy2ClientProfile     `json:"client_profile"`
	ClientArtifacts   services.Hy2ClientArtifacts   `json:"client_artifacts"`
	ClientValidation  services.Hy2ClientValidation  `json:"client_validation"`
}

func (h *Handler) GetHy2Settings(w http.ResponseWriter, r *http.Request) {
	if h.hy2ConfigManager == nil {
		render.Error(w, http.StatusInternalServerError, "hysteria config manager is not configured")
		return
	}

	content, err := h.hy2ConfigManager.Read()
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to read hysteria config")
		return
	}

	settings, parseErr := h.hy2ConfigManager.ExtractSettingsWithError(content, h.cfg.Hy2Domain, h.cfg.Hy2Port)
	if parseErr != nil {
		settings = h.hy2ConfigManager.ExtractSettings("", h.cfg.Hy2Domain, h.cfg.Hy2Port)
	}

	settingsValidation := h.hy2ConfigManager.ValidateSettings(settings)
	configValidation := h.hy2ConfigManager.Validate(content)

	profile := h.hy2ConfigManager.DefaultClientProfileFromSettings(settings, h.cfg.Hy2Domain, h.cfg.Hy2Port, "replace-with-auth")
	artifacts, clientValidation := h.hy2ConfigManager.GenerateClientArtifacts(profile, "socks5")

	if parseErr != nil {
		configValidation.Valid = false
		configValidation.Errors = append(configValidation.Errors, "failed to parse current YAML into structured settings")
	}

	render.JSON(w, http.StatusOK, map[string]any{
		"path":                h.cfg.Hy2ConfigPath,
		"raw_yaml":            content,
		"settings":            settings,
		"settings_validation": settingsValidation,
		"config_validation":   configValidation,
		"raw_only_paths":      configValidation.RawOnlyPaths,
		"client_profile":      profile,
		"client_artifacts":    artifacts,
		"client_validation":   clientValidation,
	})
}

func (h *Handler) ValidateHy2Settings(w http.ResponseWriter, r *http.Request) {
	if h.hy2ConfigManager == nil {
		render.Error(w, http.StatusInternalServerError, "hysteria config manager is not configured")
		return
	}

	var req services.Hy2Settings
	if err := render.DecodeJSON(r, &req); err != nil {
		render.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	current, err := h.hy2ConfigManager.Read()
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to read hysteria config")
		return
	}

	next, settingsValidation := h.hy2ConfigManager.ApplySettings(current, req)
	configValidation := h.hy2ConfigManager.Validate(next)

	previewSettings, parseErr := h.hy2ConfigManager.ExtractSettingsWithError(next, h.cfg.Hy2Domain, h.cfg.Hy2Port)
	if parseErr != nil {
		previewSettings = req
	}
	profile := h.hy2ConfigManager.DefaultClientProfileFromSettings(previewSettings, h.cfg.Hy2Domain, h.cfg.Hy2Port, "replace-with-auth")
	artifacts, clientValidation := h.hy2ConfigManager.GenerateClientArtifacts(profile, "socks5")

	render.JSON(w, http.StatusOK, hy2SettingsValidateResponse{
		Settings:           previewSettings,
		SettingsValidation: settingsValidation,
		ConfigValidation:   configValidation,
		RawYAML:            next,
		ClientProfile:      profile,
		ClientArtifacts:    artifacts,
		ClientValidation:   clientValidation,
	})
}

func (h *Handler) SaveHy2Settings(w http.ResponseWriter, r *http.Request) {
	if h.hy2ConfigManager == nil {
		render.Error(w, http.StatusInternalServerError, "hysteria config manager is not configured")
		return
	}

	var req services.Hy2Settings
	if err := render.DecodeJSON(r, &req); err != nil {
		render.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	current, err := h.hy2ConfigManager.Read()
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to read hysteria config")
		return
	}

	next, settingsValidation := h.hy2ConfigManager.ApplySettings(current, req)
	if !settingsValidation.Valid {
		render.JSON(w, http.StatusBadRequest, map[string]any{
			"error":               "settings validation failed",
			"settings_validation": settingsValidation,
		})
		return
	}

	configValidation := h.hy2ConfigManager.Validate(next)
	if !configValidation.Valid {
		render.JSON(w, http.StatusBadRequest, map[string]any{
			"error":             "generated config is invalid",
			"config_validation": configValidation,
		})
		return
	}

	backupPath, err := h.hy2ConfigManager.Save(next)
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to save hysteria settings")
		return
	}

	updated, parseErr := h.hy2ConfigManager.ExtractSettingsWithError(next, h.cfg.Hy2Domain, h.cfg.Hy2Port)
	if parseErr != nil {
		updated = req
	}
	profile := h.hy2ConfigManager.DefaultClientProfileFromSettings(updated, h.cfg.Hy2Domain, h.cfg.Hy2Port, "replace-with-auth")
	artifacts, clientValidation := h.hy2ConfigManager.GenerateClientArtifacts(profile, "socks5")

	h.audit(r, "hy2.settings.save", "hy2_config", nil, map[string]any{
		"path":     h.cfg.Hy2ConfigPath,
		"backup":   backupPath,
		"listen":   updated.Listen,
		"tls_mode": updated.TLSMode,
	})

	render.JSON(w, http.StatusOK, map[string]any{
		"ok":                  true,
		"path":                h.cfg.Hy2ConfigPath,
		"backup_path":         backupPath,
		"raw_yaml":            next,
		"settings":            updated,
		"settings_validation": settingsValidation,
		"config_validation":   configValidation,
		"raw_only_paths":      configValidation.RawOnlyPaths,
		"client_profile":      profile,
		"client_artifacts":    artifacts,
		"client_validation":   clientValidation,
	})
}

func (h *Handler) ApplyHy2Settings(w http.ResponseWriter, r *http.Request) {
	h.ApplyHy2Config(w, r)
}
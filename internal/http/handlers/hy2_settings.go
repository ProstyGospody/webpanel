package handlers

import (
	"net/http"

	"proxy-panel/internal/http/render"
	"proxy-panel/internal/services"
)

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

	settings := h.hy2ConfigManager.ExtractSettings(content, h.cfg.Hy2Domain, h.cfg.Hy2Port)
	settingsValidation := h.hy2ConfigManager.ValidateSettings(settings)
	configValidation := h.hy2ConfigManager.Validate(content)
	params := h.hy2ConfigManager.ClientParams(content, h.cfg.Hy2Domain, h.cfg.Hy2Port)

	render.JSON(w, http.StatusOK, map[string]any{
		"path":                h.cfg.Hy2ConfigPath,
		"settings":            settings,
		"settings_validation": settingsValidation,
		"config_validation":   configValidation,
		"client_params":       params,
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
	params := h.hy2ConfigManager.ClientParams(next, h.cfg.Hy2Domain, h.cfg.Hy2Port)

	render.JSON(w, http.StatusOK, map[string]any{
		"settings_validation": settingsValidation,
		"config_validation":   configValidation,
		"client_params":       params,
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

	updated := h.hy2ConfigManager.ExtractSettings(next, h.cfg.Hy2Domain, h.cfg.Hy2Port)
	params := h.hy2ConfigManager.ClientParams(next, h.cfg.Hy2Domain, h.cfg.Hy2Port)

	h.audit(r, "hy2.settings.save", "hy2_config", nil, map[string]any{
		"path":        h.cfg.Hy2ConfigPath,
		"backup":      backupPath,
		"port":        updated.Port,
		"sni":         updated.SNI,
		"obfs_enabled": updated.ObfsEnabled,
	})

	render.JSON(w, http.StatusOK, map[string]any{
		"ok":                  true,
		"path":                h.cfg.Hy2ConfigPath,
		"backup_path":         backupPath,
		"settings":            updated,
		"settings_validation": settingsValidation,
		"config_validation":   configValidation,
		"client_params":       params,
	})
}

func (h *Handler) ApplyHy2Settings(w http.ResponseWriter, r *http.Request) {
	h.ApplyHy2Config(w, r)
}

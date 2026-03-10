package handlers

import (
	"net/http"
	"strings"

	"proxy-panel/internal/http/render"
)

type hy2ConfigRequest struct {
	Content string `json:"content"`
}

func (h *Handler) GetHy2Config(w http.ResponseWriter, r *http.Request) {
	if h.hy2ConfigManager == nil {
		render.Error(w, http.StatusInternalServerError, "hysteria config manager is not configured")
		return
	}
	content, err := h.hy2ConfigManager.Read()
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to read hysteria config")
		return
	}
	validation := h.hy2ConfigManager.Validate(content)
	settings := h.hy2ConfigManager.ExtractSettings(content, h.cfg.Hy2Domain, h.cfg.Hy2Port)
	render.JSON(w, http.StatusOK, map[string]any{
		"path":           h.cfg.Hy2ConfigPath,
		"content":        content,
		"validation":     validation,
		"settings":       settings,
		"raw_only_paths": validation.RawOnlyPaths,
	})
}

func (h *Handler) ValidateHy2Config(w http.ResponseWriter, r *http.Request) {
	if h.hy2ConfigManager == nil {
		render.Error(w, http.StatusInternalServerError, "hysteria config manager is not configured")
		return
	}
	var req hy2ConfigRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		render.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	validation := h.hy2ConfigManager.Validate(req.Content)
	settings := h.hy2ConfigManager.ExtractSettings(req.Content, h.cfg.Hy2Domain, h.cfg.Hy2Port)
	render.JSON(w, http.StatusOK, map[string]any{
		"validation":     validation,
		"settings":       settings,
		"raw_only_paths": validation.RawOnlyPaths,
	})
}

func (h *Handler) SaveHy2Config(w http.ResponseWriter, r *http.Request) {
	if h.hy2ConfigManager == nil {
		render.Error(w, http.StatusInternalServerError, "hysteria config manager is not configured")
		return
	}
	var req hy2ConfigRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		render.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	validation := h.hy2ConfigManager.Validate(req.Content)
	if !validation.Valid {
		render.JSON(w, http.StatusBadRequest, map[string]any{"error": "config validation failed", "validation": validation})
		return
	}

	backupPath, err := h.hy2ConfigManager.Save(req.Content)
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to save hysteria config")
		return
	}
	h.audit(r, "hy2.config.save", "hy2_config", nil, map[string]any{"path": h.cfg.Hy2ConfigPath, "backup": backupPath})
	render.JSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"path":        h.cfg.Hy2ConfigPath,
		"backup_path": backupPath,
		"validation":  validation,
	})
}

func (h *Handler) ApplyHy2Config(w http.ResponseWriter, r *http.Request) {
	if h.hy2ConfigManager == nil {
		render.Error(w, http.StatusInternalServerError, "hysteria config manager is not configured")
		return
	}
	content, err := h.hy2ConfigManager.Read()
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to read hysteria config")
		return
	}
	validation := h.hy2ConfigManager.Validate(content)
	if !validation.Valid {
		render.JSON(w, http.StatusBadRequest, map[string]any{"error": "current hysteria config is invalid", "validation": validation})
		return
	}

	if err := h.serviceManager.Restart(r.Context(), "hysteria-server"); err != nil {
		render.Error(w, http.StatusBadRequest, "failed to restart hysteria-server: "+strings.TrimSpace(err.Error()))
		return
	}
	status, statusErr := h.serviceManager.Status(r.Context(), "hysteria-server")
	if statusErr == nil {
		_ = h.repo.UpsertServiceState(r.Context(), "hysteria-server", status.StatusText, nil, h.serviceManager.ToJSON(status))
	}
	h.audit(r, "hy2.config.apply", "service", nil, map[string]any{"service": "hysteria-server"})

	if statusErr != nil {
		render.JSON(w, http.StatusOK, map[string]any{"ok": true, "validation": validation})
		return
	}
	render.JSON(w, http.StatusOK, map[string]any{"ok": true, "validation": validation, "service": status})
}

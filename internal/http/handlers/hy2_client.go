package handlers

import (
	"net/http"

	"proxy-panel/internal/http/render"
	"proxy-panel/internal/services"
)

type hy2ClientGenerateRequest struct {
	Profile      services.Hy2ClientProfile `json:"profile"`
	ModeTemplate string                    `json:"mode_template"`
}

func (h *Handler) GenerateHy2ClientArtifacts(w http.ResponseWriter, r *http.Request) {
	if h.hy2ConfigManager == nil {
		render.Error(w, http.StatusInternalServerError, "hysteria config manager is not configured")
		return
	}

	var req hy2ClientGenerateRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		render.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	artifacts, validation := h.hy2ConfigManager.GenerateClientArtifacts(req.Profile, req.ModeTemplate)
	if !validation.Valid {
		render.JSON(w, http.StatusBadRequest, map[string]any{
			"error":      "client profile validation failed",
			"validation": validation,
		})
		return
	}

	render.JSON(w, http.StatusOK, map[string]any{
		"artifacts":  artifacts,
		"validation": validation,
	})
}
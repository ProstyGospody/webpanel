package handlers

import (
	"net/http"

	auditdomain "proxy-panel/internal/domain/audit"
	mtproxydomain "proxy-panel/internal/domain/mtproxy"
	"proxy-panel/internal/http/render"
	"proxy-panel/internal/repository"
)

type mtproxySettingsRequest struct {
	Enabled         bool    `json:"enabled"`
	PublicHost      string  `json:"public_host"`
	ListenPort      int     `json:"listen_port"`
	CanonicalSecret string  `json:"canonical_secret"`
	ShareMode       string  `json:"share_mode"`
	ProxyTag        *string `json:"proxy_tag"`
}

func (h *Handler) GetMTProxySettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.repo.GetMTProxySettings(r.Context())
	if err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "mtproxy settings not found", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to get mtproxy settings", nil)
		return
	}
	access, accessErr := h.repo.GetMTProxyAccess(r.Context())
	response := map[string]any{"settings": settings}
	if accessErr == nil {
		response["access"] = access
	}
	render.JSON(w, http.StatusOK, response)
}

func (h *Handler) ValidateMTProxySettings(w http.ResponseWriter, r *http.Request) {
	var req mtproxySettingsRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		h.renderError(w, http.StatusBadRequest, "validation", "invalid request body", nil)
		return
	}
	settings := repository.MTProxySettings{
		Enabled:         req.Enabled,
		PublicHost:      req.PublicHost,
		ListenPort:      req.ListenPort,
		CanonicalSecret: req.CanonicalSecret,
		ShareMode:       req.ShareMode,
		ProxyTag:        req.ProxyTag,
	}
	validationErrors := mtproxydomain.ValidateSettings(mtproxydomain.Settings(settings))
	if len(validationErrors) > 0 {
		h.renderError(w, http.StatusBadRequest, "validation", "mtproxy settings validation failed", validationErrors)
		return
	}
	access, err := previewMTProxyAccess(settings)
	if err != nil {
		h.renderError(w, http.StatusBadRequest, "validation", err.Error(), nil)
		return
	}
	render.JSON(w, http.StatusOK, map[string]any{"settings": settings, "access": access})
}

func (h *Handler) SaveMTProxySettings(w http.ResponseWriter, r *http.Request) {
	var req mtproxySettingsRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		h.renderError(w, http.StatusBadRequest, "validation", "invalid request body", nil)
		return
	}
	settings := repository.MTProxySettings{
		Enabled:         req.Enabled,
		PublicHost:      req.PublicHost,
		ListenPort:      req.ListenPort,
		CanonicalSecret: req.CanonicalSecret,
		ShareMode:       req.ShareMode,
		ProxyTag:        req.ProxyTag,
	}
	validationErrors := mtproxydomain.ValidateSettings(mtproxydomain.Settings(settings))
	if len(validationErrors) > 0 {
		h.renderError(w, http.StatusBadRequest, "validation", "mtproxy settings validation failed", validationErrors)
		return
	}

	previous, err := h.repo.GetMTProxySettings(r.Context())
	if err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "mtproxy settings not found", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to load current mtproxy settings", nil)
		return
	}

	saved, err := h.repo.SaveMTProxySettings(r.Context(), settings)
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to save mtproxy settings", nil)
		return
	}
	if err := h.runtimeManager.Sync(r.Context(), true); err != nil {
		details := map[string]any{}
		if _, rollbackErr := h.repo.SaveMTProxySettings(r.Context(), previous); rollbackErr != nil {
			details["rollback_error"] = rollbackErr.Error()
		}
		if len(details) == 0 {
			details = nil
		}
		h.renderError(w, http.StatusInternalServerError, "sync", "failed to apply mtproxy runtime update; settings were rolled back", details)
		return
	}

	access, err := h.repo.GetMTProxyAccess(r.Context())
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to build mtproxy access links", nil)
		return
	}
	h.audit(r, "mtproxy.settings.save", auditdomain.EntityMTProxySetting, nil, map[string]any{"public_host": saved.PublicHost, "listen_port": saved.ListenPort})
	render.JSON(w, http.StatusOK, map[string]any{"settings": saved, "access": access})
}

func (h *Handler) GetMTProxyAccess(w http.ResponseWriter, r *http.Request) {
	access, err := h.repo.GetMTProxyAccess(r.Context())
	if err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "mtproxy access is not configured", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to get mtproxy access", nil)
		return
	}
	render.JSON(w, http.StatusOK, access)
}

func (h *Handler) MTProxyAccessQR(w http.ResponseWriter, r *http.Request) {
	access, err := h.repo.GetMTProxyAccess(r.Context())
	if err != nil {
		if repository.IsNotFound(err) {
			h.renderError(w, http.StatusNotFound, "not_found", "mtproxy access is not configured", nil)
			return
		}
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to get mtproxy access", nil)
		return
	}
	if access.TelegramURL == "" {
		h.renderError(w, http.StatusBadRequest, "validation", "mtproxy access link is not available", nil)
		return
	}
	size := parseQRSize(r.URL.Query().Get("size"), 320)
	if err := renderQRCodePNG(w, access.TelegramURL, size); err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to render qr code", nil)
	}
}

func (h *Handler) MTProxyStatsOverview(w http.ResponseWriter, r *http.Request) {
	overview, err := h.repo.GetMTProxyStatsOverview(r.Context())
	if err != nil {
		h.renderError(w, http.StatusInternalServerError, "runtime", "failed to get mtproxy stats overview", nil)
		return
	}
	render.JSON(w, http.StatusOK, overview)
}

func previewMTProxyAccess(settings repository.MTProxySettings) (repository.MTProxyAccess, error) {
	access := repository.MTProxyAccess{Settings: settings}
	if settings.Enabled {
		url, err := mtproxydomain.BuildTelegramShareURL(settings.PublicHost, settings.ListenPort, settings.CanonicalSecret)
		if err != nil {
			return repository.MTProxyAccess{}, err
		}
		deepURL, err := mtproxydomain.BuildTelegramDeepLink(settings.PublicHost, settings.ListenPort, settings.CanonicalSecret)
		if err != nil {
			return repository.MTProxyAccess{}, err
		}
		access.TelegramURL = url
		access.TelegramDeepURL = deepURL
	}
	return access, nil
}

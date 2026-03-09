package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"proxy-panel/internal/http/render"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/security"
	"proxy-panel/internal/services"
)

type createHy2AccountRequest struct {
	ClientID    string  `json:"client_id"`
	AuthPayload *string `json:"auth_payload"`
	Hy2Identity *string `json:"hy2_identity"`
}

type updateHy2AccountRequest struct {
	AuthPayload *string `json:"auth_payload"`
	Hy2Identity *string `json:"hy2_identity"`
}

func (h *Handler) ListHy2Accounts(w http.ResponseWriter, r *http.Request) {
	limit, offset := h.parsePagination(r)
	items, err := h.repo.ListHy2Accounts(r.Context(), limit, offset)
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to list hysteria accounts")
		return
	}
	render.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) CreateHy2Account(w http.ResponseWriter, r *http.Request) {
	var req createHy2AccountRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		render.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.ClientID) == "" {
		render.Error(w, http.StatusBadRequest, "client_id is required")
		return
	}
	if _, err := h.repo.GetClient(r.Context(), req.ClientID); err != nil {
		render.Error(w, http.StatusBadRequest, "client not found")
		return
	}

	authPayload := ""
	if req.AuthPayload != nil {
		authPayload = strings.TrimSpace(*req.AuthPayload)
	}
	if authPayload == "" {
		random, err := security.RandomHex(16)
		if err != nil {
			render.Error(w, http.StatusInternalServerError, "failed to generate credential")
			return
		}
		authPayload = random
	}

	identity := ""
	if req.Hy2Identity != nil {
		identity = strings.TrimSpace(*req.Hy2Identity)
	}
	if identity == "" {
		identity = generateHy2Identity()
	}

	account, err := h.repo.CreateHy2Account(r.Context(), req.ClientID, authPayload, identity)
	if err != nil {
		if repository.IsUniqueViolation(err) {
			render.Error(w, http.StatusConflict, "auth payload or identity already exists")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to create hysteria account")
		return
	}
	item, err := h.repo.GetHy2Account(r.Context(), account.ID)
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to load hysteria account")
		return
	}
	uri := h.buildHy2URI(item)
	uriV2RayNG := h.buildHy2V2RayNGURI(item)
	h.audit(r, "hy2.account.create", "hy2_account", &item.ID, map[string]any{"client_id": item.ClientID, "hy2_identity": item.Hy2Identity})
	render.JSON(w, http.StatusCreated, map[string]any{"account": item, "uri": uri, "uri_v2rayng": uriV2RayNG, "singbox_outbound": h.buildHy2SingBoxOutbound(item), "client_params": h.currentHy2ClientParams()})
}

func (h *Handler) GetHy2Account(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.repo.GetHy2Account(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "hysteria account not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to get hysteria account")
		return
	}
	uri := h.buildHy2URI(item)
	uriV2RayNG := h.buildHy2V2RayNGURI(item)
	render.JSON(w, http.StatusOK, map[string]any{"account": item, "uri": uri, "uri_v2rayng": uriV2RayNG, "singbox_outbound": h.buildHy2SingBoxOutbound(item), "client_params": h.currentHy2ClientParams()})
}

func (h *Handler) UpdateHy2Account(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	current, err := h.repo.GetHy2Account(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "hysteria account not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to get hysteria account")
		return
	}

	var req updateHy2AccountRequest
	if err := render.DecodeJSON(r, &req); err != nil {
		render.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	authPayload := current.AuthPayload
	if req.AuthPayload != nil {
		authPayload = strings.TrimSpace(*req.AuthPayload)
	}
	identity := current.Hy2Identity
	if req.Hy2Identity != nil {
		identity = strings.TrimSpace(*req.Hy2Identity)
	}

	if strings.TrimSpace(authPayload) == "" {
		render.Error(w, http.StatusBadRequest, "auth_payload cannot be empty")
		return
	}
	if strings.TrimSpace(identity) == "" {
		render.Error(w, http.StatusBadRequest, "hy2_identity cannot be empty")
		return
	}

	updated, err := h.repo.UpdateHy2Account(r.Context(), id, authPayload, identity)
	if err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "hysteria account not found")
			return
		}
		if repository.IsUniqueViolation(err) {
			render.Error(w, http.StatusConflict, "auth payload or identity already exists")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to update hysteria account")
		return
	}

	uri := h.buildHy2URI(updated)
	uriV2RayNG := h.buildHy2V2RayNGURI(updated)
	h.audit(r, "hy2.account.update", "hy2_account", &id, map[string]any{"hy2_identity": updated.Hy2Identity})
	render.JSON(w, http.StatusOK, map[string]any{"account": updated, "uri": uri, "uri_v2rayng": uriV2RayNG, "singbox_outbound": h.buildHy2SingBoxOutbound(updated), "client_params": h.currentHy2ClientParams()})
}

func (h *Handler) DeleteHy2Account(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.DeleteHy2Account(r.Context(), id); err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "hysteria account not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to delete hysteria account")
		return
	}
	h.audit(r, "hy2.account.delete", "hy2_account", &id, nil)
	render.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) EnableHy2Account(w http.ResponseWriter, r *http.Request) {
	h.setHy2State(w, r, true)
}

func (h *Handler) DisableHy2Account(w http.ResponseWriter, r *http.Request) {
	h.setHy2State(w, r, false)
}

func (h *Handler) setHy2State(w http.ResponseWriter, r *http.Request, enabled bool) {
	id := chi.URLParam(r, "id")
	if err := h.repo.SetHy2AccountEnabled(r.Context(), id, enabled); err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "hysteria account not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to update hysteria account status")
		return
	}
	action := "hy2.account.disable"
	if enabled {
		action = "hy2.account.enable"
	}
	h.audit(r, action, "hy2_account", &id, map[string]any{"is_enabled": enabled})
	render.JSON(w, http.StatusOK, map[string]any{"ok": true, "is_enabled": enabled})
}

func (h *Handler) Hy2AccountURI(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.repo.GetHy2Account(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "hysteria account not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to get hysteria account")
		return
	}
	uri := h.buildHy2URI(item)
	uriV2RayNG := h.buildHy2V2RayNGURI(item)
	render.JSON(w, http.StatusOK, map[string]any{"uri": uri, "uri_v2rayng": uriV2RayNG, "singbox_outbound": h.buildHy2SingBoxOutbound(item), "client_params": h.currentHy2ClientParams()})
}

func (h *Handler) KickHy2Account(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.repo.GetHy2Account(r.Context(), id)
	if err != nil {
		if repository.IsNotFound(err) {
			render.Error(w, http.StatusNotFound, "hysteria account not found")
			return
		}
		render.Error(w, http.StatusInternalServerError, "failed to get hysteria account")
		return
	}
	if err := h.hy2Client.Kick(r.Context(), item.Hy2Identity); err != nil {
		render.Error(w, http.StatusBadGateway, "failed to kick hysteria session")
		return
	}
	h.audit(r, "hy2.account.kick", "hy2_account", &id, map[string]any{"hy2_identity": item.Hy2Identity})
	render.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) Hy2StatsOverview(w http.ResponseWriter, r *http.Request) {
	overview, err := h.repo.GetHy2StatsOverview(r.Context())
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to get hysteria stats overview")
		return
	}
	render.JSON(w, http.StatusOK, overview)
}

func (h *Handler) Hy2StatsHistory(w http.ResponseWriter, r *http.Request) {
	accountID := strings.TrimSpace(r.URL.Query().Get("account_id"))
	limit, offset := h.parsePagination(r)
	items, err := h.repo.ListHy2Snapshots(r.Context(), accountID, limit, offset)
	if err != nil {
		render.Error(w, http.StatusInternalServerError, "failed to list hysteria stats")
		return
	}
	render.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) InternalHy2Auth(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(chi.URLParam(r, "token"))
	if token == "" {
		token = parseInternalAuth(r)
	}
	if token == "" || token != h.cfg.InternalAuthToken {
		render.JSON(w, http.StatusUnauthorized, map[string]any{"ok": false, "reason": "unauthorized"})
		return
	}

	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		render.JSON(w, http.StatusBadRequest, map[string]any{"ok": false, "reason": "invalid_json"})
		return
	}
	authPayload := extractHy2AuthPayload(payload)
	if authPayload == "" {
		render.JSON(w, http.StatusOK, map[string]any{"ok": false, "reason": "missing_auth_payload"})
		return
	}

	account, err := h.repo.GetHy2AccountByAuthPayload(r.Context(), authPayload)
	if err != nil {
		render.JSON(w, http.StatusOK, map[string]any{"ok": false, "reason": "unknown_account"})
		return
	}
	if !account.IsEnabled || !account.ClientActive {
		render.JSON(w, http.StatusOK, map[string]any{"ok": false, "reason": "account_disabled"})
		return
	}

	now := time.Now().UTC()
	_ = h.repo.TouchHy2AccountLastSeen(r.Context(), account.ID, now)
	render.JSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"id": account.Hy2Identity,
	})
}

func (h *Handler) currentHy2ClientParams() services.Hy2ClientParams {
	return h.resolveHy2ClientParams()
}

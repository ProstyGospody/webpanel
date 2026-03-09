package httpserver

import (
	"log/slog"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"

	"proxy-panel/internal/config"
	"proxy-panel/internal/http/handlers"
	"proxy-panel/internal/http/middleware"
	"proxy-panel/internal/repository"
)

func NewRouter(
	cfg config.Config,
	logger *slog.Logger,
	repo *repository.Repository,
	h *handlers.Handler,
) *chi.Mux {
	r := chi.NewRouter()
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.SecurityHeaders)
	r.Use(middleware.RequestLogger(logger))

	r.Get("/healthz", h.Healthz)
	r.Get("/readyz", h.Readyz)
	r.Post("/internal/hy2/auth", h.InternalHy2Auth)
	r.Post("/internal/hy2/auth/{token}", h.InternalHy2Auth)

	r.Route("/api", func(api chi.Router) {
		api.Route("/auth", func(auth chi.Router) {
			auth.Post("/login", h.Login)
			auth.With(
				middleware.RequireAuth(cfg, repo, logger),
				middleware.RequireCSRF(cfg),
			).Post("/logout", h.Logout)
			auth.With(
				middleware.RequireAuth(cfg, repo, logger),
				middleware.RequireCSRF(cfg),
			).Get("/me", h.Me)
		})

		api.Group(func(secured chi.Router) {
			secured.Use(middleware.RequireAuth(cfg, repo, logger))
			secured.Use(middleware.RequireCSRF(cfg))

			secured.Get("/clients", h.ListClients)
			secured.Post("/clients", h.CreateClient)
			secured.Get("/clients/{id}", h.GetClient)
			secured.Patch("/clients/{id}", h.UpdateClient)
			secured.Post("/clients/{id}/enable", h.EnableClient)
			secured.Post("/clients/{id}/disable", h.DisableClient)

			secured.Get("/hy2/accounts", h.ListHy2Accounts)
			secured.Post("/hy2/accounts", h.CreateHy2Account)
			secured.Get("/hy2/accounts/{id}", h.GetHy2Account)
			secured.Patch("/hy2/accounts/{id}", h.UpdateHy2Account)
			secured.Delete("/hy2/accounts/{id}", h.DeleteHy2Account)
			secured.Post("/hy2/accounts/{id}/enable", h.EnableHy2Account)
			secured.Post("/hy2/accounts/{id}/disable", h.DisableHy2Account)
			secured.Get("/hy2/accounts/{id}/uri", h.Hy2AccountURI)
			secured.Post("/hy2/accounts/{id}/kick", h.KickHy2Account)
			secured.Get("/hy2/stats/overview", h.Hy2StatsOverview)
			secured.Get("/hy2/stats/history", h.Hy2StatsHistory)
			secured.Get("/hy2/config", h.GetHy2Config)
			secured.Post("/hy2/config/validate", h.ValidateHy2Config)
			secured.Put("/hy2/config", h.SaveHy2Config)
			secured.Post("/hy2/config/apply", h.ApplyHy2Config)

			secured.Get("/mtproxy/secrets", h.ListMTProxySecrets)
			secured.Post("/mtproxy/secrets", h.CreateMTProxySecret)
			secured.Get("/mtproxy/secrets/{id}", h.GetMTProxySecret)
			secured.Patch("/mtproxy/secrets/{id}", h.UpdateMTProxySecret)
			secured.Delete("/mtproxy/secrets/{id}", h.DeleteMTProxySecret)
			secured.Post("/mtproxy/secrets/{id}/enable", h.EnableMTProxySecret)
			secured.Post("/mtproxy/secrets/{id}/disable", h.DisableMTProxySecret)
			secured.Get("/mtproxy/stats/overview", h.MTProxyStatsOverview)

			secured.Get("/services", h.ListServices)
			secured.Get("/services/{name}", h.GetService)
			secured.Post("/services/{name}/restart", h.RestartService)
			secured.Post("/services/{name}/reload", h.ReloadService)

			secured.Get("/system/metrics", h.GetSystemMetrics)

			secured.Get("/audit", h.ListAudit)
		})
	})

	return r
}


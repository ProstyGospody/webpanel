package app

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"proxy-panel/internal/config"
	httpserver "proxy-panel/internal/http"
	"proxy-panel/internal/http/handlers"
	"proxy-panel/internal/http/middleware"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/scheduler"
	"proxy-panel/internal/services"
)

type Server struct {
	cfg            config.Config
	logger         *slog.Logger
	repo           *repository.Repository
	httpServer     *http.Server
	jobs           *scheduler.Jobs
	hysteriaAccess *services.HysteriaAccessManager
	cancelJobs     context.CancelFunc
}

func NewServer(cfg config.Config, logger *slog.Logger, repo *repository.Repository) *Server {
	rateLimiter := middleware.NewLoginRateLimiter(cfg.RateLimitWindow, cfg.RateLimitBurst)
	hy2Client := services.NewHysteriaClient(cfg.Hy2StatsURL, cfg.Hy2StatsSecret)
	serviceManager := services.NewServiceManager(cfg.SystemctlPath, cfg.SudoPath, cfg.JournalctlPath, cfg.ManagedServices)
	hy2ConfigManager := services.NewHysteriaConfigManager(cfg.Hy2ConfigPath)
	hysteriaAccess := services.NewHysteriaAccessManager(repo, cfg, hy2ConfigManager)
	systemMetrics := services.NewSystemMetricsCollector()

	var prometheusClient *services.PrometheusClient
	if cfg.PrometheusEnabled {
		prometheusClient = services.NewPrometheusClient(cfg.PrometheusURL, cfg.PrometheusQueryTTL)
	}

	h := handlers.New(cfg, logger, repo, rateLimiter, hy2Client, serviceManager, hy2ConfigManager, hysteriaAccess, prometheusClient, systemMetrics)
	router := httpserver.NewRouter(cfg, logger, repo, h)

	httpSrv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	jobs := scheduler.NewJobs(logger, cfg, repo, hy2Client, serviceManager)
	return &Server{cfg: cfg, logger: logger, repo: repo, httpServer: httpSrv, jobs: jobs, hysteriaAccess: hysteriaAccess}
}

func (s *Server) Run(ctx context.Context) error {
	if _, err := s.hysteriaAccess.Sync(ctx); err != nil {
		s.logger.Warn("failed to sync hysteria config on startup", "error", err)
	}
	jobsCtx, cancel := context.WithCancel(ctx)
	s.cancelJobs = cancel
	s.jobs.Start(jobsCtx)

	s.logger.Info("starting panel api", "listen_addr", s.cfg.ListenAddr)
	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("listen and serve: %w", err)
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	if s.cancelJobs != nil {
		s.cancelJobs()
	}
	err := s.httpServer.Shutdown(ctx)
	_ = s.repo.Close()
	return err
}

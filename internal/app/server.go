package app

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"proxy-panel/internal/config"
	"proxy-panel/internal/http/handlers"
	httpserver "proxy-panel/internal/http"
	"proxy-panel/internal/http/middleware"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/scheduler"
	"proxy-panel/internal/services"
)

type Server struct {
	cfg            config.Config
	logger         *slog.Logger
	pool           *pgxpool.Pool
	repo           *repository.Repository
	httpServer     *http.Server
	jobs           *scheduler.Jobs
	runtimeManager *services.MTProxyRuntimeManager
	cancelJobs     context.CancelFunc
}

func NewServer(cfg config.Config, logger *slog.Logger, pool *pgxpool.Pool, repo *repository.Repository) *Server {
	rateLimiter := middleware.NewLoginRateLimiter(cfg.RateLimitWindow, cfg.RateLimitBurst)
	hy2Client := services.NewHysteriaClient(cfg.Hy2StatsURL, cfg.Hy2StatsSecret)
	mtProxyClient := services.NewMTProxyClient(cfg.MTProxyStatsURL, cfg.MTProxyStatsToken)
	serviceManager := services.NewServiceManager(cfg.SystemctlPath, cfg.SudoPath, cfg.JournalctlPath, cfg.ManagedServices)
	runtimeManager := services.NewMTProxyRuntimeManager(repo, cfg.MTProxySecretsPath, "mtproxy", serviceManager)

	h := handlers.New(cfg, logger, repo, rateLimiter, hy2Client, mtProxyClient, serviceManager, runtimeManager)
	router := httpserver.NewRouter(cfg, logger, repo, h)

	httpSrv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	jobs := scheduler.NewJobs(logger, cfg, repo, hy2Client, mtProxyClient, serviceManager, runtimeManager)

	return &Server{
		cfg:            cfg,
		logger:         logger,
		pool:           pool,
		repo:           repo,
		httpServer:     httpSrv,
		jobs:           jobs,
		runtimeManager: runtimeManager,
	}
}

func (s *Server) Run(ctx context.Context) error {
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
	s.pool.Close()
	return err
}

func (s *Server) SyncMTProxy(ctx context.Context, force bool) error {
	return s.runtimeManager.Sync(ctx, force)
}



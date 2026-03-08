package scheduler

import (
	"context"
	"log/slog"
	"time"

	"proxy-panel/internal/config"
	"proxy-panel/internal/repository"
	"proxy-panel/internal/services"
)

type Jobs struct {
	logger         *slog.Logger
	cfg            config.Config
	repo           *repository.Repository
	hy2Client      *services.HysteriaClient
	mtProxyClient  *services.MTProxyClient
	serviceManager *services.ServiceManager
	runtimeManager *services.MTProxyRuntimeManager
}

func NewJobs(
	logger *slog.Logger,
	cfg config.Config,
	repo *repository.Repository,
	hy2Client *services.HysteriaClient,
	mtProxyClient *services.MTProxyClient,
	serviceManager *services.ServiceManager,
	runtimeManager *services.MTProxyRuntimeManager,
) *Jobs {
	return &Jobs{
		logger:         logger,
		cfg:            cfg,
		repo:           repo,
		hy2Client:      hy2Client,
		mtProxyClient:  mtProxyClient,
		serviceManager: serviceManager,
		runtimeManager: runtimeManager,
	}
}

func (j *Jobs) Start(ctx context.Context) {
	go j.runTicker(ctx, "hy2-poll", j.cfg.Hy2PollInterval, j.pollHy2)
	go j.runTicker(ctx, "mtproxy-poll", j.cfg.MTProxyPollInterval, j.pollMTProxy)
	go j.runTicker(ctx, "services-poll", j.cfg.ServicePollInterval, j.pollServices)
	go j.runTicker(ctx, "mtproxy-sync", 1*time.Minute, j.syncMTProxyRuntime)
}

func (j *Jobs) runTicker(ctx context.Context, name string, interval time.Duration, fn func(context.Context) error) {
	if interval <= 0 {
		interval = 1 * time.Minute
	}
	if err := fn(ctx); err != nil {
		j.logger.Warn("scheduler initial run failed", "job", name, "error", err)
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := fn(ctx); err != nil {
				j.logger.Warn("scheduler job failed", "job", name, "error", err)
			}
		}
	}
}

func (j *Jobs) pollHy2(ctx context.Context) error {
	traffic, err := j.hy2Client.FetchTraffic(ctx)
	if err != nil {
		return err
	}
	online, err := j.hy2Client.FetchOnline(ctx)
	if err != nil {
		return err
	}

	accounts, err := j.repo.ListHy2Accounts(ctx, 10000, 0)
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	snapshots := make([]repository.Hy2Snapshot, 0, len(accounts))
	for _, account := range accounts {
		stat := traffic[account.Hy2Identity]
		onlineCount := online[account.Hy2Identity]
		snapshots = append(snapshots, repository.Hy2Snapshot{
			Hy2AccountID: account.ID,
			TxBytes:      stat.TxBytes,
			RxBytes:      stat.RxBytes,
			OnlineCount:  onlineCount,
			SnapshotAt:   now,
		})
		if onlineCount > 0 {
			if err := j.repo.TouchHy2AccountLastSeen(ctx, account.ID, now); err != nil {
				j.logger.Debug("failed to update hy2 last seen", "account_id", account.ID, "error", err)
			}
		}
	}
	if err := j.repo.InsertHy2Snapshots(ctx, snapshots); err != nil {
		return err
	}
	return nil
}

func (j *Jobs) pollMTProxy(ctx context.Context) error {
	stats, err := j.mtProxyClient.FetchStats(ctx)
	if err != nil {
		return err
	}

	return j.repo.InsertMTProxySnapshot(ctx, repository.MTProxySnapshot{
		ConnectionsTotal: stats.ConnectionsTotal,
		UsersTotal:       stats.UsersTotal,
		RawStatsJSON:     stats.RawJSON,
		SnapshotAt:       time.Now().UTC(),
	})
}

func (j *Jobs) pollServices(ctx context.Context) error {
	for service := range j.serviceManager.ManagedServices {
		details, err := j.serviceManager.Status(ctx, service)
		if err != nil {
			j.logger.Warn("service status failed", "service", service, "error", err)
			_ = j.repo.UpsertServiceState(ctx, service, "failed", nil, `{"error":"status failed"}`)
			continue
		}
		version := ""
		switch service {
		case "hysteria-server":
			version, _ = services.DetectBinaryVersion(ctx, j.cfg.Hy2BinaryPath, "version")
		case "mtproxy":
			version, _ = services.DetectBinaryVersion(ctx, j.cfg.MTProxyBinaryPath, "--version")
		case "proxy-panel-api":
			version = "managed-by-systemd"
		case "proxy-panel-web":
			version = "managed-by-systemd"
		}
		var versionPtr *string
		if version != "" {
			versionPtr = &version
		}
		if err := j.repo.UpsertServiceState(ctx, service, details.StatusText, versionPtr, j.serviceManager.ToJSON(details)); err != nil {
			j.logger.Warn("upsert service state failed", "service", service, "error", err)
		}
	}
	return nil
}

func (j *Jobs) syncMTProxyRuntime(ctx context.Context) error {
	return j.runtimeManager.Sync(ctx, false)
}


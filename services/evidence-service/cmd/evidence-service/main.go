package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/codeg/securewatch/services/evidence-service/internal/config"
	apphttp "github.com/codeg/securewatch/services/evidence-service/internal/http"
	"github.com/codeg/securewatch/services/evidence-service/internal/storage"
)

func main() {
	cfg := config.Load()

	// ── Logger ────────────────────────────────────────────────────────────────
	level := slog.LevelInfo
	if cfg.LogLevel == "debug" {
		level = slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})))

	slog.Info("starting evidence-service", "port", cfg.Port, "env", cfg.AppEnv)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// ── Database ──────────────────────────────────────────────────────────────
	db, err := storage.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	slog.Info("database connected")

	// ── MinIO ─────────────────────────────────────────────────────────────────
	minioStore, err := storage.NewMinIOStore(
		context.Background(),
		cfg.MinIOEndpoint,
		cfg.MinIOPublicEndpoint,
		cfg.MinIOAccessKey,
		cfg.MinIOSecretKey,
		cfg.MinIOBucket,
		cfg.MinIOUseSSL,
	)
	if err != nil {
		slog.Error("failed to connect to MinIO", "error", err)
		os.Exit(1)
	}
	slog.Info("minio connected", "bucket", cfg.MinIOBucket)

	// ── Repositories ──────────────────────────────────────────────────────────
	evidenceRepo := storage.NewEvidenceRepository(db)
	findingsRepo := storage.NewFindingsRepository(db)
	reportsRepo  := storage.NewReportsRepository(db)

	// ── HTTP server ───────────────────────────────────────────────────────────
	router := apphttp.NewRouter(evidenceRepo, findingsRepo, reportsRepo, minioStore)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  60 * time.Second, // generous for large uploads
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		slog.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down")
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutCancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		slog.Error("shutdown error", "error", err)
	}
}

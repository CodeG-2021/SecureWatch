package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/codeg/securewatch/services/task-orchestrator/internal/config"
	"github.com/codeg/securewatch/services/task-orchestrator/internal/messaging"
	"github.com/codeg/securewatch/services/task-orchestrator/internal/orchestrator"
	"github.com/codeg/securewatch/services/task-orchestrator/internal/storage"
)

func main() {
	cfg := config.Load()

	// ── Logger ────────────────────────────────────────────────────────────────
	level := slog.LevelInfo
	if cfg.LogLevel == "debug" {
		level = slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})))

	slog.Info("starting task-orchestrator", "env", cfg.AppEnv, "poll_interval", cfg.PollInterval)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)

	// ── Database ──────────────────────────────────────────────────────────────
	db, err := storage.Open(ctx, cfg.DatabaseURL)
	cancel()
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	slog.Info("database connected")

	// ── RabbitMQ ──────────────────────────────────────────────────────────────
	publisher, err := messaging.NewPublisher(cfg.RabbitMQURL)
	if err != nil {
		slog.Error("failed to connect to rabbitmq", "error", err)
		os.Exit(1)
	}
	defer publisher.Close()
	slog.Info("rabbitmq connected")

	// ── Orchestrator ──────────────────────────────────────────────────────────
	taskRepo := storage.NewTaskRepository(db)
	orc      := orchestrator.New(taskRepo, publisher, cfg.PollInterval)

	runCtx, runCancel := context.WithCancel(context.Background())

	go orc.Run(runCtx)

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down gracefully")
	runCancel()
	time.Sleep(500 * time.Millisecond) // allow last tick to finish
}

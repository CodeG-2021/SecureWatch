package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all runtime configuration for the task orchestrator.
type Config struct {
	AppEnv      string
	LogLevel    string
	DatabaseURL string

	// RabbitMQ
	RabbitMQURL string

	// Polling interval for new evidences (HU-14)
	PollInterval time.Duration
}

func Load() Config {
	return Config{
		AppEnv:       getEnv("APP_ENV", "local"),
		LogLevel:     strings.ToLower(getEnv("LOG_LEVEL", "info")),
		DatabaseURL:  getEnv("DATABASE_URL", ""),
		RabbitMQURL:  getEnv("RABBITMQ_URL", "amqp://securewatch:securewatch@rabbitmq:5672/"),
		PollInterval: getDuration("POLL_INTERVAL_SECONDS", 5) * time.Second,
	}
}

func getEnv(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}

func getDuration(key string, fallback int) time.Duration {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return time.Duration(fallback)
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return time.Duration(fallback)
	}
	return time.Duration(n)
}

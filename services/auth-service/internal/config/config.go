package config

import (
	"os"
	"strings"
)

type Config struct {
	AppEnv      string
	Port        string
	LogLevel    string
	DatabaseURL string
}

func Load() Config {
	return Config{
		AppEnv:      getEnv("APP_ENV", "local"),
		Port:        getEnv("AUTH_SERVICE_PORT", "8081"),
		LogLevel:    strings.ToLower(getEnv("LOG_LEVEL", "info")),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://securewatch:securewatch@postgres:5432/securewatch?sslmode=disable"),
	}
}

func getEnv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

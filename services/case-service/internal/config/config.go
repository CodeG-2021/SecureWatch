package config

import (
	"os"
	"strings"
)

// Config holds all runtime configuration for the case service.
type Config struct {
	AppEnv      string
	Port        string
	LogLevel    string
	DatabaseURL string
}

// Load reads configuration from environment variables.
func Load() Config {
	return Config{
		AppEnv:      getEnv("APP_ENV", "local"),
		Port:        getEnv("CASE_SERVICE_PORT", "8082"),
		LogLevel:    strings.ToLower(getEnv("LOG_LEVEL", "info")),
		DatabaseURL: getEnv("DATABASE_URL", ""),
	}
}

func getEnv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

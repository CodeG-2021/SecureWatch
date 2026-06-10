package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds all runtime configuration for the evidence service.
type Config struct {
	AppEnv      string
	Port        string
	LogLevel    string
	DatabaseURL string

	// MinIO / S3
	MinIOEndpoint       string
	MinIOPublicEndpoint string // externally reachable endpoint for presigned URLs
	MinIOAccessKey      string
	MinIOSecretKey      string
	MinIOBucket         string
	MinIOUseSSL         bool
}

// Load reads configuration from environment variables.
func Load() Config {
	return Config{
		AppEnv:      getEnv("APP_ENV", "local"),
		Port:        getEnv("EVIDENCE_SERVICE_PORT", "8083"),
		LogLevel:    strings.ToLower(getEnv("LOG_LEVEL", "info")),
		DatabaseURL: getEnv("DATABASE_URL", ""),

		MinIOEndpoint:       getEnv("MINIO_ENDPOINT", "minio:9000"),
		MinIOPublicEndpoint: getEnv("MINIO_PUBLIC_ENDPOINT", "localhost:9000"),
		MinIOAccessKey:      getEnv("MINIO_ACCESS_KEY", ""),
		MinIOSecretKey:      getEnv("MINIO_SECRET_KEY", ""),
		MinIOBucket:         getEnv("MINIO_BUCKET_EVIDENCE", "securewatch-evidence"),
		MinIOUseSSL:         getBool("MINIO_USE_SSL", false),
	}
}

func getEnv(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}

func getBool(key string, fallback bool) bool {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

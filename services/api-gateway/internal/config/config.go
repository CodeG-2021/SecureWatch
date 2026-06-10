package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	AppEnv             string
	AppName            string
	Port               string
	LogLevel           string
	JWTSecret          string
	AuthServiceURL     string
	CaseServiceURL     string
	EvidenceServiceURL string
	CORSAllowedOrigins []string
	CORSAllowedMethods []string
	CORSAllowedHeaders []string
	RequireAuth        bool
}

func Load() Config {
	return Config{
		AppEnv:             getEnv("APP_ENV", "local"),
		AppName:            getEnv("APP_NAME", "securewatch"),
		Port:               getEnv("API_GATEWAY_PORT", "8080"),
		LogLevel:           strings.ToLower(getEnv("LOG_LEVEL", "info")),
		JWTSecret:          getEnv("JWT_SECRET", "change-me-in-local-env"),
		AuthServiceURL:     getEnv("AUTH_SERVICE_URL", "http://auth-service:8081"),
		CaseServiceURL:     getEnv("CASE_SERVICE_URL", "http://case-service:8082"),
		EvidenceServiceURL: getEnv("EVIDENCE_SERVICE_URL", "http://evidence-service:8083"),
		CORSAllowedOrigins: splitCSV(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")),
		CORSAllowedMethods: splitCSV(getEnv("CORS_ALLOWED_METHODS", "GET,POST,PUT,PATCH,DELETE,OPTIONS")),
		CORSAllowedHeaders: splitCSV(getEnv("CORS_ALLOWED_HEADERS", "Authorization,Content-Type,X-Request-ID")),
		RequireAuth:        getBool("API_GATEWAY_REQUIRE_AUTH", true),
	}
}

func getEnv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func getBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

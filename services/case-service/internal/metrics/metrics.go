// Package metrics exposes a minimal Prometheus-text-format /metrics endpoint (HU-30).
// Uses only the Go standard library — no external dependencies required.
package metrics

import (
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"sync"
	"time"
)

var (
	reUUID = regexp.MustCompile(`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)

	mu        sync.Mutex
	requests  = make(map[string]int64)
	startTime = time.Now()
	service   = "unknown"
)

// Init sets the service name label used in all metrics.
func Init(name string) { service = name }

// Record increments the request counter for the given method/path/status tuple.
func Record(method, path string, status int) {
	key := method + "|" + normPath(path) + "|" + strconv.Itoa(status)
	mu.Lock()
	requests[key]++
	mu.Unlock()
}

// Handler returns an HTTP handler that writes metrics in Prometheus text format.
func Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		snap := make(map[string]int64, len(requests))
		for k, v := range requests {
			snap[k] = v
		}
		mu.Unlock()

		keys := make([]string, 0, len(snap))
		for k := range snap {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		uptime := time.Since(startTime).Seconds()
		svc := service

		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

		fmt.Fprintf(w, "# HELP securewatch_up Service health (1 = healthy)\n")
		fmt.Fprintf(w, "# TYPE securewatch_up gauge\n")
		fmt.Fprintf(w, "securewatch_up{service=%q} 1\n\n", svc)

		fmt.Fprintf(w, "# HELP securewatch_uptime_seconds Seconds since process start\n")
		fmt.Fprintf(w, "# TYPE securewatch_uptime_seconds counter\n")
		fmt.Fprintf(w, "securewatch_uptime_seconds{service=%q} %.2f\n\n", svc, uptime)

		fmt.Fprintf(w, "# HELP http_requests_total Total HTTP requests handled\n")
		fmt.Fprintf(w, "# TYPE http_requests_total counter\n")
		for _, k := range keys {
			parts := splitKey(k)
			if len(parts) == 3 {
				fmt.Fprintf(w, "http_requests_total{service=%q,method=%q,path=%q,status=%q} %d\n",
					svc, parts[0], parts[1], parts[2], snap[k])
			}
		}
	}
}

// Middleware wraps a handler and records request metrics.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &recorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		Record(r.Method, r.URL.Path, rec.status)
	})
}

// ─── internal helpers ─────────────────────────────────────────────────────────

func normPath(p string) string {
	return reUUID.ReplaceAllString(p, "{id}")
}

func splitKey(k string) []string {
	result := make([]string, 0, 3)
	start := 0
	count := 0
	for i := 0; i < len(k) && count < 2; i++ {
		if k[i] == '|' {
			result = append(result, k[start:i])
			start = i + 1
			count++
		}
	}
	result = append(result, k[start:])
	return result
}

type recorder struct {
	http.ResponseWriter
	status int
}

func (r *recorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *recorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

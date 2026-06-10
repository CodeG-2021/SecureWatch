package http

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DashboardMetrics aggregates platform-wide stats for the dashboard (HU-24).
type DashboardMetrics struct {
	Cases     CaseMetrics     `json:"cases"`
	Evidences EvidenceMetrics `json:"evidences"`
	Findings  FindingMetrics  `json:"findings"`
	Tasks     TaskMetrics     `json:"tasks"`
}

type CaseMetrics struct {
	Total      int `json:"total"`
	Open       int `json:"open"`
	InProgress int `json:"in_progress"`
	Closed     int `json:"closed"`
	Archived   int `json:"archived"`
	Critical   int `json:"critical"`
}

type EvidenceMetrics struct {
	Total      int `json:"total"`
	Completed  int `json:"completed"`
	Processing int `json:"processing"`
	Failed     int `json:"failed"`
	Queued     int `json:"queued"`
}

type FindingMetrics struct {
	Total    int `json:"total"`
	Critical int `json:"critical"`
	High     int `json:"high"`
	Medium   int `json:"medium"`
	Low      int `json:"low"`
}

type TaskMetrics struct {
	Total      int `json:"total"`
	Completed  int `json:"completed"`
	Failed     int `json:"failed"`
	Processing int `json:"processing"`
	Pending    int `json:"pending"`
}

func dashboardMetricsHandler(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var m DashboardMetrics

		// Cases
		row := db.QueryRow(context.Background(), `
			SELECT
				COUNT(*),
				COUNT(*) FILTER (WHERE status = 'open'),
				COUNT(*) FILTER (WHERE status = 'in_progress'),
				COUNT(*) FILTER (WHERE status = 'closed'),
				COUNT(*) FILTER (WHERE status = 'archived'),
				COUNT(*) FILTER (WHERE priority = 'critical' AND status NOT IN ('closed','archived'))
			FROM cases
		`)
		if err := row.Scan(
			&m.Cases.Total, &m.Cases.Open, &m.Cases.InProgress,
			&m.Cases.Closed, &m.Cases.Archived, &m.Cases.Critical,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to query case metrics.")
			return
		}

		// Evidences
		row = db.QueryRow(context.Background(), `
			SELECT
				COUNT(*),
				COUNT(*) FILTER (WHERE status = 'completed'),
				COUNT(*) FILTER (WHERE status IN ('processing','queued')),
				COUNT(*) FILTER (WHERE status = 'failed'),
				COUNT(*) FILTER (WHERE status = 'queued')
			FROM evidences
		`)
		if err := row.Scan(
			&m.Evidences.Total, &m.Evidences.Completed,
			&m.Evidences.Processing, &m.Evidences.Failed, &m.Evidences.Queued,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to query evidence metrics.")
			return
		}

		// Findings
		row = db.QueryRow(context.Background(), `
			SELECT
				COUNT(*),
				COUNT(*) FILTER (WHERE severity = 'critical'),
				COUNT(*) FILTER (WHERE severity = 'high'),
				COUNT(*) FILTER (WHERE severity = 'medium'),
				COUNT(*) FILTER (WHERE severity = 'low')
			FROM findings
		`)
		if err := row.Scan(
			&m.Findings.Total, &m.Findings.Critical,
			&m.Findings.High, &m.Findings.Medium, &m.Findings.Low,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to query finding metrics.")
			return
		}

		// Tasks
		row = db.QueryRow(context.Background(), `
			SELECT
				COUNT(*),
				COUNT(*) FILTER (WHERE status = 'completed'),
				COUNT(*) FILTER (WHERE status IN ('failed','dead_letter')),
				COUNT(*) FILTER (WHERE status = 'processing'),
				COUNT(*) FILTER (WHERE status IN ('pending','queued'))
			FROM tasks
		`)
		if err := row.Scan(
			&m.Tasks.Total, &m.Tasks.Completed,
			&m.Tasks.Failed, &m.Tasks.Processing, &m.Tasks.Pending,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error", "Failed to query task metrics.")
			return
		}

		writeJSON(w, http.StatusOK, m)
	}
}

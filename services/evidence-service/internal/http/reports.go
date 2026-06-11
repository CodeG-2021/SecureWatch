package http

import (
	"bytes"
	"fmt"
	"html/template"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/codeg/securewatch/services/evidence-service/internal/audit"
	"github.com/codeg/securewatch/services/evidence-service/internal/domain"
	"github.com/codeg/securewatch/services/evidence-service/internal/storage"
)

// handleGenerateReport creates a new HTML report for a case and stores it in MinIO (HU-22).
func handleGenerateReport(w http.ResponseWriter, r *http.Request, reports *storage.ReportsRepository, minio *storage.MinIOStore, db *pgxpool.Pool) {
	caseID := r.PathValue("caseId")
	actor := actorFromRequest(r)

	data, err := reports.GetCaseReportData(r.Context(), caseID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to load case data"})
		return
	}

	htmlBytes, err := renderReportHTML(data)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to render report"})
		return
	}

	storagePath := fmt.Sprintf("reports/%s/report-%s.html", caseID, time.Now().UTC().Format("20060102-150405"))

	if err := minio.PutObject(r.Context(), storagePath, "text/html; charset=utf-8",
		strings.NewReader(string(htmlBytes)), int64(len(htmlBytes))); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to store report"})
		return
	}

	var critical, high, medium, low int
	for _, f := range data.Findings {
		switch f.Severity {
		case "critical":
			critical++
		case "high":
			high++
		case "medium":
			medium++
		default:
			low++
		}
	}

	summary := domain.ReportSummary{
		CaseTitle:      data.CaseTitle,
		Priority:       data.Priority,
		Status:         data.Status,
		RiskScore:      data.RiskScore,
		EvidencesCount: len(data.Evidences),
		FindingsCount:  len(data.Findings),
		Critical:       critical,
		High:           high,
		Medium:         medium,
		Low:            low,
	}

	rep, err := reports.Create(r.Context(), caseID, actor.ID, storagePath, int64(len(htmlBytes)), summary)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save report record"})
		return
	}

	url, err := minio.PresignedGetURL(r.Context(), rep.StoragePath, 24*time.Hour)
	if err == nil {
		rep.DownloadURL = url
	}

	audit.Write(db, audit.Event{
		ActorID: actor.ID, ActorEmail: actor.Email,
		Action: "report.generated", ResourceType: "report", ResourceID: rep.ID,
		Metadata:  map[string]any{"case_id": caseID, "findings": len(data.Findings)},
		IPAddress: r.RemoteAddr,
	})
	writeJSON(w, http.StatusCreated, map[string]any{"report": rep})
}

// handleGetReport returns the latest report metadata with a presigned download URL (HU-23).
func handleGetReport(w http.ResponseWriter, r *http.Request, reports *storage.ReportsRepository, minio *storage.MinIOStore, db *pgxpool.Pool) {
	caseID := r.PathValue("caseId")

	rep, err := reports.FindLatestByCaseID(r.Context(), caseID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to find report"})
		return
	}
	if rep == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no report generated yet"})
		return
	}

	url, err := minio.PresignedGetURL(r.Context(), rep.StoragePath, 24*time.Hour)
	if err == nil {
		rep.DownloadURL = url
	}

	actor := actorFromRequest(r)
	audit.Write(db, audit.Event{
		ActorID: actor.ID, ActorEmail: actor.Email,
		Action: "report.downloaded", ResourceType: "report", ResourceID: rep.ID,
		Metadata:  map[string]any{"case_id": r.PathValue("caseId")},
		IPAddress: r.RemoteAddr,
	})
	writeJSON(w, http.StatusOK, map[string]any{"report": rep})
}

// ─── HTML report template ─────────────────────────────────────────────────────

type reportTemplateData struct {
	*domain.CaseReportData
	GeneratedAt  time.Time
	Critical     int
	High         int
	Medium       int
	Low          int
}

var reportTmpl = template.Must(template.New("report").Funcs(template.FuncMap{
	"upper": strings.ToUpper,
	"severityColor": func(s string) string {
		switch s {
		case "critical":
			return "#dc2626"
		case "high":
			return "#ea580c"
		case "medium":
			return "#d97706"
		default:
			return "#2563eb"
		}
	},
	"severityBg": func(s string) string {
		switch s {
		case "critical":
			return "#fef2f2"
		case "high":
			return "#fff7ed"
		case "medium":
			return "#fffbeb"
		default:
			return "#eff6ff"
		}
	},
	"priorityColor": func(p string) string {
		switch p {
		case "critical":
			return "#dc2626"
		case "high":
			return "#ea580c"
		case "medium":
			return "#d97706"
		default:
			return "#2563eb"
		}
	},
	"riskLabel": func(score float64) string {
		switch {
		case score >= 75:
			return "High Risk"
		case score >= 50:
			return "Medium Risk"
		case score >= 25:
			return "Low Risk"
		default:
			return "Minimal Risk"
		}
	},
	"riskColor": func(score float64) string {
		switch {
		case score >= 75:
			return "#dc2626"
		case score >= 50:
			return "#ea580c"
		case score >= 25:
			return "#d97706"
		default:
			return "#2563eb"
		}
	},
	"formatDate": func(t time.Time) string {
		return t.UTC().Format("January 2, 2006 at 15:04 UTC")
	},
	"formatShort": func(t time.Time) string {
		return t.UTC().Format("Jan 2, 2006")
	},
	"humanSize": func(b int64) string {
		switch {
		case b >= 1024*1024:
			return fmt.Sprintf("%.1f MB", float64(b)/1024/1024)
		case b >= 1024:
			return fmt.Sprintf("%.1f KB", float64(b)/1024)
		default:
			return fmt.Sprintf("%d B", b)
		}
	},
	"round": func(f float64) int { return int(f + 0.5) },
}).Parse(reportHTMLTemplate))

func renderReportHTML(data *domain.CaseReportData) ([]byte, error) {
	var critical, high, medium, low int
	for _, f := range data.Findings {
		switch f.Severity {
		case "critical":
			critical++
		case "high":
			high++
		case "medium":
			medium++
		default:
			low++
		}
	}
	td := reportTemplateData{
		CaseReportData: data,
		GeneratedAt:    time.Now().UTC(),
		Critical:       critical,
		High:           high,
		Medium:         medium,
		Low:            low,
	}
	var buf bytes.Buffer
	if err := reportTmpl.Execute(&buf, td); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

const reportHTMLTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SecureWatch Report — {{.CaseTitle}}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;font-size:14px;line-height:1.6}
.page{max-width:900px;margin:0 auto;background:#fff;min-height:100vh;box-shadow:0 0 40px rgba(0,0,0,.08)}
.hdr{background:#0d1628;color:#fff;padding:28px 40px;display:flex;align-items:center;justify-content:space-between}
.hdr-brand{display:flex;align-items:center;gap:12px}
.hdr-logo{width:40px;height:40px;background:linear-gradient(135deg,#3b82f6,#06b6d4);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#fff;flex-shrink:0}
.hdr-title{font-size:20px;font-weight:800;letter-spacing:-.5px}
.hdr-sub{font-size:12px;color:#94a3b8;margin-top:2px}
.hdr-meta{text-align:right;font-size:12px;color:#94a3b8}
.hdr-meta strong{color:#e2e8f0;display:block;font-size:13px}
.body{padding:36px 40px}
.case-card{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:28px}
.case-card-hdr{background:#f1f5f9;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;gap:12px}
.case-card-hdr h2{font-size:16px;font-weight:700;color:#0f172a;min-width:0;flex:1}
.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;flex-shrink:0}
.case-desc{padding:12px 20px;color:#475569;font-size:13px;border-bottom:1px solid #f1f5f9}
.case-grid{display:grid;grid-template-columns:1fr 1fr}
.case-field{padding:12px 20px;border-bottom:1px solid #f1f5f9}
.case-field:nth-child(odd){border-right:1px solid #f1f5f9}
.field-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#64748b;margin-bottom:3px}
.field-value{font-size:14px;font-weight:600;color:#1e293b}
.risk-wrap{margin:0 20px 16px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
.risk-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.risk-bar-bg{height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden}
.risk-bar{height:100%;border-radius:5px}
.section{margin-bottom:28px}
.section-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#64748b;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}
.summary-card{border-radius:10px;padding:14px;text-align:center;border:1px solid}
.summary-card .num{font-size:28px;font-weight:800;line-height:1}
.summary-card .lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:4px}
.sc-critical{background:#fef2f2;border-color:#fecaca;color:#dc2626}
.sc-high{background:#fff7ed;border-color:#fed7aa;color:#ea580c}
.sc-medium{background:#fffbeb;border-color:#fde68a;color:#d97706}
.sc-low{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#f1f5f9;padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;border-bottom:2px solid #e2e8f0}
td{padding:10px 14px;border-bottom:1px solid #f1f5f9;vertical-align:top}
tr:last-child td{border-bottom:none}
.finding{border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;overflow:hidden}
.finding-hdr{padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.finding-title{font-weight:600;font-size:13px;color:#0f172a;flex:1;min-width:0}
.finding-meta{font-size:11px;color:#64748b;padding:4px 14px 8px}
.finding-desc{font-size:12px;color:#475569;padding:0 14px 10px;line-height:1.5}
.empty{color:#94a3b8;font-style:italic;padding:20px;text-align:center}
.footer{background:#f1f5f9;border-top:1px solid #e2e8f0;padding:16px 40px;display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#94a3b8}
.footer strong{color:#64748b}
@media print{body{background:#fff}.page{box-shadow:none}.no-print{display:none}.finding{break-inside:avoid}}
</style>
</head>
<body>
<div class="page">

<div class="hdr">
  <div class="hdr-brand">
    <div class="hdr-logo">SW</div>
    <div>
      <div class="hdr-title">SecureWatch</div>
      <div class="hdr-sub">Digital Evidence Analysis Platform</div>
    </div>
  </div>
  <div class="hdr-meta">
    <strong>Case Analysis Report</strong>
    {{formatDate .GeneratedAt}}
  </div>
</div>

<div class="body">

<div class="case-card">
  <div class="case-card-hdr">
    <h2>{{.CaseTitle}}</h2>
    <span class="badge" style="color:{{priorityColor .Priority}};border:1px solid {{priorityColor .Priority}}40;background:{{priorityColor .Priority}}15">{{upper .Priority}}</span>
  </div>
  {{if .Description}}<p class="case-desc">{{.Description}}</p>{{end}}
  <div class="case-grid">
    <div class="case-field"><div class="field-label">Status</div><div class="field-value">{{.Status}}</div></div>
    <div class="case-field"><div class="field-label">Created by</div><div class="field-value">{{.CreatedByName}}</div></div>
    <div class="case-field"><div class="field-label">Assigned to</div><div class="field-value">{{.AssignedToName}}</div></div>
    <div class="case-field"><div class="field-label">Created</div><div class="field-value">{{formatShort .CreatedAt}}</div></div>
    <div class="case-field"><div class="field-label">Evidences</div><div class="field-value">{{len .Evidences}}</div></div>
    <div class="case-field"><div class="field-label">Findings</div><div class="field-value">{{len .Findings}}</div></div>
  </div>
  <div class="risk-wrap">
    <div class="risk-row">
      <span style="font-weight:700;font-size:13px">Risk Score</span>
      <span style="font-weight:800;color:{{riskColor .RiskScore}}">{{round .RiskScore}}% — {{riskLabel .RiskScore}}</span>
    </div>
    <div class="risk-bar-bg"><div class="risk-bar" style="width:{{round .RiskScore}}%;background:{{riskColor .RiskScore}}"></div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Findings Summary</div>
  <div class="summary-grid">
    <div class="summary-card sc-critical"><div class="num">{{.Critical}}</div><div class="lbl">Critical</div></div>
    <div class="summary-card sc-high"><div class="num">{{.High}}</div><div class="lbl">High</div></div>
    <div class="summary-card sc-medium"><div class="num">{{.Medium}}</div><div class="lbl">Medium</div></div>
    <div class="summary-card sc-low"><div class="num">{{.Low}}</div><div class="lbl">Low</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Evidence Files ({{len .Evidences}})</div>
  {{if .Evidences}}
  <table>
    <thead><tr><th>Filename</th><th>Type</th><th>Status</th><th>Size</th><th>Uploaded</th></tr></thead>
    <tbody>{{range .Evidences}}
    <tr>
      <td style="font-weight:600">{{.Filename}}</td>
      <td>{{.FileType}}</td>
      <td>{{.Status}}</td>
      <td>{{humanSize .SizeBytes}}</td>
      <td>{{formatShort .CreatedAt}}</td>
    </tr>{{end}}</tbody>
  </table>
  {{else}}<p class="empty">No evidence files uploaded</p>{{end}}
</div>

<div class="section">
  <div class="section-title">Findings Detail ({{len .Findings}})</div>
  {{if .Findings}}{{range .Findings}}
  <div class="finding">
    <div class="finding-hdr" style="background:{{severityBg .Severity}}">
      <span class="finding-title">{{.Title}}</span>
      <span class="badge" style="color:{{severityColor .Severity}};border:1px solid {{severityColor .Severity}}40;background:{{severityColor .Severity}}15">{{upper .Severity}}</span>
    </div>
    <div class="finding-meta">{{.FindingType}}{{if .Evidence}} · {{.Evidence}}{{end}} · {{formatShort .CreatedAt}}</div>
    {{if .Description}}<div class="finding-desc">{{.Description}}</div>{{end}}
  </div>
  {{end}}{{else}}<p class="empty">No findings generated yet</p>{{end}}
</div>

</div>

<div class="footer">
  <span>Generated by <strong>SecureWatch</strong> · Digital Evidence Analysis Platform</span>
  <a href="javascript:window.print()" class="no-print" style="color:#3b82f6;text-decoration:none;font-weight:600">Print / Save as PDF</a>
</div>

</div>
</body>
</html>`

package orchestrator

import (
	"context"
	"log/slog"
	"time"

	"github.com/codeg/securewatch/services/task-orchestrator/internal/domain"
	"github.com/codeg/securewatch/services/task-orchestrator/internal/messaging"
	"github.com/codeg/securewatch/services/task-orchestrator/internal/storage"
)

// Orchestrator polls for pending evidences, creates tasks (HU-14), and
// publishes them to RabbitMQ (HU-15).
type Orchestrator struct {
	tasks     *storage.TaskRepository
	publisher *messaging.Publisher
	interval  time.Duration
}

// New returns a ready-to-run Orchestrator.
func New(
	tasks *storage.TaskRepository,
	publisher *messaging.Publisher,
	pollInterval time.Duration,
) *Orchestrator {
	return &Orchestrator{
		tasks:     tasks,
		publisher: publisher,
		interval:  pollInterval,
	}
}

// Run starts the polling loop. It blocks until ctx is cancelled.
func (o *Orchestrator) Run(ctx context.Context) {
	slog.Info("orchestrator started", "poll_interval", o.interval)

	ticker := time.NewTicker(o.interval)
	defer ticker.Stop()

	// Run once immediately, then on every tick.
	o.tick(ctx)
	for {
		select {
		case <-ctx.Done():
			slog.Info("orchestrator stopped")
			return
		case <-ticker.C:
			o.tick(ctx)
		}
	}
}

// tick processes all pending evidences in one polling cycle.
func (o *Orchestrator) tick(ctx context.Context) {
	evidences, err := o.tasks.PendingEvidences(ctx)
	if err != nil {
		slog.Error("failed to fetch pending evidences", "error", err)
		return
	}
	if len(evidences) == 0 {
		return
	}

	slog.Info("processing pending evidences", "count", len(evidences))

	for _, ev := range evidences {
		if ctx.Err() != nil {
			return
		}
		o.processEvidence(ctx, ev)
	}
}

// processEvidence handles a single evidence: create task → publish → update statuses.
func (o *Orchestrator) processEvidence(ctx context.Context, ev domain.PendingEvidence) {
	log := slog.With("evidence_id", ev.ID, "file_type", ev.FileType, "priority", ev.Priority)

	// ── HU-14: Determine task type and queue ──────────────────────────────────
	taskType  := domain.TaskTypeForFileType(ev.FileType)
	queueName := domain.QueueForTaskType(taskType)

	// ── HU-14: Create task in PostgreSQL ─────────────────────────────────────
	task, err := o.tasks.CreateTask(ctx, ev, taskType, queueName)
	if err != nil {
		log.Error("failed to create task", "error", err)
		return
	}
	log.Info("task created", "task_id", task.ID, "task_type", taskType)

	// ── HU-14: Mark evidence as classified ───────────────────────────────────
	if err := o.tasks.MarkEvidenceClassified(ctx, ev.ID); err != nil {
		log.Error("failed to mark evidence classified", "error", err)
		// Non-fatal: continue to publish
	}

	// ── HU-15: Publish task message to RabbitMQ ───────────────────────────────
	msg := domain.TaskMessage{
		TaskID:     task.ID,
		CaseID:     ev.CaseID,
		EvidenceID: ev.ID,
		TaskType:   taskType,
		Priority:   ev.Priority,
	}

	if err := o.publisher.Publish(ctx, msg); err != nil {
		log.Error("failed to publish task to rabbitmq", "task_id", task.ID, "error", err)
		_ = o.tasks.MarkTaskFailed(ctx, task.ID, err.Error())
		return
	}

	log.Info("task published", "task_id", task.ID, "queue", queueName)

	// ── HU-15: Update statuses after confirmed publish ────────────────────────
	if err := o.tasks.MarkTaskQueued(ctx, task.ID); err != nil {
		log.Error("failed to mark task queued", "task_id", task.ID, "error", err)
	}
	if err := o.tasks.MarkEvidenceQueued(ctx, ev.ID); err != nil {
		log.Error("failed to mark evidence queued", "evidence_id", ev.ID, "error", err)
	}
}

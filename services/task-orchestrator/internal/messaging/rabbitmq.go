package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/codeg/securewatch/services/task-orchestrator/internal/domain"
)

const (
	// ExchangeName is the topic exchange that all task messages flow through.
	ExchangeName = "evidence.analysis"

	// RoutingKeyPrefix is prepended to the task_type to form the routing key.
	// e.g. "task.text_analysis", "task.image_analysis"
	RoutingKeyPrefix = "task."

	// DeadLetterExchange receives messages that exhaust retries.
	DeadLetterExchange = "evidence.analysis.dlx"
	DeadLetterQueue    = "tasks.dead_letter"
)

// queueNames is the canonical list of per-type queues (HU-15).
var queueNames = []string{
	"tasks.text_analysis",
	"tasks.image_analysis",
	"tasks.audio_analysis",
	"tasks.document_analysis",
	"tasks.archive_analysis",
}

// Publisher manages the AMQP connection and publishes task messages.
type Publisher struct {
	conn     *amqp.Connection
	channel  *amqp.Channel
	confirms chan amqp.Confirmation // single persistent confirms channel
	url      string
}

// NewPublisher connects to RabbitMQ with retries and declares all topology.
func NewPublisher(url string) (*Publisher, error) {
	p := &Publisher{url: url}
	if err := p.connect(); err != nil {
		return nil, err
	}
	if err := p.declareTopology(); err != nil {
		return nil, err
	}
	return p, nil
}

func (p *Publisher) connect() error {
	var (
		conn *amqp.Connection
		err  error
	)
	for attempt := 1; attempt <= 10; attempt++ {
		conn, err = amqp.Dial(p.url)
		if err == nil {
			break
		}
		slog.Warn("rabbitmq not ready, retrying", "attempt", attempt, "error", err)
		time.Sleep(time.Duration(attempt) * time.Second)
	}
	if err != nil {
		return fmt.Errorf("rabbitmq connect: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("rabbitmq channel: %w", err)
	}

	// Enable publisher confirms (HU-15: "Confirmar publicación")
	if err := ch.Confirm(false); err != nil {
		return fmt.Errorf("rabbitmq confirm mode: %w", err)
	}

	// Single persistent confirms channel — registered once, never stacked.
	confirms := make(chan amqp.Confirmation, 32)
	ch.NotifyPublish(confirms)

	p.conn     = conn
	p.channel  = ch
	p.confirms = confirms
	return nil
}

// declareTopology creates the exchange, queues, bindings, and DLX (HU-15).
func (p *Publisher) declareTopology() error {
	// ── Dead-letter exchange & queue ──────────────────────────────────────────
	if err := p.channel.ExchangeDeclare(
		DeadLetterExchange, "fanout", true, false, false, false, nil,
	); err != nil {
		return fmt.Errorf("declare DLX: %w", err)
	}

	if _, err := p.channel.QueueDeclare(
		DeadLetterQueue, true, false, false, false, nil,
	); err != nil {
		return fmt.Errorf("declare dead-letter queue: %w", err)
	}

	if err := p.channel.QueueBind(DeadLetterQueue, "#", DeadLetterExchange, false, nil); err != nil {
		return fmt.Errorf("bind dead-letter queue: %w", err)
	}

	// ── Main topic exchange ───────────────────────────────────────────────────
	if err := p.channel.ExchangeDeclare(
		ExchangeName, "topic", true, false, false, false, nil,
	); err != nil {
		return fmt.Errorf("declare exchange: %w", err)
	}

	// ── Per-type queues with DLX and priority support (HU-15) ────────────────
	dlxArgs := amqp.Table{
		"x-dead-letter-exchange": DeadLetterExchange,
		"x-max-priority":         int32(4), // maps to low/medium/high/critical
	}

	for _, qName := range queueNames {
		if _, err := p.channel.QueueDeclare(
			qName, true, false, false, false, dlxArgs,
		); err != nil {
			return fmt.Errorf("declare queue %s: %w", qName, err)
		}
		// Routing key: "task.<task_type>" e.g. "task.text_analysis"
		routingKey := RoutingKeyPrefix + qName[len("tasks."):]
		if err := p.channel.QueueBind(qName, routingKey, ExchangeName, false, nil); err != nil {
			return fmt.Errorf("bind queue %s: %w", qName, err)
		}
	}

	slog.Info("rabbitmq topology declared",
		"exchange", ExchangeName,
		"queues", len(queueNames),
	)
	return nil
}

// priorityValue maps case priority to AMQP message priority (0-4).
func priorityValue(priority string) uint8 {
	switch priority {
	case "critical": return 4
	case "high":     return 3
	case "medium":   return 2
	default:         return 1
	}
}

// Publish sends a TaskMessage to the appropriate queue (HU-15).
// It uses publisher confirms to guarantee delivery, reconnecting on channel errors.
func (p *Publisher) Publish(ctx context.Context, msg domain.TaskMessage) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal task message: %w", err)
	}

	routingKey := RoutingKeyPrefix + msg.TaskType

	publishing := amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Priority:     priorityValue(msg.Priority),
		Body:         body,
		MessageId:    msg.TaskID,
		Timestamp:    time.Now().UTC(),
		Headers: amqp.Table{
			"task_type":   msg.TaskType,
			"case_id":     msg.CaseID,
			"evidence_id": msg.EvidenceID,
		},
	}

	// Attempt publish with one automatic reconnect on failure.
	for attempt := 0; attempt < 2; attempt++ {
		pubErr := p.publishOnce(ctx, routingKey, publishing, msg.TaskID)
		if pubErr == nil {
			return nil
		}
		if attempt == 0 {
			slog.Warn("publish failed, reconnecting channel", "error", pubErr)
			if reconnErr := p.reconnectChannel(); reconnErr != nil {
				return fmt.Errorf("publish failed and reconnect failed: %w", reconnErr)
			}
			continue
		}
		return pubErr
	}
	return nil
}

func (p *Publisher) publishOnce(ctx context.Context, routingKey string, pub amqp.Publishing, taskID string) error {
	// Drain any stale ACKs from previous publishes before sending a new one.
	for len(p.confirms) > 0 {
		<-p.confirms
	}

	if err := p.channel.PublishWithContext(ctx,
		ExchangeName, routingKey,
		true, false, pub,
	); err != nil {
		return fmt.Errorf("publish task: %w", err)
	}

	select {
	case confirm := <-p.confirms:
		if !confirm.Ack {
			return fmt.Errorf("broker nacked task %s", taskID)
		}
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(5 * time.Second):
		return fmt.Errorf("publish confirm timeout for task %s", taskID)
	}
}

// reconnectChannel replaces the AMQP channel and confirms channel with fresh ones.
func (p *Publisher) reconnectChannel() error {
	if p.channel != nil {
		_ = p.channel.Close()
	}
	if p.conn == nil || p.conn.IsClosed() {
		if err := p.connect(); err != nil {
			return err
		}
		return p.declareTopology()
	}
	ch, err := p.conn.Channel()
	if err != nil {
		return fmt.Errorf("open channel: %w", err)
	}
	if err := ch.Confirm(false); err != nil {
		return fmt.Errorf("confirm mode: %w", err)
	}
	confirms := make(chan amqp.Confirmation, 32)
	ch.NotifyPublish(confirms)
	p.channel  = ch
	p.confirms = confirms
	return nil
}

// Close cleans up the AMQP channel and connection.
func (p *Publisher) Close() {
	if p.channel != nil {
		_ = p.channel.Close()
	}
	if p.conn != nil {
		_ = p.conn.Close()
	}
}

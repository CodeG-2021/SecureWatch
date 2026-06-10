package domain

import (
	"errors"
	"strings"
	"time"
)

// Case is a digital forensic investigation case.
type Case struct {
	ID             string     `json:"id"`
	Title          string     `json:"title"`
	Description    string     `json:"description,omitempty"`
	Priority       string     `json:"priority"`
	Status         string     `json:"status"`
	CreatedBy      string     `json:"created_by"`
	CreatedByName  string     `json:"created_by_name,omitempty"`
	AssignedTo     *string    `json:"assigned_to,omitempty"`
	AssignedToName *string    `json:"assigned_to_name,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	ClosedAt       *time.Time `json:"closed_at,omitempty"`
}

// CreateCaseInput holds the data needed to create a new case (HU-07).
type CreateCaseInput struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Priority    string  `json:"priority"`
	AssignedTo  *string `json:"assigned_to"`
}

// UpdateCaseInput holds partial data for patching a case (HU-10).
// Nil fields are left unchanged.
type UpdateCaseInput struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Priority    *string `json:"priority"`
	Status      *string `json:"status"`
	AssignedTo  *string `json:"assigned_to"`
}

var validPriorities = map[string]bool{
	"low": true, "medium": true, "high": true, "critical": true,
}

var validStatuses = map[string]bool{
	"open": true, "in_progress": true, "closed": true, "archived": true,
}

// Normalize trims and lower-cases CreateCaseInput fields.
func (i CreateCaseInput) Normalize() CreateCaseInput {
	i.Title = strings.TrimSpace(i.Title)
	i.Description = strings.TrimSpace(i.Description)
	if i.Priority == "" {
		i.Priority = "medium"
	}
	i.Priority = strings.ToLower(strings.TrimSpace(i.Priority))
	return i
}

// Validate returns an error if required fields are missing or invalid.
func (i CreateCaseInput) Validate() error {
	if i.Title == "" {
		return errors.New("title is required")
	}
	if len(i.Title) > 200 {
		return errors.New("title must be 200 characters or fewer")
	}
	if !validPriorities[i.Priority] {
		return errors.New("priority must be low, medium, high, or critical")
	}
	return nil
}

// Validate checks patch fields only when they are present.
func (i UpdateCaseInput) Validate() error {
	if i.Title != nil {
		t := strings.TrimSpace(*i.Title)
		if t == "" {
			return errors.New("title cannot be empty")
		}
		if len(t) > 200 {
			return errors.New("title must be 200 characters or fewer")
		}
	}
	if i.Priority != nil && !validPriorities[strings.ToLower(*i.Priority)] {
		return errors.New("priority must be low, medium, high, or critical")
	}
	if i.Status != nil && !validStatuses[strings.ToLower(*i.Status)] {
		return errors.New("status must be open, in_progress, closed, or archived")
	}
	return nil
}

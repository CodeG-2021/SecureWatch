package domain

import (
	"errors"
	"net/mail"
	"strings"
	"unicode"
)

type RegisterUserInput struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type User struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

var (
	ErrInvalidName     = errors.New("name must contain at least 2 characters")
	ErrInvalidEmail    = errors.New("email must be valid")
	ErrInvalidPassword = errors.New("password must be at least 8 characters and include a symbol")
	ErrInvalidRole     = errors.New("role must be analyst, supervisor, or admin")
)

func (input RegisterUserInput) Normalize() RegisterUserInput {
	return RegisterUserInput{
		Name:     strings.TrimSpace(input.Name),
		Email:    strings.ToLower(strings.TrimSpace(input.Email)),
		Password: input.Password,
		Role:     normalizeRole(input.Role),
	}
}

func (input RegisterUserInput) Validate() error {
	if len([]rune(strings.TrimSpace(input.Name))) < 2 {
		return ErrInvalidName
	}

	if _, err := mail.ParseAddress(input.Email); err != nil {
		return ErrInvalidEmail
	}

	if !validPassword(input.Password) {
		return ErrInvalidPassword
	}

	if !ValidRole(input.Role) {
		return ErrInvalidRole
	}

	return nil
}

func ValidRole(role string) bool {
	switch normalizeRole(role) {
	case "admin", "analyst", "supervisor":
		return true
	default:
		return false
	}
}

func normalizeRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "administrator":
		return "admin"
	default:
		return strings.ToLower(strings.TrimSpace(role))
	}
}

func validPassword(password string) bool {
	if len([]rune(password)) < 8 {
		return false
	}

	hasSymbol := false
	for _, r := range password {
		if unicode.IsPunct(r) || unicode.IsSymbol(r) {
			hasSymbol = true
			break
		}
	}

	return hasSymbol
}

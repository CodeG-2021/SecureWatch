package domain

import (
	"errors"
	"net/mail"
	"strings"
)

type LoginUserInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

var (
	ErrLoginInvalidEmail    = errors.New("email must be valid")
	ErrLoginMissingPassword = errors.New("password is required")
	ErrInvalidCredentials   = errors.New("invalid credentials")
)

func (input LoginUserInput) Normalize() LoginUserInput {
	return LoginUserInput{
		Email:    strings.ToLower(strings.TrimSpace(input.Email)),
		Password: input.Password,
	}
}

func (input LoginUserInput) Validate() error {
	if _, err := mail.ParseAddress(input.Email); err != nil {
		return ErrLoginInvalidEmail
	}
	if strings.TrimSpace(input.Password) == "" {
		return ErrLoginMissingPassword
	}
	return nil
}

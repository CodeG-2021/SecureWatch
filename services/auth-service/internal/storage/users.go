package storage

import (
	"context"
	"database/sql"
	"errors"

	"github.com/codeg/securewatch/services/auth-service/internal/domain"
	"github.com/jackc/pgx/v5/pgconn"
)

var ErrDuplicateEmail = errors.New("email already registered")

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (repo *UserRepository) Create(ctx context.Context, input domain.RegisterUserInput, passwordHash string) (domain.User, error) {
	const query = `
		INSERT INTO users (name, email, password_hash, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text, name, email, role, status, created_at::text, updated_at::text
	`

	var user domain.User
	err := repo.db.QueryRowContext(ctx, query, input.Name, input.Email, passwordHash, input.Role).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Role,
		&user.Status,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return domain.User{}, ErrDuplicateEmail
		}
		return domain.User{}, err
	}

	return user, nil
}

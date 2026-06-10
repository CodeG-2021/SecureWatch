package storage

import (
	"context"
	"fmt"
	"io"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// MinIOStore wraps a MinIO client for evidence object storage.
type MinIOStore struct {
	client *minio.Client
	bucket string
}

// NewMinIOStore initialises the MinIO client and ensures the target bucket exists.
func NewMinIOStore(ctx context.Context, endpoint, accessKey, secretKey, bucket string, useSSL bool) (*MinIOStore, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio.New: %w", err)
	}
	store := &MinIOStore{client: client, bucket: bucket}
	if err := store.EnsureBucket(ctx); err != nil {
		return nil, err
	}
	return store, nil
}

// EnsureBucket creates the evidence bucket if it does not already exist.
func (s *MinIOStore) EnsureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return fmt.Errorf("minio BucketExists: %w", err)
	}
	if exists {
		return nil
	}
	if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
		return fmt.Errorf("minio MakeBucket: %w", err)
	}
	return nil
}

// PutObject streams an object into MinIO and returns the storage path.
// storagePath is the full object key (e.g. "cases/<caseID>/<evidenceID>/<filename>").
func (s *MinIOStore) PutObject(ctx context.Context, storagePath, contentType string, reader io.Reader, size int64) error {
	_, err := s.client.PutObject(ctx, s.bucket, storagePath, reader, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return fmt.Errorf("minio PutObject: %w", err)
	}
	return nil
}

// Bucket returns the configured bucket name.
func (s *MinIOStore) Bucket() string { return s.bucket }

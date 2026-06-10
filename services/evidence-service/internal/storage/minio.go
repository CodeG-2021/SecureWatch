package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// MinIOStore wraps a MinIO client for evidence object storage.
type MinIOStore struct {
	client        *minio.Client // internal endpoint — used for PutObject, BucketExists, etc.
	presignClient *minio.Client // public endpoint — used only for presigned URLs so signatures are browser-valid
	bucket        string
}

// NewMinIOStore initialises the MinIO client and ensures the target bucket exists.
// publicEndpoint must be browser-reachable (e.g. "localhost:9000") so presigned URL
// signatures are computed against the correct host.
func NewMinIOStore(ctx context.Context, endpoint, publicEndpoint, accessKey, secretKey, bucket string, useSSL bool) (*MinIOStore, error) {
	newClient := func(ep string) (*minio.Client, error) {
		return minio.New(ep, &minio.Options{
			Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
			Secure: useSSL,
			// Region must be set explicitly so PresignedGetObject never makes a
			// GetBucketLocation network call (which would fail for the public
			// endpoint since it is not reachable from inside the container).
			Region: "us-east-1",
		})
	}

	client, err := newClient(endpoint)
	if err != nil {
		return nil, fmt.Errorf("minio.New (internal): %w", err)
	}

	if publicEndpoint == "" {
		publicEndpoint = endpoint
	}
	presignClient, err := newClient(publicEndpoint)
	if err != nil {
		return nil, fmt.Errorf("minio.New (public): %w", err)
	}

	store := &MinIOStore{client: client, presignClient: presignClient, bucket: bucket}
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

// PresignedGetURL generates a temporary download URL signed against the public endpoint
// so browsers can open the URL directly without DNS resolution issues (HU-23).
func (s *MinIOStore) PresignedGetURL(ctx context.Context, storagePath string, expiry time.Duration) (string, error) {
	u, err := s.presignClient.PresignedGetObject(ctx, s.bucket, storagePath, expiry, url.Values{})
	if err != nil {
		return "", fmt.Errorf("minio presign: %w", err)
	}
	return u.String(), nil
}

// Bucket returns the configured bucket name.
func (s *MinIOStore) Bucket() string { return s.bucket }

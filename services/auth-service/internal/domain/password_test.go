package domain

import "testing"

func TestHashAndVerifyPassword(t *testing.T) {
	hash, err := HashPassword("Password!")
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	if hash == "Password!" {
		t.Fatal("password hash should not equal raw password")
	}

	if !VerifyPassword("Password!", hash) {
		t.Fatal("VerifyPassword() should accept the original password")
	}

	if VerifyPassword("WrongPassword!", hash) {
		t.Fatal("VerifyPassword() should reject a different password")
	}
}

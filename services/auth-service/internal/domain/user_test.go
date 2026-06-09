package domain

import "testing"

func TestRegisterUserInputValidate(t *testing.T) {
	tests := []struct {
		name    string
		input   RegisterUserInput
		wantErr bool
	}{
		{
			name: "valid analyst",
			input: RegisterUserInput{
				Name:     "Jane Doe",
				Email:    "jane@example.com",
				Password: "Password!",
				Role:     "analyst",
			},
			wantErr: false,
		},
		{
			name: "invalid email",
			input: RegisterUserInput{
				Name:     "Jane Doe",
				Email:    "not-email",
				Password: "Password!",
				Role:     "analyst",
			},
			wantErr: true,
		},
		{
			name: "weak password",
			input: RegisterUserInput{
				Name:     "Jane Doe",
				Email:    "jane@example.com",
				Password: "password",
				Role:     "analyst",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.input.Normalize().Validate()
			if (err != nil) != tt.wantErr {
				t.Fatalf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

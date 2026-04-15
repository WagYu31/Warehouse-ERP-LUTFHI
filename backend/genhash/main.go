package main

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	users := []struct{ email, pass string }{
		{"admin@wms-lutfhi.com", "Admin@2026"},
		{"staff@wms-lutfhi.com", "Staff@2026"},
		{"finance@wms-lutfhi.com", "Finance@2026"},
		{"manager@wms-lutfhi.com", "Manager@2026"},
		{"requester@wms-lutfhi.com", "Requester@2026"},
	}
	for _, u := range users {
		hash, _ := bcrypt.GenerateFromPassword([]byte(u.pass), 12)
		fmt.Printf("%s|%s\n", u.email, string(hash))
	}
}

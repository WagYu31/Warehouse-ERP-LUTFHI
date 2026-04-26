package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"wms-lutfhi/middleware"
)

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Email atau password tidak valid"})
		return
	}

	// Ambil user dari DB
	var (
		userID   string
		name     string
		email    string
		role     string
		passHash string
		isActive bool
	)

	err := h.DB.QueryRow(`
		SELECT id, name, email, role, password_hash, is_active
		FROM users
		WHERE email = ?
	`, req.Email).Scan(&userID, &name, &email, &role, &passHash, &isActive)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Email atau password salah"})
		return
	}
	if err != nil {
		fmt.Printf("[LOGIN ERROR] DB scan error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Terjadi kesalahan server"})
		return
	}

	if !isActive {
		c.JSON(http.StatusForbidden, gin.H{"message": "Akun Anda dinonaktifkan. Hubungi Administrator."})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(passHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Email atau password salah"})
		return
	}

	// Update last login
	h.DB.Exec("UPDATE users SET last_login_at = ? WHERE id = ?", time.Now(), userID)

	// Generate JWT
	token, refreshToken, err := generateTokens(userID, email, role, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal membuat token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Login berhasil",
		"token":         token,
		"refresh_token": refreshToken,
		"user": gin.H{
			"id":    userID,
			"name":  name,
			"email": email,
			"role":  role,
		},
	})
}

func (h *Handler) RefreshToken(c *gin.Context) {
	var body struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Refresh token required"})
		return
	}

	secret := getJWTSecret()
	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(body.RefreshToken, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Refresh token tidak valid"})
		return
	}

	newToken, newRefresh, err := generateTokens(claims.UserID, claims.Email, claims.Role, claims.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal refresh token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":         newToken,
		"refresh_token": newRefresh,
	})
}

func generateTokens(userID, email, role, name string) (string, string, error) {
	secret := getJWTSecret()
	expireHours := 8

	// Access token (8 jam)
	claims := &middleware.Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		Name:   name,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expireHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        uuid.New().String(),
		},
	}

	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		return "", "", err
	}

	// Refresh token (7 hari)
	refreshClaims := &middleware.Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		Name:   name,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        uuid.New().String(),
		},
	}

	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString([]byte(secret))
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

func getJWTSecret() string {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return s
	}
	return "your_super_secret_jwt_key_change_in_production_2026"
}

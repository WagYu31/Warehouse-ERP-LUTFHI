package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// ── Rate Limiter (In-memory, IP-based) ───────────────────────

type rateBucket struct {
	count     int
	resetAt   time.Time
	lockedUntil time.Time
}

var (
	rateMu   sync.Mutex
	rateMap  = make(map[string]*rateBucket)
)

// RateLimitLogin: max 10 req/menit, lockout 15 menit setelah 5 gagal berturut
func RateLimitLogin() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		rateMu.Lock()
		b, ok := rateMap[ip]
		if !ok {
			b = &rateBucket{}
			rateMap[ip] = b
		}

		// Cek lockout
		if now.Before(b.lockedUntil) {
			rateMu.Unlock()
			remaining := int(b.lockedUntil.Sub(now).Minutes()) + 1
			c.JSON(http.StatusTooManyRequests, gin.H{
				"message": "Terlalu banyak percobaan login. Coba lagi dalam " + 
					itoa(remaining) + " menit.",
				"locked_until": b.lockedUntil.Format(time.RFC3339),
			})
			c.Abort()
			return
		}

		// Reset counter tiap menit
		if now.After(b.resetAt) {
			b.count = 0
			b.resetAt = now.Add(time.Minute)
		}

		b.count++

		// Lockout setelah 10 attempts per menit
		if b.count > 10 {
			b.lockedUntil = now.Add(15 * time.Minute)
			rateMu.Unlock()
			c.JSON(http.StatusTooManyRequests, gin.H{
				"message": "Akun dikunci 15 menit karena terlalu banyak percobaan login.",
			})
			c.Abort()
			return
		}
		rateMu.Unlock()

		c.Next()
	}
}

// RateLimitAPI: max 300 req/menit per IP (general API)
func RateLimitAPI() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		rateMu.Lock()
		b, ok := rateMap["api:"+ip]
		if !ok {
			b = &rateBucket{}
			rateMap["api:"+ip] = b
		}
		if now.After(b.resetAt) {
			b.count = 0
			b.resetAt = now.Add(time.Minute)
		}
		b.count++
		if b.count > 300 {
			rateMu.Unlock()
			c.JSON(http.StatusTooManyRequests, gin.H{"message": "Rate limit exceeded. Max 300 requests/minute."})
			c.Abort()
			return
		}
		rateMu.Unlock()
		c.Next()
	}
}

// SecurityHeaders: tambah HTTP security headers
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		// Hanya add HSTS di production (HTTPS)
		if c.Request.TLS != nil {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	}
}

func itoa(n int) string {
	if n <= 0 { return "0" }
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}

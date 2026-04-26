package middleware

import (
	"database/sql"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var auditDB *sql.DB

func SetAuditDB(db *sql.DB) {
	auditDB = db
}

// AuditLogger — middleware untuk log semua aksi mutasi ke audit_logs
func AuditLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Hanya log mutating requests
		method := c.Request.Method
		if method == "GET" || method == "OPTIONS" || method == "HEAD" {
			c.Next()
			return
		}

		// Sebelum handler
		start := time.Now()
		c.Next()

		// Setelah handler selesai
		status := c.Writer.Status()

		// Hanya log request yang berhasil (2xx)
		if status < 200 || status >= 300 {
			return
		}

		userID := c.GetString("user_id")
		userRole := c.GetString("role")
		path := c.FullPath()
		ip := c.ClientIP()

		if auditDB == nil || userID == "" {
			return
		}

		go func() {
			auditDB.Exec(`
				INSERT INTO audit_logs (id, user_id, action, resource, ip_address, status_code, duration_ms, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				uuid.New().String(),
				userID,
				method+" "+path,
				extractResource(path, method),
				ip,
				status,
				time.Since(start).Milliseconds(),
				time.Now(),
			)
			_ = userRole // tersedia jika perlu nanti
		}()
	}
}

func extractResource(path, method string) string {
	switch method {
	case "POST":
		return "CREATE:" + path
	case "PUT", "PATCH":
		return "UPDATE:" + path
	case "DELETE":
		return "DELETE:" + path
	default:
		return method + ":" + path
	}
}

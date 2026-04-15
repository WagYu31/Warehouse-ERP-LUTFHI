package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"wms-lutfhi/handlers"
	"wms-lutfhi/middleware"
)

var DB *sql.DB

func initDB() {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		getEnv("DB_HOST", "localhost"),
		getEnv("DB_PORT", "5435"),
		getEnv("DB_USER", "wms_user"),
		getEnv("DB_PASSWORD", "wms_password_2026"),
		getEnv("DB_NAME", "wms_lutfhi"),
		getEnv("DB_SSL_MODE", "disable"),
	)

	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("❌ Failed to open database: %v", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	// Retry connect up to 10x (tunggu postgres container ready)
	for i := 1; i <= 10; i++ {
		if err = DB.Ping(); err == nil {
			log.Printf("✅ Database connected (attempt %d)", i)
			return
		}
		log.Printf("⏳ Waiting for database... attempt %d/10 (%v)", i, err)
		time.Sleep(2 * time.Second)
	}
	log.Fatalf("❌ Cannot connect to database after 10 attempts")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	// Load .env
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  .env file not found, using system environment variables")
	}

	// Init DB
	initDB()

	// Gin mode
	if os.Getenv("APP_ENV") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// ── CORS ──────────────────────────────────────────────
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost:5173", "*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// ── Inject DB ke handlers ──────────────────────────────
	h := handlers.NewHandler(DB)

	// ── ROUTES ────────────────────────────────────────────
	api := r.Group("/api")
	{
		// Health check
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok", "version": "2.0.0", "service": "WMS LUTFHI"})
		})

		// ── Auth (public) ──────────────────────────────
		auth := api.Group("/auth")
		{
			auth.POST("/login", h.Login)
			auth.POST("/refresh", h.RefreshToken)
		}

		// ── Protected routes ───────────────────────────
		protected := api.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			// Users
			protected.GET("/users/me", h.GetMe)
			protected.PUT("/users/me", h.UpdateMe)
			protected.GET("/users", middleware.RequireRole("admin"), h.GetUsers)
			protected.POST("/users", middleware.RequireRole("admin"), h.CreateUser)
			protected.PUT("/users/:id", middleware.RequireRole("admin"), h.UpdateUser)
			protected.DELETE("/users/:id", middleware.RequireRole("admin"), h.DeleteUser)

			// Warehouses
			protected.GET("/warehouses", h.GetWarehouses)
			protected.POST("/warehouses", middleware.RequireRole("admin"), h.CreateWarehouse)
			protected.PUT("/warehouses/:id", middleware.RequireRole("admin"), h.UpdateWarehouse)
			protected.DELETE("/warehouses/:id", middleware.RequireRole("admin"), h.DeleteWarehouse)

			// Categories
			protected.GET("/categories", h.GetCategories)
			protected.POST("/categories", middleware.RequireRole("admin"), h.CreateCategory)

			// Units
			protected.GET("/units", h.GetUnits)
			protected.POST("/units", middleware.RequireRole("admin"), h.CreateUnit)

			// Suppliers
			protected.GET("/suppliers", h.GetSuppliers)
			protected.POST("/suppliers", middleware.RequireRole("admin", "finance_procurement"), h.CreateSupplier)
			protected.PUT("/suppliers/:id", middleware.RequireRole("admin", "finance_procurement"), h.UpdateSupplier)
			protected.DELETE("/suppliers/:id", middleware.RequireRole("admin"), h.DeleteSupplier)

			// Items (Barang)
			protected.GET("/items", h.GetItems)
			protected.GET("/items/:id", h.GetItem)
			protected.POST("/items", middleware.RequireRole("admin"), h.CreateItem)
			protected.PUT("/items/:id", middleware.RequireRole("admin"), h.UpdateItem)
			protected.DELETE("/items/:id", middleware.RequireRole("admin"), h.DeleteItem)

			// Inbound (Barang Masuk / GRN)
			protected.GET("/inbound", h.GetInbound)
			protected.POST("/inbound", middleware.RequireRole("admin", "staff"), h.CreateInbound)
			protected.GET("/inbound/:id", h.GetInboundDetail)
			protected.PUT("/inbound/:id/confirm", middleware.RequireRole("admin", "staff"), h.ConfirmInbound)

			// Outbound (Barang Keluar)
			protected.GET("/outbound", h.GetOutbound)
			protected.POST("/outbound", middleware.RequireRole("admin", "staff"), h.CreateOutbound)

			// Requests (SPB)
			protected.GET("/requests", h.GetRequests)
			protected.POST("/requests", middleware.RequireRole("admin", "staff", "requester"), h.CreateRequest)
			protected.GET("/requests/:id", h.GetRequestDetail)
			protected.PUT("/requests/:id/approve", middleware.RequireRole("admin", "staff"), h.ApproveRequest)
			protected.PUT("/requests/:id/reject", middleware.RequireRole("admin", "staff"), h.RejectRequest)

			// Stock Opname
			protected.GET("/opname", h.GetOpnameList)
			protected.POST("/opname", middleware.RequireRole("admin", "staff"), h.CreateOpnameFull)
			protected.GET("/opname/:id", h.GetOpnameDetail)
			protected.POST("/opname/:id/submit", middleware.RequireRole("admin", "staff"), h.SubmitOpnameCount)

			// Stock Transfer
			protected.GET("/stock-transfers", h.GetStockTransfers)
			protected.POST("/stock-transfers", middleware.RequireRole("admin", "staff"), h.CreateStockTransfer)

			// Notifications
			protected.GET("/notifications", h.GetNotifications)
			protected.PUT("/notifications/:id/read", h.MarkNotificationRead)
			protected.GET("/alerts/low-stock", h.GetLowStockAlerts)

			// Profile & Password
			protected.PUT("/users/me/password", h.ChangePassword)

			// Categories (full CRUD)
			protected.PUT("/categories/:id", middleware.RequireRole("admin"), h.UpdateCategory)
			protected.DELETE("/categories/:id", middleware.RequireRole("admin"), h.DeleteCategory)

			// Units (full CRUD)
			protected.PUT("/units/:id", middleware.RequireRole("admin"), h.UpdateUnit)
			protected.DELETE("/units/:id", middleware.RequireRole("admin"), h.DeleteUnit)

			// Dashboard stats
			protected.GET("/dashboard/stats", h.GetDashboardStats)

			// ERP - Purchase Orders
			erp := protected.Group("/erp")
			erp.Use(middleware.RequireRole("admin", "finance_procurement", "manager"))
			{
				erp.GET("/purchase-orders", h.GetPurchaseOrders)
				erp.POST("/purchase-orders", middleware.RequireRole("admin", "finance_procurement"), h.CreatePurchaseOrder)
				erp.GET("/purchase-orders/:id", h.GetPODetailFull)
				erp.PUT("/purchase-orders/:id/status", middleware.RequireRole("admin", "finance_procurement"), h.UpdatePOStatus)
				erp.PUT("/purchase-orders/:id", middleware.RequireRole("admin", "finance_procurement"), h.UpdatePurchaseOrder)

				erp.GET("/invoices", h.GetInvoices)
				erp.POST("/invoices", middleware.RequireRole("admin", "finance_procurement"), h.CreateInvoice)
				erp.GET("/invoices/:id", h.GetInvoiceDetail)
				erp.POST("/invoices/:id/payment", middleware.RequireRole("admin", "finance_procurement"), h.RecordPayment)
				erp.GET("/invoices/:id/payments", h.GetPaymentHistory)

				erp.GET("/budgets", h.GetBudgets)
				erp.POST("/budgets", middleware.RequireRole("admin", "finance_procurement"), h.CreateBudget)

				erp.GET("/reorder-configs", h.GetReorderConfigs)
				erp.POST("/reorder-configs", middleware.RequireRole("admin", "finance_procurement"), h.CreateReorderConfig)
				erp.DELETE("/reorder-configs/:id", middleware.RequireRole("admin", "finance_procurement"), h.DeleteReorderConfig)

				erp.GET("/reports/summary", h.GetERPSummary)
			}
		}
	}

	port := getEnv("APP_PORT", "8080")
	log.Printf("🚀 WMS LUTFHI Backend running on port %s", port)
	log.Printf("📡 API: http://localhost:%s/api/health", port)

	if err := r.Run(":" + port); err != nil {
		log.Fatalf("❌ Server failed: %v", err)
	}
}

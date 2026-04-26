package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/go-sql-driver/mysql"

	"wms-lutfhi/handlers"
	"wms-lutfhi/jobs"
	"wms-lutfhi/middleware"
)

var DB *sql.DB

func initDB() {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		getEnv("DB_USER", "pitagic_wms_user"),
		getEnv("DB_PASSWORD", "WmsLuth@2026#Secure"),
		getEnv("DB_HOST", "localhost"),
		getEnv("DB_PORT", "3306"),
		getEnv("DB_NAME", "pitagic_wms_lutfh"),
	)

	var err error
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("❌ Failed to open database: %v", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

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

func getAllowedOrigins() []string {
	env := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")
	origins := strings.Split(env, ",")
	for i, o := range origins {
		origins[i] = strings.TrimSpace(o)
	}
	return origins
}

func main() {
	// Load .env
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  .env file not found, using system environment variables")
	}

	// ── Validate kritis env vars ──────────────────────────
	if os.Getenv("APP_ENV") == "production" {
		if os.Getenv("JWT_SECRET") == "" {
			log.Fatal("❌ FATAL: JWT_SECRET environment variable is required in production!")
		}
	}

	// Init DB
	initDB()

	// Init Audit Middleware DB
	middleware.SetAuditDB(DB)

	// Start scheduler (cron jobs harian)
	jobs.StartScheduler(DB)

	// Gin mode
	if os.Getenv("APP_ENV") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// ── Security Headers ──────────────────────────────────
	r.Use(middleware.SecurityHeaders())

	// ── CORS (diperketat, tidak ada wildcard *) ───────────
	r.Use(cors.New(cors.Config{
		AllowOrigins:     getAllowedOrigins(),
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// ── General API Rate Limit ────────────────────────────
	r.Use(middleware.RateLimitAPI())

	// ── Inject DB ke handlers ─────────────────────────────
	h := handlers.NewHandler(DB)

	// ── ROUTES ────────────────────────────────────────────
	api := r.Group("/api")
	{
		// Health check
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok", "version": "3.0.0", "service": "WMS LUTFHI"})
		})

		// ── Auth (public + rate limited) ────────────────
		auth := api.Group("/auth")
		{
			auth.POST("/login", middleware.RateLimitLogin(), h.Login)
			auth.POST("/refresh", h.RefreshToken)
		}

		// ── Protected routes ────────────────────────────
		protected := api.Group("/")
		protected.Use(middleware.AuthMiddleware())
		protected.Use(middleware.AuditLogger()) // ← Audit semua aksi
		{
			// Users & Profile
			protected.GET("/users/me", h.GetMe)
			protected.PUT("/users/me", h.UpdateMe)
			protected.PUT("/users/me/password", h.ChangePassword)
			protected.GET("/users", middleware.RequireRole("admin"), h.GetUsers)
			protected.POST("/users", middleware.RequireRole("admin"), h.CreateUser)
			protected.PUT("/users/:id", middleware.RequireRole("admin"), h.UpdateUser)
			protected.DELETE("/users/:id", middleware.RequireRole("admin"), h.DeleteUser)

			// Departments
			protected.GET("/departments", h.GetDepartments)
			protected.POST("/departments", middleware.RequireRole("admin"), h.CreateDepartment)
			protected.PUT("/departments/:id", middleware.RequireRole("admin"), h.UpdateDepartment)
			protected.DELETE("/departments/:id", middleware.RequireRole("admin"), h.DeleteDepartment)

			// Warehouses
			protected.GET("/warehouses", h.GetWarehouses)
			protected.POST("/warehouses", middleware.RequireRole("admin"), h.CreateWarehouse)
			protected.PUT("/warehouses/:id", middleware.RequireRole("admin"), h.UpdateWarehouse)
			protected.DELETE("/warehouses/:id", middleware.RequireRole("admin"), h.DeleteWarehouse)

			// Locations (Rak/Bin dalam gudang)
			protected.GET("/locations", h.GetLocations)
			protected.POST("/locations", middleware.RequireRole("admin", "staff"), h.CreateLocation)
			protected.PUT("/locations/:id", middleware.RequireRole("admin"), h.UpdateLocation)
			protected.DELETE("/locations/:id", middleware.RequireRole("admin"), h.DeleteLocation)

			// Categories (full CRUD)
			protected.GET("/categories", h.GetCategories)
			protected.POST("/categories", middleware.RequireRole("admin"), h.CreateCategory)
			protected.PUT("/categories/:id", middleware.RequireRole("admin"), h.UpdateCategory)
			protected.DELETE("/categories/:id", middleware.RequireRole("admin"), h.DeleteCategory)

			// Units (full CRUD)
			protected.GET("/units", h.GetUnits)
			protected.POST("/units", middleware.RequireRole("admin"), h.CreateUnit)
			protected.PUT("/units/:id", middleware.RequireRole("admin"), h.UpdateUnit)
			protected.DELETE("/units/:id", middleware.RequireRole("admin"), h.DeleteUnit)

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
			protected.GET("/items/export/csv", h.ExportItemsCSV)

			// Inbound (Barang Masuk / GRN)
			protected.GET("/inbound", h.GetInbound)
			protected.POST("/inbound", middleware.RequireRole("admin", "staff"), h.CreateInbound)
			protected.GET("/inbound/:id", h.GetInboundDetail)
			protected.PUT("/inbound/:id/confirm", middleware.RequireRole("admin", "staff"), h.ConfirmInbound)

			// Outbound (Barang Keluar)
			protected.GET("/outbound", h.GetOutbound)
			protected.POST("/outbound", middleware.RequireRole("admin", "staff"), h.CreateOutbound)
			protected.GET("/outbound/:id", h.GetOutboundDetail)

			// Delivery Orders / Surat Jalan
			protected.GET("/delivery-orders", h.GetDeliveryOrders)
			protected.POST("/delivery-orders", middleware.RequireRole("admin", "staff"), h.CreateDeliveryOrder)
			protected.GET("/delivery-orders/:id", h.GetDeliveryOrderDetail)
			protected.PUT("/delivery-orders/:id/confirm", middleware.RequireRole("admin", "staff"), h.ConfirmDelivery)

			// Returns / Retur Barang
			protected.GET("/returns", h.GetReturns)
			protected.POST("/returns", middleware.RequireRole("admin", "staff", "finance_procurement"), h.CreateReturn)
			protected.GET("/returns/:id", h.GetReturnDetail)
			protected.PUT("/returns/:id/approve", middleware.RequireRole("admin"), h.ApproveReturn)
			protected.PUT("/returns/:id/reject", middleware.RequireRole("admin"), h.RejectReturn)

			// Requests (SPB)
			protected.GET("/requests", h.GetRequests)
			protected.POST("/requests", middleware.RequireRole("admin", "staff", "requester"), h.CreateRequest)
			protected.GET("/requests/:id", h.GetRequestDetail)
			protected.PUT("/requests/:id/approve", middleware.RequireRole("admin"), h.ApproveRequest)
			protected.PUT("/requests/:id/reject", middleware.RequireRole("admin"), h.RejectRequest)

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

			// Reports (Advanced)
			protected.GET("/reports/kartu-stok", h.GetKartuStok)
			protected.GET("/reports/stock-valuation", h.GetStockValuation)
			protected.GET("/reports/aging-invoice", middleware.RequireRole("admin", "finance_procurement", "manager"), h.GetAgingInvoice)
			protected.GET("/reports/budget-realization", middleware.RequireRole("admin", "finance_procurement", "manager"), h.GetBudgetRealization)

			// Dashboard stats
			protected.GET("/dashboard/stats", h.GetDashboardStats)

			// AI Chat
			protected.POST("/ai/chat", h.AIChat)

			// ERP
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
				erp.GET("/invoices/export/csv", h.ExportInvoicesCSV)

				erp.GET("/budgets", h.GetBudgets)
				erp.POST("/budgets", middleware.RequireRole("admin", "finance_procurement"), h.CreateBudget)

				erp.GET("/reorder-configs", h.GetReorderConfigs)
				erp.POST("/reorder-configs", middleware.RequireRole("admin", "finance_procurement"), h.CreateReorderConfig)
				erp.DELETE("/reorder-configs/:id", middleware.RequireRole("admin", "finance_procurement"), h.DeleteReorderConfig)

				erp.GET("/reports/summary", h.GetERPSummary)
			}
		}
	}

	// Koyeb/Heroku inject PORT, fall back to APP_PORT
	port := getEnv("PORT", getEnv("APP_PORT", "8080"))
	log.Printf("🚀 WMS LUTFHI Backend v3.0 running on port %s", port)
	log.Printf("📡 API: http://localhost:%s/api/health", port)
	log.Printf("🔒 CORS allowed origins: %v", getAllowedOrigins())

	if err := r.Run(":" + port); err != nil {
		log.Fatalf("❌ Server failed: %v", err)
	}
}

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env dari backend/ atau gunakan flag
	godotenv.Load("../.env")
	godotenv.Load(".env")

	// Production DB credentials (dari backend-php/config/database.php)
	host := envOr("DB_HOST", "arzano-db.id.rapidplex.com")
	port := envOr("DB_PORT", "3306")
	dbname := envOr("DB_NAME", "pitiagic_wms_lutfhi")
	user := envOr("DB_USER", "pitiagic_wms_user")
	pass := envOr("DB_PASSWORD", "Wms2026SecureDb")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True", user, pass, host, port, dbname)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("❌ Failed to open database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("❌ Cannot connect to database: %v", err)
	}
	fmt.Println("✅ Connected to database:", dbname, "@", host)

	// Create midtrans_orders table
	sql_create := `
		CREATE TABLE IF NOT EXISTS midtrans_orders (
			id VARCHAR(36) PRIMARY KEY,
			invoice_id VARCHAR(36) NOT NULL,
			order_id VARCHAR(100) NOT NULL UNIQUE,
			amount BIGINT DEFAULT 0,
			status VARCHAR(20) DEFAULT 'pending',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_order_id (order_id),
			INDEX idx_invoice_id (invoice_id),
			INDEX idx_status (status),
			CONSTRAINT fk_midtrans_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`

	_, err = db.Exec(sql_create)
	if err != nil {
		log.Fatalf("❌ Failed to create table: %v", err)
	}
	fmt.Println("✅ Table midtrans_orders created successfully!")

	// Verify
	var count int
	db.QueryRow("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=? AND table_name='midtrans_orders'", dbname).Scan(&count)
	if count > 0 {
		fmt.Println("✅ Verified: midtrans_orders table exists in", dbname)
	}

	// Check if MIDTRANS_SERVER_KEY is set
	key := os.Getenv("MIDTRANS_SERVER_KEY")
	if key == "" || key == "Mid-server-YOUR_SERVER_KEY_HERE" {
		fmt.Println("\n⚠️  PENTING: MIDTRANS_SERVER_KEY belum di-set!")
		fmt.Println("   Dapatkan dari: https://dashboard.sandbox.midtrans.com/settings/config_info")
		fmt.Println("   Lalu set di .env: MIDTRANS_SERVER_KEY=Mid-server-xxxxx")
	} else {
		fmt.Println("✅ MIDTRANS_SERVER_KEY is configured")
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

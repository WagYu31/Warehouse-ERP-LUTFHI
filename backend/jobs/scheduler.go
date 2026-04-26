package jobs

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"wms-lutfhi/services"
)

// StartScheduler — jalankan semua cron jobs di background goroutine
func StartScheduler(db *sql.DB) {
	log.Println("⏰ Scheduler started")

	go func() {
		for {
			now := time.Now()
			// Jalankan jam 07:00 setiap hari
			next := time.Date(now.Year(), now.Month(), now.Day(), 7, 0, 0, 0, now.Location())
			if now.After(next) {
				next = next.Add(24 * time.Hour)
			}
			sleepDuration := time.Until(next)
			log.Printf("⏰ Next scheduled job: %s (in %s)", next.Format("2006-01-02 15:04"), sleepDuration.Round(time.Minute))
			time.Sleep(sleepDuration)

			runDailyJobs(db)
		}
	}()

	// Jalankan juga langsung saat startup (setelah 30 detik delay)
	go func() {
		time.Sleep(30 * time.Second)
		log.Println("⏰ Running startup jobs check...")
		checkLowStock(db)
		checkOverdueInvoices(db)
	}()
}

func runDailyJobs(db *sql.DB) {
	log.Println("⏰ Running daily jobs...")
	checkLowStock(db)
	checkOverdueInvoices(db)
	log.Println("⏰ Daily jobs complete")
}

// checkLowStock — cek stok kritis, insert notifikasi, kirim email
func checkLowStock(db *sql.DB) {
	rows, err := db.Query(`
		SELECT i.name, i.sku, s.current_stock, i.min_stock, w.name as warehouse
		FROM items i
		JOIN item_stocks s ON i.id=s.item_id
		JOIN warehouses w ON s.warehouse_id=w.id
		WHERE s.current_stock <= i.min_stock AND i.is_active=true
		ORDER BY s.current_stock ASC`)
	if err != nil {
		log.Printf("⚠️ checkLowStock error: %v", err)
		return
	}
	defer rows.Close()

	var items []map[string]interface{}
	for rows.Next() {
		var name, sku, warehouse string
		var stock, minStock int
		rows.Scan(&name, &sku, &stock, &minStock, &warehouse)
		items = append(items, map[string]interface{}{
			"name": name, "sku": sku, "current_stock": stock,
			"min_stock": minStock, "warehouse": warehouse,
		})

		// Insert notifikasi ke DB
		db.Exec(`
			INSERT INTO notifications (id, title, message, type, is_read, created_at)
			VALUES (UUID(), ?, ?, 'warning', false, NOW())
			ON CONFLICT DO NOTHING`,
			"Stok Kritis: "+name,
			fmt.Sprintf("%s (SKU: %s) hanya %d unit di gudang %s, min: %d", name, sku, stock, warehouse, minStock),
		)
	}

	if len(items) == 0 {
		log.Println("✅ checkLowStock: semua stok normal")
		return
	}

	log.Printf("⚠️ checkLowStock: %d item kritis", len(items))

	// Kirim email ke admin
	adminEmails := getAdminEmails(db)
	if len(adminEmails) > 0 {
		msg := services.EmailLowStock(items)
		msg.To = adminEmails
		if err := services.SendEmail(msg); err != nil {
			log.Printf("⚠️ Email stok kritis gagal: %v", err)
		} else {
			log.Printf("📧 Email stok kritis terkirim ke: %s", strings.Join(adminEmails, ", "))
		}
	}
}

// checkOverdueInvoices — cek invoice jatuh tempo, insert notifikasi, kirim email
func checkOverdueInvoices(db *sql.DB) {
	rows, err := db.Query(`
		SELECT i.id, i.invoice_number, COALESCE(s.name,''), i.due_date,
		       i.total_amount, COALESCE(i.remaining_amount, i.total_amount)
		FROM invoices i
		LEFT JOIN suppliers s ON i.supplier_id=s.id
		WHERE i.status NOT IN ('paid','cancelled')
		  AND i.due_date < NOW()
		ORDER BY i.due_date ASC`)
	if err != nil {
		log.Printf("⚠️ checkOverdueInvoices error: %v", err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, invNum, supplier string
		var dueDate time.Time
		var total, remaining float64
		rows.Scan(&id, &invNum, &supplier, &dueDate, &total, &remaining)

		daysOverdue := int(time.Since(dueDate).Hours() / 24)

		// Notifikasi tiap H-0, H-3, H-7 yang masih belum bayar
		db.Exec(`
			INSERT INTO notifications (id, title, message, type, is_read, created_at)
			VALUES (UUID(), ?, ?, 'error', false, NOW())`,
			fmt.Sprintf("Invoice %s Overdue %d Hari", invNum, daysOverdue),
			fmt.Sprintf("Invoice %s dari %s sudah lewat %d hari, sisa Rp %.0f", invNum, supplier, daysOverdue, remaining),
		)

		count++
	}

	log.Printf("⚠️ checkOverdueInvoices: %d invoice overdue", count)

	// Kirim email summary ke finance
	if count > 0 {
		financeEmails := getFinanceEmails(db)
		if len(financeEmails) > 0 && os.Getenv("SMTP_HOST") != "" {
			log.Printf("📧 Mengirim email invoice overdue ke: %s", strings.Join(financeEmails, ", "))
		}
	}
}

func getAdminEmails(db *sql.DB) []string {
	rows, _ := db.Query(`SELECT email FROM users WHERE role='admin' AND is_active=true`)
	defer rows.Close()
	var emails []string
	for rows.Next() {
		var email string
		rows.Scan(&email)
		emails = append(emails, email)
	}
	return emails
}

func getFinanceEmails(db *sql.DB) []string {
	rows, _ := db.Query(`SELECT email FROM users WHERE role IN ('admin','finance_procurement') AND is_active=true`)
	defer rows.Close()
	var emails []string
	for rows.Next() {
		var email string
		rows.Scan(&email)
		emails = append(emails, email)
	}
	return emails
}

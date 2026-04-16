package services

import (
	"fmt"
	"net/smtp"
	"os"
	"strings"
)

// EmailMessage — struktur pesan email
type EmailMessage struct {
	To      []string
	Subject string
	Body    string // HTML
}

// SendEmail — kirim email via SMTP
func SendEmail(msg EmailMessage) error {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASSWORD")
	from := os.Getenv("SMTP_FROM")

	if host == "" || user == "" {
		return fmt.Errorf("SMTP not configured")
	}
	if port == "" { port = "587" }
	if from == "" { from = user }

	auth := smtp.PlainAuth("", user, pass, host)
	to := strings.Join(msg.To, ", ")

	body := "From: " + from + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + msg.Subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=UTF-8\r\n\r\n" +
		msg.Body

	return smtp.SendMail(host+":"+port, auth, user, msg.To, []byte(body))
}

// EmailInvoiceOverdue — template email invoice jatuh tempo
func EmailInvoiceOverdue(invoiceNum, supplierName, dueDate string, amount float64, daysOverdue int) EmailMessage {
	return EmailMessage{
		Subject: fmt.Sprintf("⚠️ Invoice %s Jatuh Tempo %d Hari Lalu — WMS LUTFHI", invoiceNum, daysOverdue),
		Body: fmt.Sprintf(`
<html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto">
  <div style="background:#1E3A5F;color:white;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="margin:0">⚠️ Peringatan Invoice Jatuh Tempo</h2>
    <p style="margin:5px 0 0;opacity:0.8">WMS LUTFHI — Sistem Manajemen Gudang</p>
  </div>
  <div style="background:#fff;padding:20px;border:1px solid #ddd;border-top:none">
    <p>Invoice berikut telah melewati tanggal jatuh tempo:</p>
    <table style="width:100%%;border-collapse:collapse;margin:15px 0">
      <tr style="background:#f5f5f5"><td style="padding:10px;border:1px solid #ddd"><b>No. Invoice</b></td><td style="padding:10px;border:1px solid #ddd">%s</td></tr>
      <tr><td style="padding:10px;border:1px solid #ddd"><b>Supplier</b></td><td style="padding:10px;border:1px solid #ddd">%s</td></tr>
      <tr style="background:#f5f5f5"><td style="padding:10px;border:1px solid #ddd"><b>Jatuh Tempo</b></td><td style="padding:10px;border:1px solid #ddd">%s</td></tr>
      <tr><td style="padding:10px;border:1px solid #ddd"><b>Jumlah Tagihan</b></td><td style="padding:10px;border:1px solid #ddd;color:#e53e3e;font-weight:bold">Rp %.0f</td></tr>
      <tr style="background:#fff3cd"><td style="padding:10px;border:1px solid #ddd"><b>Terlambat</b></td><td style="padding:10px;border:1px solid #ddd;color:#e53e3e;font-weight:bold">%d hari</td></tr>
    </table>
    <p>Segera lakukan pembayaran atau konfirmasi ke tim keuangan.</p>
    <a href="http://localhost:3000/erp/invoices" style="background:#1E3A5F;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;display:inline-block">
      Lihat Invoice di Sistem →
    </a>
  </div>
  <div style="background:#f5f5f5;padding:10px;border-radius:0 0 8px 8px;font-size:12px;color:#666;text-align:center">
    Email ini dikirim otomatis oleh WMS LUTFHI. Jangan membalas email ini.
  </div>
</body></html>`,
			invoiceNum, supplierName, dueDate, amount, daysOverdue),
	}
}

// EmailLowStock — template email stok kritis
func EmailLowStock(items []map[string]interface{}) EmailMessage {
	rows := ""
	for _, item := range items {
		rows += fmt.Sprintf(`<tr>
      <td style="padding:8px;border:1px solid #ddd">%v</td>
      <td style="padding:8px;border:1px solid #ddd;font-family:monospace">%v</td>
      <td style="padding:8px;border:1px solid #ddd;color:#e53e3e;font-weight:bold">%v</td>
      <td style="padding:8px;border:1px solid #ddd">%v</td>
      <td style="padding:8px;border:1px solid #ddd">%v</td>
    </tr>`, item["name"], item["sku"], item["current_stock"], item["min_stock"], item["warehouse"])
	}

	return EmailMessage{
		Subject: fmt.Sprintf("🚨 Alert: %d Item Stok Kritis — WMS LUTFHI", len(items)),
		Body: fmt.Sprintf(`
<html><body style="font-family:Arial,sans-serif;color:#333;max-width:700px;margin:0 auto">
  <div style="background:#c53030;color:white;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="margin:0">🚨 Peringatan Stok Kritis</h2>
    <p style="margin:5px 0 0;opacity:0.8">%d item di bawah stok minimum — WMS LUTFHI</p>
  </div>
  <div style="background:#fff;padding:20px;border:1px solid #ddd;border-top:none">
    <p>Item berikut perlu segera di-restock:</p>
    <table style="width:100%%;border-collapse:collapse;margin:15px 0">
      <thead>
        <tr style="background:#c53030;color:white">
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Item</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">SKU</th>
          <th style="padding:8px;border:1px solid #ddd">Stok Saat Ini</th>
          <th style="padding:8px;border:1px solid #ddd">Stok Min</th>
          <th style="padding:8px;border:1px solid #ddd">Gudang</th>
        </tr>
      </thead>
      <tbody>%s</tbody>
    </table>
    <a href="http://localhost:3000/inventory" style="background:#c53030;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;display:inline-block">
      Lihat Inventaris →
    </a>
  </div>
  <div style="background:#f5f5f5;padding:10px;border-radius:0 0 8px 8px;font-size:12px;color:#666;text-align:center">
    Email otomatis WMS LUTFHI — dikirim setiap hari pukul 07:00
  </div>
</body></html>`, len(items), rows),
	}
}

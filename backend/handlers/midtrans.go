package handlers

import (
	"bytes"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ══════════════════════════════════════════════════════════════
//  MIDTRANS SNAP PAYMENT INTEGRATION
// ══════════════════════════════════════════════════════════════

// getMidtransServerKey returns the Midtrans Server Key from env
func getMidtransServerKey() string {
	return os.Getenv("MIDTRANS_SERVER_KEY")
}

// getMidtransBaseURL returns sandbox or production URL based on env
func getMidtransBaseURL() string {
	if os.Getenv("MIDTRANS_IS_PRODUCTION") == "true" {
		return "https://app.midtrans.com"
	}
	return "https://app.sandbox.midtrans.com"
}

// ── Create Snap Token ─────────────────────────────────────────
// POST /erp/invoices/:id/snap-token
// Creates a Midtrans Snap token for paying an invoice
func (h *Handler) CreateSnapToken(c *gin.Context) {
	invoiceID := c.Param("id")
	serverKey := getMidtransServerKey()

	if serverKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Midtrans Server Key belum dikonfigurasi. Set MIDTRANS_SERVER_KEY di .env",
		})
		return
	}

	// ── Fetch invoice data ────────────────────────────────
	var invNum, status, supplierName string
	var totalAmount, paidAmount, remainingAmount float64

	err := h.DB.QueryRow(`
		SELECT i.invoice_number, i.status, i.total_amount,
		       COALESCE(i.paid_amount,0), COALESCE(i.remaining_amount,0),
		       COALESCE(s.name,'Supplier')
		FROM invoices i
		LEFT JOIN suppliers s ON i.supplier_id = s.id
		WHERE i.id = ?`, invoiceID).
		Scan(&invNum, &status, &totalAmount, &paidAmount, &remainingAmount, &supplierName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Invoice tidak ditemukan"})
		return
	}

	if status == "paid" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invoice sudah lunas"})
		return
	}

	// ── Calculate amount to pay ───────────────────────────
	amountToPay := remainingAmount
	if amountToPay <= 0 {
		amountToPay = totalAmount - paidAmount
	}
	if amountToPay <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Tidak ada sisa tagihan"})
		return
	}

	// Round to avoid floating point issues
	grossAmount := int64(math.Round(amountToPay))

	// ── Build unique order ID ─────────────────────────────
	// Format: WMS-INV-{invoiceID_short}-{timestamp}
	orderID := fmt.Sprintf("WMS-%s-%d", invNum, time.Now().Unix())

	// ── Build Snap API request ────────────────────────────
	snapReq := map[string]interface{}{
		"transaction_details": map[string]interface{}{
			"order_id":     orderID,
			"gross_amount": grossAmount,
		},
		"item_details": []map[string]interface{}{
			{
				"id":       invoiceID,
				"price":    grossAmount,
				"quantity": 1,
				"name":     truncate(fmt.Sprintf("Invoice %s - %s", invNum, supplierName), 50),
			},
		},
		"customer_details": map[string]interface{}{
			"first_name": c.GetString("user_name"),
			"email":      c.GetString("user_email"),
		},
		"callbacks": map[string]interface{}{
			"finish": os.Getenv("MIDTRANS_FINISH_URL"),
		},
	}

	reqBody, _ := json.Marshal(snapReq)

	// ── Call Midtrans Snap API ─────────────────────────────
	snapURL := getMidtransBaseURL() + "/snap/v1/transactions"
	req, err := http.NewRequest("POST", snapURL, bytes.NewBuffer(reqBody))
	if err != nil {
		log.Printf("❌ Midtrans request build error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal mempersiapkan pembayaran"})
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	// Midtrans uses HTTP Basic Auth with Server Key as username, empty password
	req.SetBasicAuth(serverKey, "")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Midtrans API call error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal menghubungi Midtrans"})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var snapResp map[string]interface{}
	if err := json.Unmarshal(body, &snapResp); err != nil {
		log.Printf("❌ Midtrans response parse error: %v, body: %s", err, string(body))
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Respons Midtrans tidak valid"})
		return
	}

	// ── Check for errors ──────────────────────────────────
	if errMsgs, ok := snapResp["error_messages"]; ok {
		log.Printf("❌ Midtrans error: %v", errMsgs)
		// Extract first error message for user display
		if msgs, ok := errMsgs.([]interface{}); ok && len(msgs) > 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": fmt.Sprintf("Gagal buat snap token: %v", msgs[0]),
			})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"message": "Gagal buat snap token dari Midtrans"})
		return
	}

	token, ok := snapResp["token"].(string)
	if !ok || token == "" {
		log.Printf("❌ Midtrans: no token in response: %s", string(body))
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Token pembayaran tidak diterima"})
		return
	}

	// ── Store order_id mapping for webhook reconciliation ──
	h.DB.Exec(`
		INSERT INTO midtrans_orders (id, invoice_id, order_id, amount, status, created_at)
		VALUES (?, ?, ?, ?, 'pending', NOW())
		ON DUPLICATE KEY UPDATE order_id=VALUES(order_id), amount=VALUES(amount), updated_at=NOW()`,
		uuid.New().String(), invoiceID, orderID, grossAmount)

	log.Printf("✅ Midtrans snap token created for invoice %s, order_id: %s", invNum, orderID)

	c.JSON(http.StatusOK, gin.H{
		"token":        token,
		"redirect_url": snapResp["redirect_url"],
		"order_id":     orderID,
	})
}

// ── Midtrans Webhook Notification ─────────────────────────────
// POST /erp/midtrans/notification (PUBLIC — no auth required)
// Receives payment status updates from Midtrans
func (h *Handler) MidtransNotification(c *gin.Context) {
	var notification map[string]interface{}
	if err := c.ShouldBindJSON(&notification); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid notification"})
		return
	}

	orderID, _ := notification["order_id"].(string)
	transactionStatus, _ := notification["transaction_status"].(string)
	fraudStatus, _ := notification["fraud_status"].(string)
	statusCode, _ := notification["status_code"].(string)
	grossAmount, _ := notification["gross_amount"].(string)
	signatureKey, _ := notification["signature_key"].(string)

	log.Printf("📨 Midtrans notification: order_id=%s, status=%s, fraud=%s", orderID, transactionStatus, fraudStatus)

	// ── Verify signature ──────────────────────────────────
	serverKey := getMidtransServerKey()
	if serverKey != "" && signatureKey != "" {
		hash := sha512.New()
		hash.Write([]byte(orderID + statusCode + grossAmount + serverKey))
		calculatedSignature := hex.EncodeToString(hash.Sum(nil))

		if calculatedSignature != signatureKey {
			log.Printf("❌ Midtrans signature mismatch for order %s", orderID)
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid signature"})
			return
		}
	}

	// ── Find invoice from order mapping ───────────────────
	var invoiceID, currentMidtransStatus string
	var midtransAmount float64
	err := h.DB.QueryRow(`SELECT invoice_id, status, COALESCE(amount,0) FROM midtrans_orders WHERE order_id=?`, orderID).
		Scan(&invoiceID, &currentMidtransStatus, &midtransAmount)
	if err != nil {
		log.Printf("⚠️ Midtrans notification for unknown order_id: %s", orderID)
		// Return 200 to prevent Midtrans from retrying
		c.JSON(http.StatusOK, gin.H{"message": "Order not found, acknowledged"})
		return
	}

	// ── Idempotency check ─────────────────────────────────
	if currentMidtransStatus == "settlement" || currentMidtransStatus == "paid" {
		log.Printf("ℹ️ Order %s already settled, skipping", orderID)
		c.JSON(http.StatusOK, gin.H{"message": "Already processed"})
		return
	}

	// ── Process based on status ───────────────────────────
	switch transactionStatus {
	case "capture":
		if fraudStatus == "accept" {
			h.processPaymentSuccess(invoiceID, orderID, grossAmount, midtransAmount)
		}
	case "settlement":
		h.processPaymentSuccess(invoiceID, orderID, grossAmount, midtransAmount)
	case "pending":
		h.DB.Exec(`UPDATE midtrans_orders SET status='pending', updated_at=NOW() WHERE order_id=?`, orderID)
	case "deny", "cancel", "expire":
		h.DB.Exec(`UPDATE midtrans_orders SET status=?, snap_token='', updated_at=NOW() WHERE order_id=?`,
			transactionStatus, orderID)
		log.Printf("ℹ️ Order %s status: %s", orderID, transactionStatus)
	case "refund", "partial_refund":
		h.DB.Exec(`UPDATE midtrans_orders SET status='refunded', updated_at=NOW() WHERE order_id=?`, orderID)
		log.Printf("ℹ️ Order %s refunded", orderID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "OK"})
}

// processPaymentSuccess handles successful payment from Midtrans
func (h *Handler) processPaymentSuccess(invoiceID, orderID, grossAmountStr string, fallbackAmount float64) {
	log.Printf("✅ Processing payment success for invoice %s, order %s", invoiceID, orderID)

	// Parse gross amount from webhook, fallback to stored amount
	var grossAmount float64
	fmt.Sscanf(grossAmountStr, "%f", &grossAmount)
	if grossAmount <= 0 {
		grossAmount = fallbackAmount
	}

	tx, err := h.DB.Begin()
	if err != nil {
		log.Printf("❌ Failed to begin transaction: %v", err)
		return
	}

	// ── Update midtrans_orders status ─────────────────────
	tx.Exec(`UPDATE midtrans_orders SET status='settlement', updated_at=NOW() WHERE order_id=?`, orderID)

	// ── Record payment in payments table ──────────────────
	paymentID := uuid.New().String()
	tx.Exec(`INSERT INTO payments (id, invoice_id, amount, payment_date, payment_method, notes, created_by)
		VALUES (?, ?, ?, NOW(), 'midtrans', ?, 'system')`,
		paymentID, invoiceID, grossAmount,
		fmt.Sprintf("Midtrans payment - Order ID: %s", orderID))

	// ── Update invoice amounts ────────────────────────────
	var remaining float64
	tx.QueryRow(`SELECT COALESCE(remaining_amount, total_amount - COALESCE(paid_amount,0)) FROM invoices WHERE id=?`,
		invoiceID).Scan(&remaining)

	newPaid := 0.0
	tx.QueryRow(`SELECT COALESCE(paid_amount,0) + ? FROM invoices WHERE id=?`, grossAmount, invoiceID).Scan(&newPaid)
	newRemaining := remaining - grossAmount
	newStatus := "partial"
	if newRemaining <= 0 {
		newStatus = "paid"
		newRemaining = 0
	}

	tx.Exec(`UPDATE invoices SET paid_amount=?, remaining_amount=?, status=?, updated_at=NOW() WHERE id=?`,
		newPaid, newRemaining, newStatus, invoiceID)

	if err := tx.Commit(); err != nil {
		log.Printf("❌ Failed to commit payment: %v", err)
		return
	}

	log.Printf("✅ Invoice %s updated: paid=%.0f, remaining=%.0f, status=%s", invoiceID, newPaid, newRemaining, newStatus)
}

// ── Check & Sync Payment Status ──────────────────────────────
// POST /erp/invoices/:id/check-payment
// Queries Midtrans API directly to sync invoice status (webhook fallback)
func (h *Handler) CheckPaymentStatus(c *gin.Context) {
	invoiceID := c.Param("id")
	serverKey := getMidtransServerKey()

	if serverKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Server key tidak dikonfigurasi"})
		return
	}

	// ── Ambil order_id terbaru yang masih pending ──────────
	var orderID, midtransStatus string
	var storedAmount float64
	err := h.DB.QueryRow(`
		SELECT order_id, COALESCE(status,'pending'), COALESCE(amount,0)
		FROM midtrans_orders
		WHERE invoice_id=? AND status NOT IN ('settlement','paid')
		ORDER BY created_at DESC LIMIT 1`, invoiceID).
		Scan(&orderID, &midtransStatus, &storedAmount)
	if err != nil {
		// Tidak ada pending order, cek status invoice saja
		var status string
		h.DB.QueryRow(`SELECT status FROM invoices WHERE id=?`, invoiceID).Scan(&status)
		c.JSON(http.StatusOK, gin.H{"message": "Tidak ada transaksi pending", "invoice_status": status})
		return
	}

	// ── Query Midtrans Transaction Status API ──────────────
	statusURL := getMidtransBaseURL() + "/v2/" + orderID + "/status"
	req, err := http.NewRequest("GET", statusURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal buat request ke Midtrans"})
		return
	}
	req.SetBasicAuth(serverKey, "")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Midtrans status check error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal hubungi Midtrans"})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var mtResp map[string]interface{}
	if err := json.Unmarshal(body, &mtResp); err != nil {
		log.Printf("❌ Midtrans status parse error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Respons Midtrans tidak valid"})
		return
	}

	transactionStatus, _ := mtResp["transaction_status"].(string)
	fraudStatus, _ := mtResp["fraud_status"].(string)
	grossAmount, _ := mtResp["gross_amount"].(string)

	log.Printf("📊 Midtrans status check: order=%s, status=%s, fraud=%s", orderID, transactionStatus, fraudStatus)

	// ── Proses berdasarkan status ──────────────────────────
	switch transactionStatus {
	case "settlement":
		h.processPaymentSuccess(invoiceID, orderID, grossAmount, storedAmount)
		var newStatus string
		h.DB.QueryRow(`SELECT status FROM invoices WHERE id=?`, invoiceID).Scan(&newStatus)
		c.JSON(http.StatusOK, gin.H{
			"message":        "✅ Pembayaran dikonfirmasi dan invoice diperbarui!",
			"synced":         true,
			"invoice_status": newStatus,
		})
		return
	case "capture":
		if fraudStatus == "accept" {
			h.processPaymentSuccess(invoiceID, orderID, grossAmount, storedAmount)
			var newStatus string
			h.DB.QueryRow(`SELECT status FROM invoices WHERE id=?`, invoiceID).Scan(&newStatus)
			c.JSON(http.StatusOK, gin.H{
				"message":        "✅ Pembayaran dikonfirmasi dan invoice diperbarui!",
				"synced":         true,
				"invoice_status": newStatus,
			})
			return
		}
	case "pending":
		c.JSON(http.StatusOK, gin.H{
			"message":           "⏳ Pembayaran masih pending di Midtrans",
			"synced":            false,
			"invoice_status":    midtransStatus,
			"transaction_status": transactionStatus,
		})
		return
	case "deny", "cancel", "expire":
		h.DB.Exec(`UPDATE midtrans_orders SET status=?, updated_at=NOW() WHERE order_id=?`, transactionStatus, orderID)
		var invStatus string
		h.DB.QueryRow(`SELECT status FROM invoices WHERE id=?`, invoiceID).Scan(&invStatus)
		c.JSON(http.StatusOK, gin.H{
			"message":            fmt.Sprintf("Transaksi %s", transactionStatus),
			"synced":             false,
			"invoice_status":     invStatus,
			"transaction_status": transactionStatus,
		})
		return
	}

	// Status tidak diketahui / belum ada transaksi di Midtrans
	var invStatus string
	h.DB.QueryRow(`SELECT status FROM invoices WHERE id=?`, invoiceID).Scan(&invStatus)
	c.JSON(http.StatusOK, gin.H{
		"message":            "Status transaksi: " + transactionStatus,
		"synced":             false,
		"invoice_status":     invStatus,
		"transaction_status": transactionStatus,
	})
}

// ── Helper: truncate string ───────────────────────────────────
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

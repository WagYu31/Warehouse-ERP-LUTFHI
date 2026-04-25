package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ══════════════════════════════════════════════════════════════
//  AI CHAT — Groq LLaMA with real-time WMS context
// ══════════════════════════════════════════════════════════════

type groqMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqRequest struct {
	Model       string    `json:"model"`
	Messages    []groqMsg `json:"messages"`
	MaxTokens   int       `json:"max_tokens"`
	Temperature float64   `json:"temperature"`
	Stream      bool      `json:"stream"`
}

type groqResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// AIChatBody — request body from frontend
type AIChatBody struct {
	Message string `json:"message" binding:"required"`
	History []struct {
		Role string `json:"role"` // "user" | "ai"
		Text string `json:"text"`
	} `json:"history"`
}

func (h *Handler) AIChat(c *gin.Context) {
	var body AIChatBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"reply": "❌ Pesan tidak valid."})
		return
	}

	role := c.GetString("role")
	name := c.GetString("name")
	userID := c.GetString("user_id")

	// ── Build real-time context from DB ──────────────────────
	ctx := h.buildWMSContext(role, userID)
	systemPrompt := buildSystemPrompt(name, role, ctx)

	// ── Build messages list (with history for multi-turn) ────
	msgs := []groqMsg{{Role: "system", Content: systemPrompt}}

	// Keep last 8 history messages max (4 turns) to stay within token limit
	start := 0
	if len(body.History) > 8 {
		start = len(body.History) - 8
	}
	for _, m := range body.History[start:] {
		gmRole := "user"
		if m.Role == "ai" {
			gmRole = "assistant"
		}
		msgs = append(msgs, groqMsg{Role: gmRole, Content: m.Text})
	}
	msgs = append(msgs, groqMsg{Role: "user", Content: body.Message})

	// ── Call Groq API (or fallback) ───────────────────────────
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		c.JSON(http.StatusOK, gin.H{"reply": h.ruleBasedReply(body.Message, ctx)})
		return
	}

	reply, err := callGroqAPI(apiKey, msgs)
	if err != nil {
		// Graceful degradation: return rule-based answer
		c.JSON(http.StatusOK, gin.H{
			"reply": "⚠️ AI sedang sibuk, ini jawaban ringkas:\n\n" + h.ruleBasedReply(body.Message, ctx),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"reply": reply})
}

// ── System prompt builder ─────────────────────────────────────
func buildSystemPrompt(name, role, ctx string) string {
	roleDesc := map[string]string{
		"admin":               "Administrator (akses penuh WMS & ERP)",
		"staff":               "Staf Gudang (operasional barang masuk/keluar)",
		"finance_procurement": "Finance & Procurement (invoice, PO, anggaran)",
		"manager":             "Manager (pantau laporan & ringkasan)",
	}
	desc := roleDesc[role]
	if desc == "" {
		desc = role
	}

	return fmt.Sprintf(`Kamu adalah AI Asisten WMS LUTFHI (Warehouse Management System & ERP).
Pengguna: %s | Jabatan: %s | Tanggal: %s

📊 DATA SISTEM REAL-TIME:
%s

PANDUAN MENJAWAB:
- Gunakan Bahasa Indonesia yang ramah, singkat, dan profesional
- Selalu gunakan data nyata di atas jika relevan dengan pertanyaan pengguna
- Format angka Indonesia: 1.250.000 (titik pemisah ribuan)
- Maksimal 200 kata per jawaban, fokus dan padat
- Gunakan emoji agar mudah dibaca (📦 💰 📊 🚨 ✅)
- Jika tidak ada data relevan, sampaikan dengan jujur
- Jangan membuat data fiktif — hanya gunakan data yang tersedia di atas`,
		name, desc, time.Now().Format("02 January 2006"), ctx)
}

// ── DB context builder by role ────────────────────────────────
func (h *Handler) buildWMSContext(role, userID string) string {
	var sb strings.Builder
	now := time.Now()
	thisMonth := now.Format("2006-01")

	// ── Universal: Inventory overview ──
	var totalItems, criticalItems, totalWarehouses int
	h.DB.QueryRow(`SELECT COUNT(*) FROM items WHERE is_active=true`).Scan(&totalItems)
	h.DB.QueryRow(`SELECT COUNT(DISTINCT i.id) FROM items i
		JOIN item_stocks s ON i.id=s.item_id
		WHERE s.current_stock <= i.min_stock AND i.is_active=true`).Scan(&criticalItems)
	h.DB.QueryRow(`SELECT COUNT(*) FROM warehouses WHERE is_active=true`).Scan(&totalWarehouses)
	sb.WriteString(fmt.Sprintf("📦 Inventaris: %d item aktif | %d item kritis | %d gudang aktif\n",
		totalItems, criticalItems, totalWarehouses))

	// ── Monthly transactions ──
	var inMth, outMth int
	h.DB.QueryRow(`SELECT COUNT(*) FROM inbound_records
		WHERE TO_CHAR(receipt_date,'YYYY-MM')=$1`, thisMonth).Scan(&inMth)
	h.DB.QueryRow(`SELECT COUNT(*) FROM outbound_records
		WHERE TO_CHAR(delivery_date,'YYYY-MM')=$1`, thisMonth).Scan(&outMth)
	sb.WriteString(fmt.Sprintf("🔄 Transaksi bulan ini: %d barang masuk | %d barang keluar\n", inMth, outMth))

	// ── SPB (Requests) ──
	var pendingReq int
	h.DB.QueryRow(`SELECT COUNT(*) FROM requests WHERE status='pending'`).Scan(&pendingReq)
	sb.WriteString(fmt.Sprintf("📋 SPB Pending: %d\n", pendingReq))

	// ── Finance context (finance, admin, manager) ──
	if role == "finance_procurement" || role == "admin" || role == "manager" {
		var totalPO, pendingPO int
		var totalInv, unpaidInv int
		var budgetTotal, budgetUsed float64

		h.DB.QueryRow(`SELECT COUNT(*), COUNT(CASE WHEN status IN ('draft','sent') THEN 1 END)
			FROM purchase_orders`).Scan(&totalPO, &pendingPO)
		h.DB.QueryRow(`SELECT COUNT(*), COUNT(CASE WHEN status IN ('unpaid','overdue') THEN 1 END)
			FROM invoices`).Scan(&totalInv, &unpaidInv)
		h.DB.QueryRow(`SELECT COALESCE(SUM(total_budget),0), COALESCE(SUM(used_budget),0)
			FROM budgets`).Scan(&budgetTotal, &budgetUsed)

		sb.WriteString(fmt.Sprintf("🛒 Purchase Order: %d total | %d pending\n", totalPO, pendingPO))
		sb.WriteString(fmt.Sprintf("📄 Invoice: %d total | %d belum dibayar\n", totalInv, unpaidInv))
		sb.WriteString(fmt.Sprintf("💰 Anggaran: Total Rp %.0f | Terpakai Rp %.0f | Sisa Rp %.0f\n",
			budgetTotal, budgetUsed, budgetTotal-budgetUsed))

		// Overdue invoices
		var overdueCount int
		h.DB.QueryRow(`SELECT COUNT(*) FROM invoices WHERE status='overdue'`).Scan(&overdueCount)
		if overdueCount > 0 {
			sb.WriteString(fmt.Sprintf("🚨 Invoice OVERDUE: %d (perlu tindakan segera!)\n", overdueCount))
		}
	}

	// ── Top 5 critical items ──
	rows, err := h.DB.Query(`
		SELECT i.name, i.sku, i.min_stock, COALESCE(SUM(s.current_stock),0) as curr
		FROM items i JOIN item_stocks s ON i.id=s.item_id
		WHERE s.current_stock <= i.min_stock AND i.is_active=true
		GROUP BY i.id, i.name, i.sku, i.min_stock
		ORDER BY curr ASC LIMIT 5`)
	if err == nil {
		defer rows.Close()
		sb.WriteString("🚨 5 Item Paling Kritis:\n")
		found := false
		for rows.Next() {
			found = true
			var name, sku string
			var minStock, curr int
			rows.Scan(&name, &sku, &minStock, &curr)
			sb.WriteString(fmt.Sprintf("  • %s [%s]: stok %d / min %d\n", name, sku, curr, minStock))
		}
		if !found {
			sb.WriteString("  (tidak ada item kritis saat ini ✅)\n")
		}
	}

	// ── Stock opname pending ──
	var opnamePending int
	h.DB.QueryRow(`SELECT COUNT(*) FROM stock_opnames WHERE status='in_progress'`).Scan(&opnamePending)
	if opnamePending > 0 {
		sb.WriteString(fmt.Sprintf("📋 Stock Opname sedang berjalan: %d\n", opnamePending))
	}

	return sb.String()
}

// ── Groq API HTTP call ────────────────────────────────────────
func callGroqAPI(apiKey string, msgs []groqMsg) (string, error) {
	payload := groqRequest{
		Model:       "llama-3.1-8b-instant",
		Messages:    msgs,
		MaxTokens:   450,
		Temperature: 0.65,
		Stream:      false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var gr groqResponse
	if err := json.Unmarshal(respBody, &gr); err != nil {
		return "", fmt.Errorf("parse error: %w", err)
	}
	if gr.Error != nil {
		return "", fmt.Errorf("groq error: %s", gr.Error.Message)
	}
	if len(gr.Choices) == 0 {
		return "", fmt.Errorf("empty response from groq")
	}
	return strings.TrimSpace(gr.Choices[0].Message.Content), nil
}

// ── Rule-based fallback (no API key) ─────────────────────────
func (h *Handler) ruleBasedReply(msg, ctx string) string {
	lower := strings.ToLower(msg)
	switch {
	case containsAny(lower, "kritis", "critical", "minimum", "min stock", "habis"):
		return "🚨 Berikut kondisi stok kritis saat ini:\n\n" + ctx
	case containsAny(lower, "stok", "stock", "inventaris", "barang", "item"):
		return "📦 Ringkasan inventaris saat ini:\n\n" + ctx
	case containsAny(lower, "invoice", "faktur", "tagihan", "pembayaran"):
		return "📄 Status pembayaran & invoice:\n\n" + ctx
	case containsAny(lower, "budget", "anggaran", "biaya"):
		return "💰 Situasi anggaran:\n\n" + ctx
	case containsAny(lower, "po", "purchase order", "pembelian", "pengadaan"):
		return "🛒 Status Purchase Order:\n\n" + ctx
	case containsAny(lower, "transaksi", "masuk", "keluar", "inbound", "outbound"):
		return "🔄 Transaksi bulan ini:\n\n" + ctx
	case containsAny(lower, "ringkasan", "summary", "laporan", "rekap"):
		return "📊 Ringkasan sistem WMS LUTFHI:\n\n" + ctx
	case containsAny(lower, "halo", "hai", "hello", "hi", "selamat"):
		return "👋 Halo! Saya AI Asisten WMS LUTFHI.\n\nSaya bisa bantu cek:\n• 📦 Stok & inventaris\n• 🚨 Item kritis\n• 💰 Anggaran & invoice\n• 🛒 Purchase Order\n• 📊 Laporan transaksi\n\nApa yang ingin Anda tanyakan?"
	default:
		return "🤖 Saya siap membantu tentang WMS & ERP!\n\nCoba tanya:\n• \"Berapa item yang kritis?\"\n• \"Status invoice belum bayar?\"\n• \"Ringkasan anggaran bulan ini?\"\n\n📊 Data sistem:\n" + ctx
	}
}

func containsAny(s string, keywords ...string) bool {
	for _, k := range keywords {
		if strings.Contains(s, k) {
			return true
		}
	}
	return false
}

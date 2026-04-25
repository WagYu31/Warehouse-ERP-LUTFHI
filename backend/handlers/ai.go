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

	return fmt.Sprintf(`Kamu adalah AI Asisten WMS LUTFHI yang cerdas (Warehouse Management System & ERP).
Pengguna: %s | Jabatan: %s | Tanggal: %s

📊 DATA INVENTARIS REAL-TIME (gunakan data ini untuk analisis):
%s

PANDUAN MENJAWAB:
- Bahasa Indonesia, ramah, profesional, padat (maks 250 kata)
- SELALU gunakan data nyata di atas — jangan buat data fiktif
- Format angka: 1.250.000 (titik pemisah ribuan)
- Gunakan emoji agar mudah dibaca
- Jika ditanya rekomendasi/analisis, berikan rekomendasi KONKRET berdasarkan data:
  * Barang bergerak cepat (fast mover) → rekomen PERBANYAK stok / segera restock
  * Barang slow-moving / dead stock → rekomen KURANGI pembelian / jual habis dulu
  * Barang kritis (stok ≤ min) → rekomen RESTOCK SEGERA dengan perkiraan jumlah
- Sertakan nama item, SKU, dan angka spesifik dalam rekomendasi`,
		name, desc, time.Now().Format("02 January 2006"), ctx)
}

// ── DB context builder — fast movers, slow movers, analytics ─
func (h *Handler) buildWMSContext(role, userID string) string {
	var sb strings.Builder
	now      := time.Now()
	thisMon  := now.Format("2006-01")
	ago3m    := now.AddDate(0, -3, 0).Format("2006-01-02")
	ago6m    := now.AddDate(0, -6, 0).Format("2006-01-02")

	// ── 1. Inventory overview ─────────────────────────────
	var totalItems, criticalItems, totalWarehouses int
	h.DB.QueryRow(`SELECT COUNT(*) FROM items WHERE is_active=true`).Scan(&totalItems)
	h.DB.QueryRow(`SELECT COUNT(DISTINCT i.id) FROM items i
		JOIN item_stocks s ON i.id=s.item_id
		WHERE s.current_stock <= i.min_stock AND i.is_active=true`).Scan(&criticalItems)
	h.DB.QueryRow(`SELECT COUNT(*) FROM warehouses WHERE is_active=true`).Scan(&totalWarehouses)
	sb.WriteString(fmt.Sprintf("📦 Inventaris: %d item aktif | %d kritis | %d gudang\n",
		totalItems, criticalItems, totalWarehouses))

	// ── 2. Transaksi bulan ini ────────────────────────────
	var inMth, outMth int
	h.DB.QueryRow(`SELECT COUNT(*) FROM inbound_transactions
		WHERE TO_CHAR(received_date,'YYYY-MM')=$1`, thisMon).Scan(&inMth)
	h.DB.QueryRow(`SELECT COUNT(*) FROM outbound_transactions
		WHERE TO_CHAR(outbound_date,'YYYY-MM')=$1`, thisMon).Scan(&outMth)
	sb.WriteString(fmt.Sprintf("🔄 Bulan ini: %d masuk | %d keluar\n", inMth, outMth))

	var pendingReq int
	h.DB.QueryRow(`SELECT COUNT(*) FROM requests WHERE status='pending'`).Scan(&pendingReq)
	sb.WriteString(fmt.Sprintf("📋 SPB Pending: %d\n", pendingReq))

	// ── 3. FAST MOVERS — top 5 keluar 3 bulan terakhir ───
	sb.WriteString("\n📈 TOP 5 FAST MOVER (REKOMEN: PERBANYAK / RESTOCK)::\n")
	fastRows, err1 := h.DB.Query(`
		SELECT i.name, i.sku,
		       COALESCE(SUM(oi.qty),0)          AS total_out,
		       COALESCE(SUM(s.current_stock),0) AS curr_stock,
		       i.min_stock
		FROM outbound_items oi
		JOIN outbound_transactions ot ON oi.transaction_id = ot.id
		JOIN items i ON oi.item_id = i.id
		LEFT JOIN item_stocks s ON s.item_id = i.id
		WHERE ot.outbound_date >= $1
		GROUP BY i.id, i.name, i.sku, i.min_stock
		ORDER BY total_out DESC LIMIT 5`, ago3m)
	if err1 == nil {
		defer fastRows.Close()
		found := false
		for fastRows.Next() {
			found = true
			var name, sku string
			var totalOut, currStock, minStock int
			fastRows.Scan(&name, &sku, &totalOut, &currStock, &minStock)
			status := "✅ aman"
			if currStock <= minStock {
				status = "🚨 KRITIS"
			} else if currStock <= minStock*2 {
				status = "⚠️ menipis"
			}
			sb.WriteString(fmt.Sprintf("  • %s [%s]: keluar %d/3bln | stok %d | min %d | %s\n",
				name, sku, totalOut, currStock, minStock, status))
		}
		if !found {
			sb.WriteString("  (belum ada data outbound)\n")
		}
	}

	// ── 4. DEAD STOCK — stok ada, 0 keluar 6 bulan ───────────
	sb.WriteString("\n🔴 DEAD STOCK (stok menganggur ≥ 6 bulan — REKOMEN: JUAL HABIS / HENTIKAN RESTOCK):\n")
	deadRows, errD := h.DB.Query(`
		SELECT i.name, i.sku,
		       COALESCE(SUM(s.current_stock),0) AS curr_stock,
		       i.min_stock
		FROM items i
		JOIN item_stocks s ON s.item_id = i.id
		WHERE i.is_active = true
		  AND NOT EXISTS (
		        SELECT 1
		        FROM outbound_items oi
		        JOIN outbound_transactions ot ON oi.transaction_id = ot.id
		        WHERE oi.item_id = i.id
		          AND ot.outbound_date >= $1
		      )
		GROUP BY i.id, i.name, i.sku, i.min_stock
		HAVING COALESCE(SUM(s.current_stock),0) > 0
		ORDER BY curr_stock DESC
		LIMIT 5`, ago6m)
	if errD == nil {
		defer deadRows.Close()
		foundD := false
		for deadRows.Next() {
			foundD = true
			var name, sku string
			var currStock, minStock int
			deadRows.Scan(&name, &sku, &currStock, &minStock)
			sb.WriteString(fmt.Sprintf("  • %s [%s]: stok %d unit | 0 keluar 6 bulan 🔴\n",
				name, sku, currStock))
		}
		if !foundD {
			sb.WriteString("  (tidak ada dead stock — semua item bergerak ✅)\n")
		}
	}

	// ── 5. SLOW MOVERS — turnover rendah 3 bulan ─────────────
	sb.WriteString("\n📉 TOP 5 SLOW MOVER (keluar sedikit vs stok — REKOMEN: KURANGI PEMBELIAN):\n")
	slowRows, err2 := h.DB.Query(`
		SELECT i.name, i.sku,
		       COALESCE(SUM(s.current_stock),0)      AS curr_stock,
		       COALESCE(out_sub.total_out, 0)         AS total_out,
		       i.min_stock
		FROM items i
		JOIN item_stocks s ON s.item_id = i.id
		LEFT JOIN (
		    SELECT oi.item_id, SUM(oi.qty) AS total_out
		    FROM outbound_items oi
		    JOIN outbound_transactions ot ON oi.transaction_id = ot.id
		    WHERE ot.outbound_date >= $1
		    GROUP BY oi.item_id
		) out_sub ON out_sub.item_id = i.id
		WHERE i.is_active = true
		GROUP BY i.id, i.name, i.sku, i.min_stock, out_sub.total_out
		HAVING COALESCE(SUM(s.current_stock),0) > 0
		ORDER BY
		    (COALESCE(out_sub.total_out,0)::float / GREATEST(COALESCE(SUM(s.current_stock),1), 1)) ASC,
		    curr_stock DESC
		LIMIT 5`, ago3m)
	if err2 == nil {
		defer slowRows.Close()
		found2 := false
		for slowRows.Next() {
			found2 = true
			var name, sku string
			var currStock, totalOut, minStock int
			slowRows.Scan(&name, &sku, &currStock, &totalOut, &minStock)
			turnover := 0.0
			if currStock > 0 {
				turnover = float64(totalOut) / float64(currStock) * 100
			}
			label := "🟡 slow"
			if totalOut == 0 {
				label = "🔴 tidak bergerak"
			} else if turnover < 10 {
				label = "🟠 sangat lambat"
			}
			sb.WriteString(fmt.Sprintf("  • %s [%s]: stok %d | keluar %d/3bln | turnover %.0f%% | %s\n",
				name, sku, currStock, totalOut, turnover, label))
		}
		if !found2 {
			sb.WriteString("  (semua item bergerak normal ✅)\n")
		}
	}

	// ── 6. Critical items ────────────────────────────────
	sb.WriteString("\n🚨 ITEM KRITIS (RESTOCK SEGERA):\n")
	critRows, err3 := h.DB.Query(`
		SELECT i.name, i.sku, i.min_stock, COALESCE(SUM(s.current_stock),0) as curr
		FROM items i JOIN item_stocks s ON i.id=s.item_id
		WHERE s.current_stock <= i.min_stock AND i.is_active=true
		GROUP BY i.id, i.name, i.sku, i.min_stock
		ORDER BY curr ASC LIMIT 5`)
	if err3 == nil {
		defer critRows.Close()
		found3 := false
		for critRows.Next() {
			found3 = true
			var name, sku string
			var minStock, curr int
			critRows.Scan(&name, &sku, &minStock, &curr)
			gap := minStock - curr
			sb.WriteString(fmt.Sprintf("  • %s [%s]: stok %d/min %d (butuh %d unit lagi)\n",
				name, sku, curr, minStock, gap))
		}
		if !found3 {
			sb.WriteString("  (tidak ada item kritis ✅)\n")
		}
	}

	// ── 6. Finance (admin/finance/manager only) ───────────
	if role == "finance_procurement" || role == "admin" || role == "manager" {
		var totalPO, pendingPO, totalInv, unpaidInv, overdueInv int
		var budgetTotal, budgetUsed float64
		h.DB.QueryRow(`SELECT COUNT(*), COUNT(CASE WHEN status IN ('draft','sent') THEN 1 END)
			FROM purchase_orders`).Scan(&totalPO, &pendingPO)
		h.DB.QueryRow(`SELECT COUNT(*), COUNT(CASE WHEN status='unpaid' THEN 1 END)
			FROM invoices`).Scan(&totalInv, &unpaidInv)
		h.DB.QueryRow(`SELECT COUNT(*) FROM invoices WHERE status='overdue'`).Scan(&overdueInv)
		h.DB.QueryRow(`SELECT COALESCE(SUM(total_budget),0), COALESCE(SUM(used_budget),0)
			FROM budgets`).Scan(&budgetTotal, &budgetUsed)
		sb.WriteString(fmt.Sprintf("\n💰 Anggaran: Total Rp %.0f | Pakai Rp %.0f | Sisa Rp %.0f\n",
			budgetTotal, budgetUsed, budgetTotal-budgetUsed))
		sb.WriteString(fmt.Sprintf("🛒 PO: %d total | %d pending\n", totalPO, pendingPO))
		sb.WriteString(fmt.Sprintf("📄 Invoice: %d total | %d unpaid | %d 🚨OVERDUE\n",
			totalInv, unpaidInv, overdueInv))
	}

	// ── 7. Opname berjalan ────────────────────────────────
	var opnamePending int
	h.DB.QueryRow(`SELECT COUNT(*) FROM stock_opnames WHERE status='in_progress'`).Scan(&opnamePending)
	if opnamePending > 0 {
		sb.WriteString(fmt.Sprintf("📋 Opname berjalan: %d\n", opnamePending))
	}

	return sb.String()
}

// ── Groq API HTTP call ────────────────────────────────────────
func callGroqAPI(apiKey string, msgs []groqMsg) (string, error) {
	payload := groqRequest{
		Model:       "llama-3.1-8b-instant",
		Messages:    msgs,
		MaxTokens:   600,
		Temperature: 0.5,
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

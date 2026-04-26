package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ── Inbound (Barang Masuk) ────────────────────────────────────
func (h *Handler) GetInbound(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT t.id, t.ref_number,
			   COALESCE(DATE_FORMAT(t.received_date,'%Y-%m-%d'),''),
			   t.status,
			   COALESCE(s.name,''), COALESCE(w.name,''), COALESCE(u.name,'')
		FROM inbound_transactions t
		LEFT JOIN suppliers s ON t.supplier_id = s.id
		LEFT JOIN warehouses w ON t.warehouse_id = w.id
		LEFT JOIN users u ON t.received_by = u.id
		ORDER BY t.received_date DESC LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, refNum, dateStr, status, supplier, warehouse, receivedBy string
		if err := rows.Scan(&id, &refNum, &dateStr, &status, &supplier, &warehouse, &receivedBy); err != nil {
			continue
		}
		list = append(list, gin.H{
			"id": id, "ref_number": refNum, "date": dateStr,
			"status": status, "supplier": supplier, "warehouse": warehouse, "received_by": receivedBy,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list, "total": len(list)})
}

func (h *Handler) GetInboundDetail(c *gin.Context) {
	id := c.Param("id")
	var refNum, status, supplier string
	var date time.Time
	err := h.DB.QueryRow(`
		SELECT t.ref_number, t.received_date, t.status, COALESCE(s.name,'')
		FROM inbound_transactions t LEFT JOIN suppliers s ON t.supplier_id=s.id
		WHERE t.id=?`, id).Scan(&refNum, &date, &status, &supplier)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Transaksi tidak ditemukan"})
		return
	}

	rows, _ := h.DB.Query(`
		SELECT ii.id, i.sku, i.name, ii.qty_received, ii.unit_price
		FROM inbound_items ii JOIN items i ON ii.item_id=i.id
		WHERE ii.transaction_id=?`, id)
	defer rows.Close()
	var items []gin.H
	for rows.Next() {
		var iid, sku, name string
		var qty int
		var price float64
		rows.Scan(&iid, &sku, &name, &qty, &price)
		items = append(items, gin.H{"id": iid, "sku": sku, "name": name, "qty": qty, "price": price})
	}
	if items == nil { items = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id": id, "ref_number": refNum, "date": date.Format("2006-01-02"),
		"status": status, "supplier": supplier, "items": items,
	}})
}

func (h *Handler) CreateInbound(c *gin.Context) {
	var b struct {
		SupplierID  string `json:"supplier_id"`
		WarehouseID string `json:"warehouse_id" binding:"required"`
		Date        string `json:"received_date"`
		Notes       string `json:"notes"`
		Items       []struct {
			ItemID   string  `json:"item_id"`
			Qty      int     `json:"qty"`
			Price    float64 `json:"unit_price"`
		} `json:"items"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	// Generate ref number
	refNum := fmt.Sprintf("GRN-%s-%s", time.Now().Format("200601"), uuid.New().String()[:6])
	id := uuid.New().String()
	receivedBy := c.GetString("user_id")

	date := time.Now()
	if b.Date != "" {
		date, _ = time.Parse("2006-01-02", b.Date)
	}

	tx, _ := h.DB.Begin()

	tx.Exec(`INSERT INTO inbound_transactions (id,ref_number,supplier_id,warehouse_id,received_by,received_date,notes,status)
		VALUES (?,?,?,?,?,?,?,'confirmed')`,
		id, refNum, nullStr(b.SupplierID), b.WarehouseID, receivedBy, date, b.Notes)

	for _, item := range b.Items {
		tx.Exec(`INSERT INTO inbound_items (id,transaction_id,item_id,qty_received,unit_price) VALUES (?,?,?,?,?)`,
			uuid.New().String(), id, item.ItemID, item.Qty, item.Price)

		// Update stok
		tx.Exec(`
			INSERT INTO item_stocks (id, item_id, warehouse_id, current_stock)
			VALUES (?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE current_stock = current_stock + VALUES(current_stock), last_updated = NOW()`,
			uuid.New().String(), item.ItemID, b.WarehouseID, item.Qty)
	}

	tx.Commit()
	c.JSON(http.StatusCreated, gin.H{"message": "Barang masuk berhasil dicatat", "ref_number": refNum, "id": id})
}

func (h *Handler) ConfirmInbound(c *gin.Context) {
	id := c.Param("id")
	h.DB.Exec(`UPDATE inbound_transactions SET status='confirmed', updated_at=? WHERE id=?`, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "Barang masuk dikonfirmasi"})
}

// ── Outbound (Barang Keluar) ──────────────────────────────────
func (h *Handler) GetOutbound(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT t.id, t.ref_number,
			   COALESCE(DATE_FORMAT(t.outbound_date,'%Y-%m-%d'),''),
			   t.status, COALESCE(u.name,'')
		FROM outbound_transactions t LEFT JOIN users u ON t.processed_by=u.id
		ORDER BY t.outbound_date DESC LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}, "message": err.Error()})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, ref, dateStr, status, processedBy string
		if err := rows.Scan(&id, &ref, &dateStr, &status, &processedBy); err != nil {
			continue
		}
		list = append(list, gin.H{
			"id": id, "ref_number": ref, "date": dateStr,
			"status": status, "processed_by": processedBy,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateOutbound(c *gin.Context) {
	var b struct {
		WarehouseID string `json:"warehouse_id" binding:"required"`
		Notes       string `json:"notes"`
		Items       []struct {
			ItemID string `json:"item_id"`
			Qty    int    `json:"qty"`
		} `json:"items"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	refNum := fmt.Sprintf("OUT-%s-%s", time.Now().Format("200601"), uuid.New().String()[:6])
	id := uuid.New().String()
	processedBy := c.GetString("user_id")

	tx, _ := h.DB.Begin()
	tx.Exec(`INSERT INTO outbound_transactions (id,ref_number,warehouse_id,processed_by,outbound_date,notes,status)
		VALUES (?,?,?,?,?,?,'confirmed')`,
		id, refNum, b.WarehouseID, processedBy, time.Now(), b.Notes)

	for _, item := range b.Items {
		tx.Exec(`INSERT INTO outbound_items (id,transaction_id,item_id,qty) VALUES (?,?,?,?)`,
			uuid.New().String(), id, item.ItemID, item.Qty)
		// Kurangi stok
		tx.Exec(`UPDATE item_stocks SET current_stock = GREATEST(0, current_stock - ?), last_updated=NOW()
			WHERE item_id=? AND warehouse_id=?`, item.Qty, item.ItemID, b.WarehouseID)
	}
	tx.Commit()
	c.JSON(http.StatusCreated, gin.H{"message": "Barang keluar berhasil dicatat", "ref_number": refNum, "id": id})
}

// ── SPB (Requests) ────────────────────────────────────────────
func (h *Handler) GetRequests(c *gin.Context) {
	status := c.Query("status")
	requesterID := c.GetString("user_id")
	role := c.GetString("role")

	q := `SELECT r.id, r.spb_number, r.needed_date, r.priority, r.status, r.purpose,
			COALESCE(u.name,''), COALESCE(d.name,'')
		  FROM requests r
		  LEFT JOIN users u ON r.requester_id=u.id
		  LEFT JOIN departments d ON r.department_id=d.id
		  WHERE 1=1`
	args := []interface{}{}

	// Requester hanya lihat request sendiri
	if role == "requester" {
		q += ` AND r.requester_id=?`
		args = append(args, requesterID)
	}
	if status != "" {
		q += ` AND r.status=?`
		args = append(args, status)
	}
	q += ` ORDER BY r.created_at DESC LIMIT 100`

	rows, err := h.DB.Query(q, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal memuat requests: " + err.Error()})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, spbNum, priority, status, purpose, requester, dept string
		var neededDate time.Time
		rows.Scan(&id, &spbNum, &neededDate, &priority, &status, &purpose, &requester, &dept)
		list = append(list, gin.H{
			"id": id, "spb_number": spbNum, "needed_date": neededDate.Format("2006-01-02"),
			"priority": priority, "status": status, "purpose": purpose,
			"requester": requester, "department": dept,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list, "total": len(list)})
}

func (h *Handler) GetRequestDetail(c *gin.Context) {
	id := c.Param("id")
	var spbNum, priority, status, purpose string
	var neededDate time.Time
	err := h.DB.QueryRow(`SELECT spb_number,needed_date,priority,status,purpose FROM requests WHERE id=?`, id).
		Scan(&spbNum, &neededDate, &priority, &status, &purpose)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "SPB tidak ditemukan"})
		return
	}
	rows, _ := h.DB.Query(`SELECT ri.id, i.sku, i.name, ri.qty_requested, ri.qty_approved
		FROM request_items ri JOIN items i ON ri.item_id=i.id WHERE ri.request_id=?`, id)
	defer rows.Close()
	var items []gin.H
	for rows.Next() {
		var iid, sku, name string
		var qtyReq, qtyApp int
		rows.Scan(&iid, &sku, &name, &qtyReq, &qtyApp)
		items = append(items, gin.H{"id": iid, "sku": sku, "name": name, "qty_requested": qtyReq, "qty_approved": qtyApp})
	}
	if items == nil { items = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id": id, "spb_number": spbNum, "needed_date": neededDate.Format("2006-01-02"),
		"priority": priority, "status": status, "purpose": purpose, "items": items,
	}})
}

func (h *Handler) CreateRequest(c *gin.Context) {
	var b struct {
		NeededDate  string `json:"needed_date" binding:"required"`
		Purpose     string `json:"purpose" binding:"required"`
		Priority    string `json:"priority"`
		WarehouseID string `json:"warehouse_id"`
		Items       []struct {
			ItemID string `json:"item_id"`
			Qty    int    `json:"qty"`
		} `json:"items"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	spbNum := fmt.Sprintf("SPB-%s-%s", time.Now().Format("200601"), uuid.New().String()[:6])
	id := uuid.New().String()
	requesterID := c.GetString("user_id")

	date, _ := time.Parse("2006-01-02", b.NeededDate)
	priority := b.Priority
	if priority == "" { priority = "normal" }

	tx, _ := h.DB.Begin()
	tx.Exec(`INSERT INTO requests (id,spb_number,requester_id,warehouse_id,needed_date,purpose,priority,status)
		VALUES (?,?,?,?,?,?,?,'pending')`,
		id, spbNum, requesterID, nullStr(b.WarehouseID), date, b.Purpose, priority)

	for _, item := range b.Items {
		tx.Exec(`INSERT INTO request_items (id,request_id,item_id,qty_requested) VALUES (?,?,?,?)`,
			uuid.New().String(), id, item.ItemID, item.Qty)
	}
	tx.Commit()
	c.JSON(http.StatusCreated, gin.H{"message": "SPB berhasil dibuat", "spb_number": spbNum, "id": id})
}

func (h *Handler) ApproveRequest(c *gin.Context) {
	id := c.Param("id")
	approvedBy := c.GetString("user_id")
	h.DB.Exec(`UPDATE requests SET status='approved', reviewed_by=?, reviewed_at=?, updated_at=? WHERE id=?`,
		approvedBy, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "SPB disetujui"})
}

func (h *Handler) RejectRequest(c *gin.Context) {
	id := c.Param("id")
	var b struct{ Notes string `json:"notes"` }
	c.ShouldBindJSON(&b)
	approvedBy := c.GetString("user_id")
	h.DB.Exec(`UPDATE requests SET status='rejected', reviewed_by=?, reviewed_at=?, review_notes=?, updated_at=? WHERE id=?`,
		approvedBy, time.Now(), b.Notes, id)
	c.JSON(http.StatusOK, gin.H{"message": "SPB ditolak"})
}

// ── Dashboard Stats ───────────────────────────────────────────
func (h *Handler) GetDashboardStats(c *gin.Context) {
	var totalItems, criticalItems, totalSuppliers, pendingRequests int
	var totalStockValue float64

	h.DB.QueryRow(`SELECT COUNT(*) FROM items WHERE is_active=true`).Scan(&totalItems)
	h.DB.QueryRow(`SELECT COUNT(*) FROM suppliers WHERE is_active=true`).Scan(&totalSuppliers)
	h.DB.QueryRow(`SELECT COUNT(*) FROM requests WHERE status='pending'`).Scan(&pendingRequests)
	h.DB.QueryRow(`SELECT COALESCE(SUM(s.current_stock * i.price),0)
		FROM item_stocks s JOIN items i ON s.item_id=i.id`).Scan(&totalStockValue)
	h.DB.QueryRow(`SELECT COUNT(DISTINCT i.id) FROM items i
		JOIN item_stocks s ON i.id=s.item_id
		WHERE s.current_stock <= i.min_stock AND i.is_active=true`).Scan(&criticalItems)

	// Recent transactions
	rows, _ := h.DB.Query(`SELECT ref_number, received_date, status FROM inbound_transactions ORDER BY received_date DESC LIMIT 5`)
	defer rows.Close()
	var recent []gin.H
	for rows.Next() {
		var ref, status string
		var date time.Time
		rows.Scan(&ref, &date, &status)
		recent = append(recent, gin.H{"ref": ref, "date": date.Format("2006-01-02"), "status": status, "type": "inbound"})
	}
	if recent == nil { recent = []gin.H{} }

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"total_items":      totalItems,
			"critical_items":   criticalItems,
			"total_suppliers":  totalSuppliers,
			"pending_requests": pendingRequests,
			"stock_value":      totalStockValue,
			"recent_transactions": recent,
		},
	})
}

// ── Opname ────────────────────────────────────────────────────
func (h *Handler) GetOpname(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []gin.H{}, "message": "Coming soon"})
}

// ── ERP Handlers ──────────────────────────────────────────────
func (h *Handler) GetPurchaseOrders(c *gin.Context) {
	rows, _ := h.DB.Query(`
		SELECT p.id, p.po_number, p.status, p.total_amount, p.created_at, COALESCE(s.name,'')
		FROM purchase_orders p LEFT JOIN suppliers s ON p.supplier_id=s.id
		ORDER BY p.created_at DESC LIMIT 100`)
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, poNum, status, supplier string
		var total float64
		var createdAt time.Time
		rows.Scan(&id, &poNum, &status, &total, &createdAt, &supplier)
		list = append(list, gin.H{
			"id": id, "po_number": poNum, "status": status,
			"total": total, "supplier": supplier, "date": createdAt.Format("2006-01-02"),
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list, "total": len(list)})
}

func (h *Handler) CreatePurchaseOrder(c *gin.Context) {
	var b struct {
		SupplierID   string  `json:"supplier_id"`
		WarehouseID  string  `json:"warehouse_id"`
		ExpectedDate string  `json:"expected_date"`
		TaxRate      float64 `json:"tax_rate"`
		Notes        string  `json:"notes"`
		Items        []struct {
			ItemID    string  `json:"item_id"`
			Qty       int     `json:"qty"`
			UnitPrice float64 `json:"unit_price"`
		} `json:"items"`
	}
	c.ShouldBindJSON(&b)
	poNum := fmt.Sprintf("PO-%s-%s", time.Now().Format("200601"), uuid.New().String()[:6])
	id := uuid.New().String()
	createdBy := c.GetString("user_id")

	taxRate := b.TaxRate
	if taxRate == 0 { taxRate = 11 }

	var subtotal float64
	for _, item := range b.Items {
		subtotal += float64(item.Qty) * item.UnitPrice
	}
	taxAmt := subtotal * taxRate / 100
	total := subtotal + taxAmt

	h.DB.Exec(`INSERT INTO purchase_orders (id,po_number,supplier_id,warehouse_id,created_by,tax_rate,subtotal,tax_amount,total_amount,notes,status)
		VALUES (?,?,?,?,?,?,?,?,?,?,'draft')`,
		id, poNum, nullStr(b.SupplierID), nullStr(b.WarehouseID), createdBy, taxRate, subtotal, taxAmt, total, b.Notes)

	for _, item := range b.Items {
		h.DB.Exec(`INSERT INTO purchase_order_items (id,po_id,item_id,qty_ordered,unit_price) VALUES (?,?,?,?,?)`,
			uuid.New().String(), id, item.ItemID, item.Qty, item.UnitPrice)
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Purchase Order dibuat", "po_number": poNum, "id": id})
}

func (h *Handler) GetPurchaseOrderDetail(c *gin.Context) {
	id := c.Param("id")
	var poNum, status string
	var total float64
	err := h.DB.QueryRow(`SELECT po_number,status,total_amount FROM purchase_orders WHERE id=?`, id).Scan(&poNum, &status, &total)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "PO tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": id, "po_number": poNum, "status": status, "total": total}})
}

func (h *Handler) UpdatePurchaseOrder(c *gin.Context) {
	id := c.Param("id")
	var b struct{ Status string `json:"status"` }
	c.ShouldBindJSON(&b)
	h.DB.Exec(`UPDATE purchase_orders SET status=?, updated_at=? WHERE id=?`, b.Status, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "PO diperbarui"})
}

func (h *Handler) GetInvoices(c *gin.Context) {
	rows, _ := h.DB.Query(`SELECT id, invoice_number, status, total_amount, due_date FROM invoices ORDER BY created_at DESC LIMIT 100`)
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, invNum, status string
		var total float64
		var dueDate time.Time
		rows.Scan(&id, &invNum, &status, &total, &dueDate)
		list = append(list, gin.H{"id": id, "invoice_number": invNum, "status": status, "total": total, "due_date": dueDate.Format("2006-01-02")})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateInvoice(c *gin.Context) {
	var b struct {
		InvoiceNumber string  `json:"invoice_number"`
		POID          string  `json:"po_id"`
		SupplierID    string  `json:"supplier_id"`
		InvoiceDate   string  `json:"invoice_date"`
		DueDate       string  `json:"due_date"`
		TotalAmount   float64 `json:"total_amount"`
	}
	c.ShouldBindJSON(&b)
	id := uuid.New().String()
	invDate, _ := time.Parse("2006-01-02", b.InvoiceDate)
	dueDate, _ := time.Parse("2006-01-02", b.DueDate)
	createdBy := c.GetString("user_id")
	h.DB.Exec(`INSERT INTO invoices (id,invoice_number,po_id,supplier_id,invoice_date,due_date,total_amount,created_by,status)
		VALUES (?,?,?,?,?,?,?,?,'unpaid')`,
		id, b.InvoiceNumber, nullStr(b.POID), nullStr(b.SupplierID), invDate, dueDate, b.TotalAmount, createdBy)
	c.JSON(http.StatusCreated, gin.H{"message": "Invoice dibuat", "id": id})
}

func (h *Handler) GetBudgets(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT id, name,
		       COALESCE(total_amount,0), COALESCE(spent_amount,0),
		       period_start, period_end,
		       YEAR(period_start) AS budget_year
		FROM budgets ORDER BY created_at DESC`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, name string
		var total, spent float64
		var start, end time.Time
		var budgetYear int
		rows.Scan(&id, &name, &total, &spent, &start, &end, &budgetYear)
		list = append(list, gin.H{
			"id": id, "name": name,
			"total_budget":   total,
			"used_budget":    spent,
			"total_amount":   total,
			"spent_amount":   spent,
			"budget_year":    budgetYear,
			"period_start":  start.Format("2006-01-02"),
			"period_end":    end.Format("2006-01-02"),
			"department_name": "",
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateBudget(c *gin.Context) {
	var b struct {
		Name        string  `json:"name"`
		TotalAmount float64 `json:"total_amount"`
		PeriodStart string  `json:"period_start"`
		PeriodEnd   string  `json:"period_end"`
		PeriodType  string  `json:"period_type"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	if b.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Nama anggaran wajib diisi"})
		return
	}
	if b.PeriodStart == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Tanggal mulai wajib diisi"})
		return
	}
	id := uuid.New().String()
	start, _ := time.Parse("2006-01-02", b.PeriodStart)
	end, _   := time.Parse("2006-01-02", b.PeriodEnd)
	budgetYear := start.Year()  // auto-derive dari period_start
	if b.PeriodType == "" { b.PeriodType = "monthly" }
	createdBy := c.GetString("user_id")
	_, err := h.DB.Exec(`
		INSERT INTO budgets (id,name,total_amount,period_start,period_end,period_type,budget_year,created_by)
		VALUES (?,?,?,?,?,?,?,?)`,
		id, b.Name, b.TotalAmount, start, end, b.PeriodType, budgetYear, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal buat budget: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Budget dibuat", "id": id})
}

func (h *Handler) GetERPSummary(c *gin.Context) {
	var totalPO, totalInvoice int
	var totalPOValue, totalUnpaid float64
	h.DB.QueryRow(`SELECT COUNT(*), COALESCE(SUM(total_amount),0) FROM purchase_orders`).Scan(&totalPO, &totalPOValue)
	h.DB.QueryRow(`SELECT COUNT(*), COALESCE(SUM(total_amount - paid_amount),0) FROM invoices WHERE status != 'paid'`).Scan(&totalInvoice, &totalUnpaid)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"total_po": totalPO, "total_po_value": totalPOValue,
		"unpaid_invoices": totalInvoice, "total_unpaid": totalUnpaid,
	}})
}

func (h *Handler) CreateOpname(c *gin.Context) {
	c.JSON(http.StatusCreated, gin.H{"message": "Opname dibuat"})
}

func (h *Handler) GetOpnames(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"data": []gin.H{}})
}

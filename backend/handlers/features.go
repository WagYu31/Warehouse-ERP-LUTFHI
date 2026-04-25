package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ══════════════════════════════════════════════════════════════
//  FITUR 1: PEMBAYARAN INVOICE
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetInvoiceDetail(c *gin.Context) {
	id := c.Param("id")
	var invNum, status, supplierName, poNum string
	var total, paid, remaining float64
	var invDate, dueDate time.Time

	err := h.DB.QueryRow(`
		SELECT i.invoice_number, i.status, i.total_amount, i.paid_amount,
		       i.remaining_amount, i.invoice_date, i.due_date,
		       COALESCE(s.name,'—'), COALESCE(po.po_number,'—')
		FROM invoices i
		LEFT JOIN suppliers s ON i.supplier_id = s.id
		LEFT JOIN purchase_orders po ON i.po_id = po.id
		WHERE i.id = $1`, id).
		Scan(&invNum, &status, &total, &paid, &remaining, &invDate, &dueDate, &supplierName, &poNum)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Invoice tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id": id, "invoice_number": invNum, "status": status,
		"total_amount": total, "paid_amount": paid, "remaining_amount": remaining,
		"invoice_date": invDate.Format("2006-01-02"), "due_date": dueDate.Format("2006-01-02"),
		"supplier": supplierName, "po_number": poNum,
	}})
}

func (h *Handler) RecordPayment(c *gin.Context) {
	id := c.Param("id")
	var b struct {
		Amount      float64 `json:"amount" binding:"required,gt=0"`
		PaymentDate string  `json:"payment_date"`
		Method      string  `json:"payment_method"`
		Notes       string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Amount harus diisi dan > 0"})
		return
	}

	// Ambil sisa pembayaran
	var remaining float64
	err := h.DB.QueryRow(`SELECT remaining_amount FROM invoices WHERE id=$1`, id).Scan(&remaining)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Invoice tidak ditemukan"})
		return
	}
	if b.Amount > remaining {
		c.JSON(http.StatusBadRequest, gin.H{"message": fmt.Sprintf("Jumlah bayar (%.0f) melebihi sisa tagihan (%.0f)", b.Amount, remaining)})
		return
	}

	payDate := time.Now()
	if b.PaymentDate != "" {
		payDate, _ = time.Parse("2006-01-02", b.PaymentDate)
	}
	method := b.Method
	if method == "" { method = "transfer" }
	paidBy := c.GetString("user_id")
	paymentID := uuid.New().String()

	tx, _ := h.DB.Begin()
	// Insert ke payments
	tx.Exec(`INSERT INTO payments (id, invoice_id, amount, payment_date, payment_method, notes, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		paymentID, id, b.Amount, payDate, method, b.Notes, paidBy)

	// Update invoice
	newPaid := 0.0
	tx.QueryRow(`SELECT COALESCE(paid_amount,0) + $1 FROM invoices WHERE id=$2`, b.Amount, id).Scan(&newPaid)
	newRemaining := remaining - b.Amount
	newStatus := "partial"
	if newRemaining <= 0 {
		newStatus = "paid"
		newRemaining = 0
	}
	tx.Exec(`UPDATE invoices SET paid_amount=$1, remaining_amount=$2, status=$3, updated_at=$4 WHERE id=$5`,
		newPaid, newRemaining, newStatus, time.Now(), id)
	tx.Commit()

	c.JSON(http.StatusCreated, gin.H{
		"message": "Pembayaran berhasil dicatat",
		"payment_id": paymentID,
		"new_status": newStatus,
		"remaining": newRemaining,
	})
}

func (h *Handler) GetPaymentHistory(c *gin.Context) {
	id := c.Param("id")
	rows, err := h.DB.Query(`
		SELECT p.id, p.amount, p.payment_date, p.payment_method, p.notes, COALESCE(u.name,'')
		FROM payments p LEFT JOIN users u ON p.created_by=u.id
		WHERE p.invoice_id=$1 ORDER BY p.payment_date DESC`, id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var pid, method, notes, paidBy string
		var amount float64
		var pDate time.Time
		rows.Scan(&pid, &amount, &pDate, &method, &notes, &paidBy)
		list = append(list, gin.H{
			"id": pid, "amount": amount, "payment_date": pDate.Format("2006-01-02"),
			"payment_method": method, "notes": notes, "paid_by": paidBy,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

// ══════════════════════════════════════════════════════════════
//  FITUR 2: PO DETAIL DENGAN ITEMS
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetPODetailFull(c *gin.Context) {
	id := c.Param("id")
	var poNum, status, notes, supplierName string
	var subtotal, taxRate, taxAmount, total float64
	var createdAt time.Time

	err := h.DB.QueryRow(`
		SELECT po.po_number, po.status, po.subtotal, po.tax_rate, po.tax_amount, po.total_amount,
		       COALESCE(po.notes,''), po.created_at, COALESCE(s.name,'—')
		FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id=s.id
		WHERE po.id=$1`, id).
		Scan(&poNum, &status, &subtotal, &taxRate, &taxAmount, &total, &notes, &createdAt, &supplierName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "PO tidak ditemukan"})
		return
	}

	rows, _ := h.DB.Query(`
		SELECT poi.id, i.name, i.sku, poi.qty_ordered, poi.qty_received, poi.unit_price,
		       (poi.qty_ordered * poi.unit_price) AS subtotal
		FROM purchase_order_items poi JOIN items i ON poi.item_id=i.id
		WHERE poi.po_id=$1`, id)
	defer rows.Close()
	var items []gin.H
	for rows.Next() {
		var iid, name, sku string
		var qtyOrdered, qtyReceived int
		var unitPrice, itemSubtotal float64
		rows.Scan(&iid, &name, &sku, &qtyOrdered, &qtyReceived, &unitPrice, &itemSubtotal)
		items = append(items, gin.H{
			"id": iid, "name": name, "sku": sku,
			"qty_ordered": qtyOrdered, "qty_received": qtyReceived,
			"unit_price": unitPrice, "subtotal": itemSubtotal,
		})
	}
	if items == nil { items = []gin.H{} }

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id": id, "po_number": poNum, "status": status, "supplier": supplierName,
		"subtotal": subtotal, "tax_rate": taxRate, "tax_amount": taxAmount, "total": total,
		"notes": notes, "date": createdAt.Format("2006-01-02"), "items": items,
	}})
}

func (h *Handler) UpdatePOStatus(c *gin.Context) {
	id := c.Param("id")
	var b struct {
		Status string `json:"status" binding:"required"`
		Notes  string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	allowed := map[string]bool{"draft": true, "sent": true, "partial": true, "complete": true, "cancelled": true}
	if !allowed[b.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Status tidak valid"})
		return
	}
	h.DB.Exec(`UPDATE purchase_orders SET status=$1, notes=CASE WHEN $2!='' THEN $2 ELSE notes END, updated_at=$3 WHERE id=$4`,
		b.Status, b.Notes, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "Status PO diperbarui ke " + b.Status})
}

// ══════════════════════════════════════════════════════════════
//  FITUR 3: TRANSFER STOK ANTAR GUDANG
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetStockTransfers(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT st.id, st.ref_number, st.status, st.transfer_date,
		       COALESCE(wf.name,''), COALESCE(wt.name,''), COALESCE(u.name,'')
		FROM stock_transfers st
		LEFT JOIN warehouses wf ON st.from_warehouse_id = wf.id
		LEFT JOIN warehouses wt ON st.to_warehouse_id = wt.id
		LEFT JOIN users u ON st.requested_by = u.id
		ORDER BY st.transfer_date DESC LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, ref, status, fromW, toW, reqBy string
		var tDate time.Time
		rows.Scan(&id, &ref, &status, &tDate, &fromW, &toW, &reqBy)
		list = append(list, gin.H{
			"id": id, "ref_number": ref, "status": status,
			"transfer_date": tDate.Format("2006-01-02"),
			"from_warehouse": fromW, "to_warehouse": toW, "requested_by": reqBy,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateStockTransfer(c *gin.Context) {
	var b struct {
		FromWarehouseID string `json:"from_warehouse_id" binding:"required"`
		ToWarehouseID   string `json:"to_warehouse_id" binding:"required"`
		Notes           string `json:"notes"`
		Items           []struct {
			ItemID string `json:"item_id"`
			Qty    int    `json:"qty"`
		} `json:"items"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	if b.FromWarehouseID == b.ToWarehouseID {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Gudang asal dan tujuan harus berbeda"})
		return
	}
	if len(b.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Minimal 1 item harus dipilih"})
		return
	}

	refNum := fmt.Sprintf("TRF-%s-%s", time.Now().Format("200601"), uuid.New().String()[:6])
	id := uuid.New().String()
	requestedBy := c.GetString("user_id")

	tx, _ := h.DB.Begin()
	tx.Exec(`INSERT INTO stock_transfers (id,ref_number,from_warehouse_id,to_warehouse_id,requested_by,transfer_date,notes,status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'completed')`,
		id, refNum, b.FromWarehouseID, b.ToWarehouseID, requestedBy, time.Now(), b.Notes)

	for _, item := range b.Items {
		if item.Qty <= 0 { continue }

		// Cek stok di gudang asal
		var avail int
		tx.QueryRow(`SELECT COALESCE(current_stock,0) FROM item_stocks WHERE item_id=$1 AND warehouse_id=$2`,
			item.ItemID, b.FromWarehouseID).Scan(&avail)
		if avail < item.Qty {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"message": fmt.Sprintf("Stok item tidak cukup (tersedia: %d, diminta: %d)", avail, item.Qty)})
			return
		}

		tx.Exec(`INSERT INTO stock_transfer_items (id,transfer_id,item_id,qty) VALUES ($1,$2,$3,$4)`,
			uuid.New().String(), id, item.ItemID, item.Qty)
		// Kurangi stok asal
		tx.Exec(`UPDATE item_stocks SET current_stock = current_stock - $1, last_updated=NOW()
			WHERE item_id=$2 AND warehouse_id=$3`, item.Qty, item.ItemID, b.FromWarehouseID)
		// Tambah stok tujuan
		tx.Exec(`INSERT INTO item_stocks (id,item_id,warehouse_id,current_stock)
			VALUES ($1,$2,$3,$4)
			ON CONFLICT (item_id,warehouse_id)
			DO UPDATE SET current_stock = item_stocks.current_stock + $4, last_updated=NOW()`,
			uuid.New().String(), item.ItemID, b.ToWarehouseID, item.Qty)
	}
	tx.Commit()
	c.JSON(http.StatusCreated, gin.H{"message": "Transfer stok berhasil", "ref_number": refNum, "id": id})
}

// ══════════════════════════════════════════════════════════════
//  FITUR 4: STOCK OPNAME FULL FLOW
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetOpnameList(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT so.id, so.ref_number, so.opname_date, so.status,
		       COALESCE(w.name,''), COALESCE(u.name,''),
		       so.total_items, so.discrepancy_count
		FROM stock_opnames so
		LEFT JOIN warehouses w ON so.warehouse_id = w.id
		LEFT JOIN users u ON so.conducted_by = u.id
		ORDER BY so.opname_date DESC LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, ref, status, warehouseName, conductedBy string
		var oDate time.Time
		var totalItems, discrepancy int
		rows.Scan(&id, &ref, &oDate, &status, &warehouseName, &conductedBy, &totalItems, &discrepancy)
		list = append(list, gin.H{
			"id": id, "ref_number": ref, "opname_date": oDate.Format("2006-01-02"),
			"status": status, "warehouse_name": warehouseName,
			"created_by_name": conductedBy,
			"total_items": totalItems, "discrepancy_count": discrepancy,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateOpnameFull(c *gin.Context) {
	var b struct {
		WarehouseID string `json:"warehouse_id" binding:"required"`
		OpnameDate  string `json:"opname_date"`
		Notes       string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	refNum := fmt.Sprintf("OPN-%s-%s", time.Now().Format("200601"), uuid.New().String()[:6])
	id := uuid.New().String()
	conductedBy := c.GetString("user_id")
	opDate := time.Now()
	if b.OpnameDate != "" { opDate, _ = time.Parse("2006-01-02", b.OpnameDate) }

	// Hitung total items di gudang ini
	var totalItems int
	h.DB.QueryRow(`SELECT COUNT(*) FROM item_stocks WHERE warehouse_id=$1 AND current_stock > 0`, b.WarehouseID).Scan(&totalItems)

	tx, _ := h.DB.Begin()
	tx.Exec(`INSERT INTO stock_opnames (id,ref_number,warehouse_id,conducted_by,opname_date,notes,status,total_items,discrepancy_count)
		VALUES ($1,$2,$3,$4,$5,$6,'in_progress',$7,0)`,
		id, refNum, b.WarehouseID, conductedBy, opDate, b.Notes, totalItems)

	// Pre-populate opname items dengan stok sistem saat ini
	rows, _ := h.DB.Query(`
		SELECT is2.item_id, is2.current_stock, i.name
		FROM item_stocks is2 JOIN items i ON is2.item_id=i.id
		WHERE is2.warehouse_id=$1`, b.WarehouseID)
	defer rows.Close()
	for rows.Next() {
		var itemID, itemName string
		var sysStock int
		rows.Scan(&itemID, &sysStock, &itemName)
		tx.Exec(`INSERT INTO opname_items (id,opname_id,item_id,system_stock,physical_count,discrepancy)
			VALUES ($1,$2,$3,$4,-1,0)`,
			uuid.New().String(), id, itemID, sysStock)
	}
	tx.Commit()

	c.JSON(http.StatusCreated, gin.H{
		"message": "Opname dibuat, silakan input stok fisik",
		"id": id, "ref_number": refNum, "total_items": totalItems,
	})
}

func (h *Handler) GetOpnameDetail(c *gin.Context) {
	id := c.Param("id")
	var ref, status, warehouseName string
	var oDate time.Time
	err := h.DB.QueryRow(`
		SELECT so.ref_number, so.status, so.opname_date, COALESCE(w.name,'')
		FROM stock_opnames so LEFT JOIN warehouses w ON so.warehouse_id=w.id
		WHERE so.id=$1`, id).Scan(&ref, &status, &oDate, &warehouseName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Opname tidak ditemukan"})
		return
	}

	rows, _ := h.DB.Query(`
		SELECT oi.id, oi.item_id, i.name, i.sku, oi.system_stock, oi.physical_count, oi.discrepancy
		FROM opname_items oi JOIN items i ON oi.item_id=i.id
		WHERE oi.opname_id=$1 ORDER BY i.name`, id)
	defer rows.Close()
	var items []gin.H
	for rows.Next() {
		var iid, itemID, name, sku string
		var sysStock, physCount, disc int
		rows.Scan(&iid, &itemID, &name, &sku, &sysStock, &physCount, &disc)
		items = append(items, gin.H{
			"id": iid, "item_id": itemID, "name": name, "sku": sku,
			"system_stock": sysStock, "physical_count": physCount, "discrepancy": disc,
		})
	}
	if items == nil { items = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id": id, "ref_number": ref, "status": status,
		"opname_date": oDate.Format("2006-01-02"), "warehouse": warehouseName,
		"items": items,
	}})
}

func (h *Handler) SubmitOpnameCount(c *gin.Context) {
	opnameID := c.Param("id")
	var b struct {
		Items []struct {
			ItemID        string `json:"item_id"`
			PhysicalCount int    `json:"physical_count"`
		} `json:"items"`
	}
	c.ShouldBindJSON(&b)

	tx, _ := h.DB.Begin()
	discrepancyCount := 0
	for _, item := range b.Items {
		var sysStock int
		tx.QueryRow(`SELECT system_stock FROM opname_items WHERE opname_id=$1 AND item_id=$2`,
			opnameID, item.ItemID).Scan(&sysStock)
		disc := item.PhysicalCount - sysStock
		if disc != 0 { discrepancyCount++ }
		tx.Exec(`UPDATE opname_items SET physical_count=$1, discrepancy=$2 WHERE opname_id=$3 AND item_id=$4`,
			item.PhysicalCount, disc, opnameID, item.ItemID)
	}
	tx.Exec(`UPDATE stock_opnames SET status='completed', discrepancy_count=$1, updated_at=$2 WHERE id=$3`,
		discrepancyCount, time.Now(), opnameID)
	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Opname selesai", "discrepancy_count": discrepancyCount})
}

// ══════════════════════════════════════════════════════════════
//  FITUR 5: NOTIFIKASI STOK KRITIS
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetNotifications(c *gin.Context) {
	userID := c.GetString("user_id")
	rows, err := h.DB.Query(`
		SELECT id, title, message, type, is_read, created_at
		FROM notifications
		WHERE user_id=$1 OR user_id IS NULL
		ORDER BY created_at DESC LIMIT 50`, userID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}, "unread": 0})
		return
	}
	defer rows.Close()
	var list []gin.H
	unread := 0
	for rows.Next() {
		var nid, title, msg, ntype string
		var isRead bool
		var createdAt time.Time
		rows.Scan(&nid, &title, &msg, &ntype, &isRead, &createdAt)
		if !isRead { unread++ }
		list = append(list, gin.H{
			"id": nid, "title": title, "message": msg, "type": ntype,
			"is_read": isRead, "created_at": createdAt.Format("2006-01-02 15:04"),
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list, "unread": unread})
}

func (h *Handler) MarkNotificationRead(c *gin.Context) {
	id := c.Param("id")
	if id == "all" {
		userID := c.GetString("user_id")
		h.DB.Exec(`UPDATE notifications SET is_read=true WHERE user_id=$1 OR user_id IS NULL`, userID)
		c.JSON(http.StatusOK, gin.H{"message": "Semua notifikasi dibaca"})
		return
	}
	h.DB.Exec(`UPDATE notifications SET is_read=true WHERE id=$1`, id)
	c.JSON(http.StatusOK, gin.H{"message": "Notifikasi dibaca"})
}

func (h *Handler) GetLowStockAlerts(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT i.id, i.name, i.sku, i.min_stock,
		       COALESCE(SUM(s.current_stock),0) AS total_stock,
		       w.name AS warehouse_name
		FROM items i
		JOIN item_stocks s ON i.id = s.item_id
		JOIN warehouses w ON s.warehouse_id = w.id
		WHERE i.is_active = true AND s.current_stock <= i.min_stock
		GROUP BY i.id, i.name, i.sku, i.min_stock, w.name
		ORDER BY total_stock ASC
		LIMIT 50`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, name, sku, warehouseName string
		var minStock, totalStock int
		rows.Scan(&id, &name, &sku, &minStock, &totalStock, &warehouseName)
		list = append(list, gin.H{
			"item_id": id, "name": name, "sku": sku,
			"min_stock": minStock, "current_stock": totalStock,
			"warehouse": warehouseName,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list, "count": len(list)})
}

// ══════════════════════════════════════════════════════════════
//  FITUR 6: PROFIL PENGGUNA & GANTI PASSWORD
// ══════════════════════════════════════════════════════════════

func (h *Handler) ChangePassword(c *gin.Context) {
	userID := c.GetString("user_id")
	var b struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	var passHash string
	err := h.DB.QueryRow(`SELECT password_hash FROM users WHERE id=$1`, userID).Scan(&passHash)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "User tidak ditemukan"})
		return
	}

	// Verify old password
	if err := comparePassword(passHash, b.OldPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Password lama tidak sesuai"})
		return
	}

	// Hash new password
	newHash, err := hashPassword(b.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal proses password"})
		return
	}

	h.DB.Exec(`UPDATE users SET password_hash=$1, updated_at=$2 WHERE id=$3`, newHash, time.Now(), userID)
	c.JSON(http.StatusOK, gin.H{"message": "Password berhasil diubah"})
}

// ══════════════════════════════════════════════════════════════
//  FITUR 7: KATEGORI & UNIT CRUD LENGKAP
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetCategoriesAll(c *gin.Context) {
	rows, _ := h.DB.Query(`SELECT id, name FROM categories ORDER BY name`)
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, name string
		rows.Scan(&id, &name)
		list = append(list, gin.H{"id": id, "name": name})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) UpdateCategory(c *gin.Context) {
	id := c.Param("id")
	var b struct{ Name string `json:"name" binding:"required"` }
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	h.DB.Exec(`UPDATE categories SET name=$1 WHERE id=$2`, b.Name, id)
	c.JSON(http.StatusOK, gin.H{"message": "Kategori diperbarui"})
}

func (h *Handler) DeleteCategory(c *gin.Context) {
	id := c.Param("id")
	var count int
	h.DB.QueryRow(`SELECT COUNT(*) FROM items WHERE category_id=$1`, id).Scan(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": fmt.Sprintf("Tidak bisa hapus — ada %d item menggunakan kategori ini", count)})
		return
	}
	h.DB.Exec(`DELETE FROM categories WHERE id=$1`, id)
	c.JSON(http.StatusOK, gin.H{"message": "Kategori dihapus"})
}

func (h *Handler) GetUnitsAll(c *gin.Context) {
	rows, _ := h.DB.Query(`SELECT id, name FROM units ORDER BY name`)
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, name string
		rows.Scan(&id, &name)
		list = append(list, gin.H{"id": id, "name": name})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) UpdateUnit(c *gin.Context) {
	id := c.Param("id")
	var b struct{ Name string `json:"name" binding:"required"` }
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	h.DB.Exec(`UPDATE units SET name=$1 WHERE id=$2`, b.Name, id)
	c.JSON(http.StatusOK, gin.H{"message": "Unit diperbarui"})
}

func (h *Handler) DeleteUnit(c *gin.Context) {
	id := c.Param("id")
	h.DB.Exec(`DELETE FROM units WHERE id=$1`, id)
	c.JSON(http.StatusOK, gin.H{"message": "Unit dihapus"})
}

// ══════════════════════════════════════════════════════════════
//  FITUR 8: REORDER CONFIGS (FULL CRUD)
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetReorderConfigs(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT rc.id, i.name, i.sku, w.name, rc.reorder_point, rc.reorder_qty, rc.auto_po,
		       COALESCE(is2.current_stock,0) as current_stock
		FROM reorder_configs rc
		JOIN items i ON rc.item_id=i.id
		JOIN warehouses w ON rc.warehouse_id=w.id
		LEFT JOIN item_stocks is2 ON rc.item_id=is2.item_id AND rc.warehouse_id=is2.warehouse_id
		ORDER BY i.name`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, itemName, sku, warehouseName string
		var reorderPoint, reorderQty, currentStock int
		var autoPO bool
		rows.Scan(&id, &itemName, &sku, &warehouseName, &reorderPoint, &reorderQty, &autoPO, &currentStock)
		list = append(list, gin.H{
			"id": id,
			"item": gin.H{"name": itemName, "sku": sku},
			"warehouse": gin.H{"name": warehouseName},
			"reorder_point": reorderPoint, "reorder_qty": reorderQty, "auto_po": autoPO,
			"current_stock": currentStock,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateReorderConfig(c *gin.Context) {
	var b struct {
		ItemID      string `json:"item_id" binding:"required"`
		WarehouseID string `json:"warehouse_id" binding:"required"`
		ReorderPoint int   `json:"reorder_point"`
		ReorderQty  int    `json:"reorder_qty"`
		AutoPO      bool   `json:"auto_po"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	id := uuid.New().String()
	_, err := h.DB.Exec(`
		INSERT INTO reorder_configs (id,item_id,warehouse_id,reorder_point,reorder_qty,auto_po)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (item_id,warehouse_id) DO UPDATE
		SET reorder_point=$4, reorder_qty=$5, auto_po=$6`,
		id, b.ItemID, b.WarehouseID, b.ReorderPoint, b.ReorderQty, b.AutoPO)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal simpan konfigurasi: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Konfigurasi reorder disimpan", "id": id})
}

func (h *Handler) DeleteReorderConfig(c *gin.Context) {
	id := c.Param("id")
	h.DB.Exec(`DELETE FROM reorder_configs WHERE id=$1`, id)
	c.JSON(http.StatusOK, gin.H{"message": "Konfigurasi dihapus"})
}

// ══════════════════════════════════════════════════════════════
//  PASSWORD HELPERS
// ══════════════════════════════════════════════════════════════

func comparePassword(hash, plain string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain))
}

func hashPassword(plain string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(plain), 12)
	return string(h), err
}

package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ══════════════════════════════════════════════════════════════
//  DEPARTMENTS
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetDepartments(c *gin.Context) {
	rows, _ := h.DB.Query(`SELECT id, name, COALESCE(description,'') FROM departments ORDER BY name`)
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, name, desc string
		rows.Scan(&id, &name, &desc)
		list = append(list, gin.H{"id": id, "name": name, "description": desc})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateDepartment(c *gin.Context) {
	var b struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	id := uuid.New().String()
	h.DB.Exec(`INSERT INTO departments (id, name, description) VALUES (?,?,?)`, id, b.Name, b.Description)
	c.JSON(http.StatusCreated, gin.H{"message": "Departemen dibuat", "id": id})
}

func (h *Handler) UpdateDepartment(c *gin.Context) {
	id := c.Param("id")
	var b struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	h.DB.Exec(`UPDATE departments SET name=?, description=? WHERE id=?`, b.Name, b.Description, id)
	c.JSON(http.StatusOK, gin.H{"message": "Departemen diperbarui"})
}

func (h *Handler) DeleteDepartment(c *gin.Context) {
	id := c.Param("id")
	var count int
	h.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE department_id=?`, id).Scan(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": fmt.Sprintf("Tidak bisa hapus — %d user masih di departemen ini", count)})
		return
	}
	h.DB.Exec(`DELETE FROM departments WHERE id=?`, id)
	c.JSON(http.StatusOK, gin.H{"message": "Departemen dihapus"})
}

// ══════════════════════════════════════════════════════════════
//  LOCATIONS (Rak / Bin dalam Gudang)
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetLocations(c *gin.Context) {
	warehouseID := c.Query("warehouse_id")
	query := `
		SELECT l.id, l.code, l.name, l.type, l.capacity, COALESCE(w.name,''), l.warehouse_id
		FROM locations l LEFT JOIN warehouses w ON l.warehouse_id=w.id
		WHERE l.is_active=true`
	args := []interface{}{}
	if warehouseID != "" {
		query += ` AND l.warehouse_id=?`
		args = append(args, warehouseID)
	}
	query += ` ORDER BY l.code`

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, code, name, ltype, warehouseName, wid string
		var capacity int
		rows.Scan(&id, &code, &name, &ltype, &capacity, &warehouseName, &wid)
		list = append(list, gin.H{
			"id": id, "code": code, "name": name, "type": ltype,
			"capacity": capacity, "warehouse_name": warehouseName, "warehouse_id": wid,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateLocation(c *gin.Context) {
	var b struct {
		Code        string `json:"code" binding:"required"`
		Name        string `json:"name" binding:"required"`
		Type        string `json:"type"` // rack, bin, shelf, zone
		WarehouseID string `json:"warehouse_id" binding:"required"`
		Capacity    int    `json:"capacity"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	if b.Type == "" { b.Type = "rack" }
	id := uuid.New().String()
	_, err := h.DB.Exec(`INSERT INTO locations (id,code,name,type,warehouse_id,capacity,is_active) VALUES (?,?,?,?,?,?,true)`,
		id, b.Code, b.Name, b.Type, b.WarehouseID, b.Capacity)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Kode lokasi sudah ada: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Lokasi berhasil dibuat", "id": id})
}

func (h *Handler) UpdateLocation(c *gin.Context) {
	id := c.Param("id")
	var b struct {
		Name     string `json:"name"`
		Type     string `json:"type"`
		Capacity int    `json:"capacity"`
	}
	c.ShouldBindJSON(&b)
	h.DB.Exec(`UPDATE locations SET name=?,type=?,capacity=? WHERE id=?`, b.Name, b.Type, b.Capacity, id)
	c.JSON(http.StatusOK, gin.H{"message": "Lokasi diperbarui"})
}

func (h *Handler) DeleteLocation(c *gin.Context) {
	id := c.Param("id")
	h.DB.Exec(`UPDATE locations SET is_active=false WHERE id=?`, id)
	c.JSON(http.StatusOK, gin.H{"message": "Lokasi dinonaktifkan"})
}

// ══════════════════════════════════════════════════════════════
//  DELIVERY ORDERS / SURAT JALAN
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetDeliveryOrders(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT do2.id, do2.ref_number, do2.status,
			   COALESCE(DATE_FORMAT(do2.delivery_date,'%Y-%m-%d'),''),
			   COALESCE(do2.destination,''),
			   COALESCE(w.name,''), COALESCE(u.name,'')
		FROM delivery_orders do2
		LEFT JOIN warehouses w ON do2.warehouse_id=w.id
		LEFT JOIN users u ON do2.created_by=u.id
		ORDER BY do2.delivery_date DESC LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}, "error": err.Error()})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, doNum, status, dateStr, destination, warehouseName, createdBy string
		if err := rows.Scan(&id, &doNum, &status, &dateStr, &destination, &warehouseName, &createdBy); err != nil {
			continue
		}
		list = append(list, gin.H{
			"id": id, "ref_number": doNum, "do_number": doNum, "status": status,
			"delivery_date": dateStr, "destination": destination,
			"warehouse_name": warehouseName, "created_by_name": createdBy,
			"recipient_name": destination,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateDeliveryOrder(c *gin.Context) {
	var b struct {
		WarehouseID      string `json:"warehouse_id"`
		RecipientName    string `json:"recipient_name"`
		RecipientAddress string `json:"recipient_address"`
		DeliveryDate     string `json:"delivery_date"`
		Notes            string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	doNum := fmt.Sprintf("DO-%s-%s", time.Now().Format("20060102"), uuid.New().String()[:6])
	id := uuid.New().String()
	createdBy := c.GetString("user_id")

	deliveryDate := time.Now()
	if b.DeliveryDate != "" {
		deliveryDate, _ = time.Parse("2006-01-02", b.DeliveryDate)
	}

	// Map recipient_name+address to destination
	destination := b.RecipientName
	if b.RecipientAddress != "" {
		destination = b.RecipientName + " - " + b.RecipientAddress
	}

	_, err := h.DB.Exec(`
		INSERT INTO delivery_orders (id,ref_number,warehouse_id,created_by,delivery_date,destination,notes,status)
		VALUES (?,?,?,?,?,?,?,'pending')`,
		id, doNum, nullStr(b.WarehouseID), createdBy, deliveryDate, destination, b.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal buat Surat Jalan: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Surat Jalan berhasil dibuat", "id": id, "do_number": doNum, "ref_number": doNum})
}

func (h *Handler) GetDeliveryOrderDetail(c *gin.Context) {
	id := c.Param("id")
	var doNum, status, destination, notes, createdBy string
	var dateStr string

	err := h.DB.QueryRow(`
		SELECT do2.ref_number, do2.status,
			   COALESCE(do2.destination,''),
			   COALESCE(do2.notes,''),
			   COALESCE(DATE_FORMAT(do2.delivery_date,'%Y-%m-%d'),''),
			   COALESCE(u.name,'')
		FROM delivery_orders do2 LEFT JOIN users u ON do2.created_by=u.id
		WHERE do2.id=?`, id).
		Scan(&doNum, &status, &destination, &notes, &dateStr, &createdBy)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Surat Jalan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id": id, "do_number": doNum, "ref_number": doNum, "status": status,
		"recipient_name": destination, "destination": destination,
		"recipient_address": "", "recipient_phone": "",
		"driver": "", "vehicle": "",
		"notes": notes, "delivery_date": dateStr,
		"created_by": createdBy, "items": []gin.H{},
	}})
}

func (h *Handler) ConfirmDelivery(c *gin.Context) {
	id := c.Param("id")
	h.DB.Exec(`UPDATE delivery_orders SET status='delivered', updated_at=NOW() WHERE id=?`, id)
	c.JSON(http.StatusOK, gin.H{"message": "Pengiriman dikonfirmasi selesai"})
}

// ══════════════════════════════════════════════════════════════
//  RETURNS / RETUR BARANG
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetReturns(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT r.id, r.ref_number, r.type, r.status,
		       COALESCE(DATE_FORMAT(r.return_date,'%Y-%m-%d'),''),
		       COALESCE(r.reason,''), COALESCE(u.name,''),
		       COALESCE(s.name,''), COALESCE(w.name,'')
		FROM returns r
		LEFT JOIN users u ON r.created_by=u.id
		LEFT JOIN suppliers s ON r.supplier_id=s.id
		LEFT JOIN warehouses w ON r.warehouse_id=w.id
		ORDER BY r.return_date DESC LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, refNum, retType, status, dateStr, reason, createdBy, supplierName, warehouseName string
		if err := rows.Scan(&id, &refNum, &retType, &status, &dateStr, &reason, &createdBy, &supplierName, &warehouseName); err != nil {
			continue
		}
		list = append(list, gin.H{
			"id": id, "ref_number": refNum, "return_number": refNum,
			"type": retType, "return_type": retType,
			"status": status, "return_date": dateStr,
			"reason": reason, "created_by": createdBy,
			"supplier_name": supplierName, "warehouse_name": warehouseName,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateReturn(c *gin.Context) {
	var b struct {
		ReturnType  string `json:"return_type" binding:"required"` // to_supplier / from_customer
		SupplierID  string `json:"supplier_id"`
		Reason      string `json:"reason" binding:"required"`
		ReturnDate  string `json:"return_date"`
		Notes       string `json:"notes"`
		Items       []struct {
			ItemID      string  `json:"item_id"`
			Qty         int     `json:"qty"`
			WarehouseID string  `json:"warehouse_id"`
			UnitPrice   float64 `json:"unit_price"`
		} `json:"items"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	if len(b.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Minimal 1 item"})
		return
	}

	retNum := fmt.Sprintf("RET-%s-%s", time.Now().Format("200601"), uuid.New().String()[:6])
	id := uuid.New().String()
	createdBy := c.GetString("user_id")
	retDate := time.Now()
	if b.ReturnDate != "" { retDate, _ = time.Parse("2006-01-02", b.ReturnDate) }

	tx, _ := h.DB.Begin()
	tx.Exec(`INSERT INTO returns (id,ref_number,type,supplier_id,reason,notes,return_date,created_by,status)
		VALUES (?,?,?,?,?,?,?,?,'pending')`,
		id, retNum, b.ReturnType, nullStr(b.SupplierID), b.Reason, b.Notes, retDate, createdBy)

	for _, item := range b.Items {
		tx.Exec(`INSERT INTO return_items (id,return_id,item_id,qty,warehouse_id,unit_price)
			VALUES (?,?,?,?,?,?)`,
			uuid.New().String(), id, item.ItemID, item.Qty, item.WarehouseID, item.UnitPrice)
	}
	tx.Commit()
	c.JSON(http.StatusCreated, gin.H{"message": "Retur berhasil dibuat", "id": id, "return_number": retNum})
}

func (h *Handler) GetReturnDetail(c *gin.Context) {
	id := c.Param("id")
	var retNum, retType, status, reason, notes, retDate, createdBy, supplierName string
	err := h.DB.QueryRow(`
		SELECT r.ref_number, r.type, r.status, COALESCE(r.reason,''),
		       COALESCE(r.notes,''),
		       COALESCE(DATE_FORMAT(r.return_date,'%Y-%m-%d'),''),
		       COALESCE(u.name,''), COALESCE(s.name,'')
		FROM returns r LEFT JOIN users u ON r.created_by=u.id LEFT JOIN suppliers s ON r.supplier_id=s.id
		WHERE r.id=?`, id).
		Scan(&retNum, &retType, &status, &reason, &notes, &retDate, &createdBy, &supplierName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Retur tidak ditemukan"})
		return
	}

	rows, _ := h.DB.Query(`
		SELECT ri.id, i.name, i.sku, ri.qty, ri.unit_price
		FROM return_items ri JOIN items i ON ri.item_id=i.id
		WHERE ri.return_id=?`, id)
	defer rows.Close()
	var items []gin.H
	for rows.Next() {
		var iid, name, sku string
		var qty int
		var price float64
		rows.Scan(&iid, &name, &sku, &qty, &price)
		items = append(items, gin.H{"id": iid, "name": name, "sku": sku, "qty": qty, "unit_price": price})
	}
	if items == nil { items = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id": id, "return_number": retNum, "return_type": retType, "status": status,
		"reason": reason, "notes": notes, "return_date": retDate,
		"created_by": createdBy, "supplier": supplierName, "items": items,
	}})
}

func (h *Handler) ApproveReturn(c *gin.Context) {
	id := c.Param("id")
	var retType string
	h.DB.QueryRow(`SELECT return_type FROM returns WHERE id=?`, id).Scan(&retType)

	tx, _ := h.DB.Begin()
	tx.Exec(`UPDATE returns SET status='approved', updated_at=? WHERE id=?`, time.Now(), id)

	// Kembalikan stok
	rows, _ := h.DB.Query(`SELECT item_id, qty, warehouse_id FROM return_items WHERE return_id=?`, id)
	defer rows.Close()
	for rows.Next() {
		var itemID, warehouseID string
		var qty int
		rows.Scan(&itemID, &qty, &warehouseID)

		if retType == "from_customer" {
			// Barang kembali ke gudang — tambah stok
			tx.Exec(`UPDATE item_stocks SET current_stock = current_stock + ?, last_updated=NOW()
				WHERE item_id=? AND warehouse_id=?`, qty, itemID, warehouseID)
		} else {
			// Retur ke supplier — stok sudah berkurang saat dibuat PO/Outbound
			// Tidak perlu adjust stok lagi
		}
	}
	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Retur diapprove"})
}

// ══════════════════════════════════════════════════════════════
//  OUTBOUND DETAIL
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetOutboundDetail(c *gin.Context) {
	id := c.Param("id")
	var refNum, status, notes, createdBy, warehouseName string
	var outDate time.Time

	err := h.DB.QueryRow(`
		SELECT ot.ref_number, ot.status, COALESCE(ot.notes,''), ot.transaction_date,
		       COALESCE(w.name,''), COALESCE(u.name,'')
		FROM outbound_transactions ot
		LEFT JOIN warehouses w ON ot.warehouse_id=w.id
		LEFT JOIN users u ON ot.created_by=u.id
		WHERE ot.id=?`, id).
		Scan(&refNum, &status, &notes, &outDate, &warehouseName, &createdBy)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Outbound tidak ditemukan"})
		return
	}

	rows, _ := h.DB.Query(`
		SELECT oi.id, i.name, i.sku, oi.qty, oi.unit_price
		FROM outbound_items oi JOIN items i ON oi.item_id=i.id
		WHERE oi.outbound_id=?`, id)
	defer rows.Close()
	var items []gin.H
	for rows.Next() {
		var iid, name, sku string
		var qty int
		var price float64
		rows.Scan(&iid, &name, &sku, &qty, &price)
		items = append(items, gin.H{"id": iid, "name": name, "sku": sku, "qty": qty, "unit_price": price})
	}
	if items == nil { items = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id": id, "ref_number": refNum, "status": status, "notes": notes,
		"transaction_date": outDate.Format("2006-01-02"),
		"warehouse": warehouseName, "created_by": createdBy, "items": items,
	}})
}

// ══════════════════════════════════════════════════════════════
//  ADVANCED REPORTS
// ══════════════════════════════════════════════════════════════

func (h *Handler) GetKartuStok(c *gin.Context) {
	itemID := c.Query("item_id")
	warehouseID := c.Query("warehouse_id")
	from := c.DefaultQuery("from", time.Now().AddDate(0, -1, 0).Format("2006-01-02"))
	to := c.DefaultQuery("to", time.Now().Format("2006-01-02"))

	if itemID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Parameter item_id wajib diisi"})
		return
	}

	// Stok awal
	var sysStock int
	h.DB.QueryRow(`
		SELECT COALESCE(current_stock,0) FROM item_stocks 
		WHERE item_id=? AND (?='' OR warehouse_id=?)`, itemID, warehouseID).Scan(&sysStock)

	// Mutasi: gabung inbound + outbound + transfer
	rows, err := h.DB.Query(`
		SELECT 'MASUK' as type, t.transaction_date, t.ref_number, ii.qty, 0 as out_qty, COALESCE(w.name,'')
		FROM inbound_items ii
		JOIN inbound_transactions t ON ii.inbound_id=t.id
		JOIN warehouses w ON t.warehouse_id=w.id
		WHERE ii.item_id=? AND t.transaction_date BETWEEN ? AND ?
		  AND (?='' OR t.warehouse_id=?)
		UNION ALL
		SELECT 'KELUAR', t.transaction_date, t.ref_number, 0, oi.qty, COALESCE(w.name,'')
		FROM outbound_items oi
		JOIN outbound_transactions t ON oi.outbound_id=t.id
		JOIN warehouses w ON t.warehouse_id=w.id
		WHERE oi.item_id=? AND t.transaction_date BETWEEN ? AND ?
		  AND (?='' OR t.warehouse_id=?)
		ORDER BY transaction_date ASC`, itemID, warehouseID, from, to)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}, "opening_stock": 0})
		return
	}
	defer rows.Close()

	var mutations []gin.H
	running := sysStock
	for rows.Next() {
		var mType, refNum, warehouseName string
		var mDate time.Time
		var inQty, outQty int
		rows.Scan(&mType, &mDate, &refNum, &inQty, &outQty, &warehouseName)
		running += inQty - outQty
		mutations = append(mutations, gin.H{
			"type": mType, "date": mDate.Format("2006-01-02"),
			"ref": refNum, "in": inQty, "out": outQty,
			"balance": running, "warehouse": warehouseName,
		})
	}
	if mutations == nil { mutations = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": mutations, "opening_stock": sysStock, "from": from, "to": to})
}

func (h *Handler) GetAgingInvoice(c *gin.Context) {
	today := time.Now()
	rows, err := h.DB.Query(`
		SELECT i.id, i.invoice_number, i.total_amount, i.remaining_amount,
		       i.due_date, i.status, COALESCE(s.name,'')
		FROM invoices i LEFT JOIN suppliers s ON i.supplier_id=s.id
		WHERE i.status NOT IN ('paid', 'cancelled')
		ORDER BY i.due_date ASC`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}, "summary": gin.H{}})
		return
	}
	defer rows.Close()

	buckets := map[string]float64{"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
	var list []gin.H
	for rows.Next() {
		var id, invNum, status, supplierName string
		var total, remaining float64
		var dueDate time.Time
		rows.Scan(&id, &invNum, &total, &remaining, &dueDate, &status, &supplierName)
		days := int(today.Sub(dueDate).Hours() / 24)
		bucket := "current"
		if days > 0 && days <= 30 { bucket = "1_30" } else if days > 30 && days <= 60 { bucket = "31_60" } else if days > 60 && days <= 90 { bucket = "61_90" } else if days > 90 { bucket = "over_90" }
		buckets[bucket] += remaining
		list = append(list, gin.H{
			"id": id, "invoice_number": invNum, "total": total,
			"remaining": remaining, "due_date": dueDate.Format("2006-01-02"),
			"days_overdue": days, "bucket": bucket, "status": status, "supplier": supplierName,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list, "summary": buckets})
}

func (h *Handler) GetStockValuation(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT i.id, i.name, i.sku, i.selling_price, COALESCE(SUM(s.current_stock),0) as total_stock,
		       COALESCE(c.name,'') as category
		FROM items i
		LEFT JOIN item_stocks s ON i.id=s.item_id
		LEFT JOIN categories c ON i.category_id=c.id
		WHERE i.is_active=true
		GROUP BY i.id, i.name, i.sku, i.selling_price, c.name
		ORDER BY (i.selling_price * COALESCE(SUM(s.current_stock),0)) DESC`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}, "total_value": 0})
		return
	}
	defer rows.Close()
	var list []gin.H
	totalValue := 0.0
	for rows.Next() {
		var id, name, sku, category string
		var price float64
		var stock int
		rows.Scan(&id, &name, &sku, &price, &stock, &category)
		value := price * float64(stock)
		totalValue += value
		list = append(list, gin.H{
			"id": id, "name": name, "sku": sku, "category": category,
			"unit_price": price, "stock": stock, "value": value,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list, "total_value": totalValue})
}

func (h *Handler) GetBudgetRealization(c *gin.Context) {
	year := c.DefaultQuery("year", fmt.Sprintf("%d", time.Now().Year()))
	rows, err := h.DB.Query(`
		SELECT b.id, b.name, b.period, b.total_amount as budget,
		       COALESCE(b.spent_amount,0) as spent,
		       b.total_amount - COALESCE(b.spent_amount,0) as remaining,
		       CASE WHEN b.total_amount > 0 
		            THEN ROUND((COALESCE(b.spent_amount,0)/b.total_amount)*100,1)
		            ELSE 0 END as pct_used
		FROM budgets b
		WHERE YEAR(b.start_date) = ?
		ORDER BY b.period`, year)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": []gin.H{}})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, name, period string
		var budget, spent, remaining, pctUsed float64
		rows.Scan(&id, &name, &period, &budget, &spent, &remaining, &pctUsed)
		list = append(list, gin.H{
			"id": id, "name": name, "period": period,
			"budget": budget, "spent": spent, "remaining": remaining, "pct_used": pctUsed,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list, "year": year})
}

// ══════════════════════════════════════════════════════════════
//  EXPORT CSV
// ══════════════════════════════════════════════════════════════

func (h *Handler) ExportItemsCSV(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT i.name, i.sku, COALESCE(c.name,''), COALESCE(u.name,''),
		       i.selling_price, COALESCE(SUM(s.current_stock),0), i.min_stock
		FROM items i
		LEFT JOIN categories c ON i.category_id=c.id
		LEFT JOIN units u ON i.unit_id=u.id
		LEFT JOIN item_stocks s ON i.id=s.item_id
		WHERE i.is_active=true
		GROUP BY i.id, i.name, i.sku, c.name, u.name, i.selling_price, i.min_stock
		ORDER BY i.name`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Gagal export"})
		return
	}
	defer rows.Close()

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=inventaris_"+time.Now().Format("20060102")+".csv")
	c.Writer.Write([]byte("\xEF\xBB\xBF")) // BOM for Excel
	c.Writer.WriteString("Nama Item,SKU,Kategori,Satuan,Harga,Stok Total,Stok Min\n")
	for rows.Next() {
		var name, sku, cat, unit string
		var price float64
		var stock, minStock int
		rows.Scan(&name, &sku, &cat, &unit, &price, &stock, &minStock)
		c.Writer.WriteString(fmt.Sprintf("%s,%s,%s,%s,%.0f,%d,%d\n",
			escapeCsv(name), escapeCsv(sku), escapeCsv(cat), escapeCsv(unit), price, stock, minStock))
	}
}

func (h *Handler) ExportInvoicesCSV(c *gin.Context) {
	rows, _ := h.DB.Query(`
		SELECT i.invoice_number, COALESCE(s.name,''), i.invoice_date, i.due_date,
		       i.total_amount, COALESCE(i.paid_amount,0), i.status
		FROM invoices i LEFT JOIN suppliers s ON i.supplier_id=s.id
		ORDER BY i.invoice_date DESC`)
	defer rows.Close()

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=invoice_"+time.Now().Format("20060102")+".csv")
	c.Writer.Write([]byte("\xEF\xBB\xBF"))
	c.Writer.WriteString("No. Invoice,Supplier,Tgl. Invoice,Jatuh Tempo,Total,Sudah Dibayar,Sisa,Status\n")
	for rows.Next() {
		var invNum, supplier, status string
		var invDate, dueDate time.Time
		var total, paid float64
		rows.Scan(&invNum, &supplier, &invDate, &dueDate, &total, &paid, &status)
		c.Writer.WriteString(fmt.Sprintf("%s,%s,%s,%s,%.0f,%.0f,%.0f,%s\n",
			escapeCsv(invNum), escapeCsv(supplier),
			invDate.Format("2006-01-02"), dueDate.Format("2006-01-02"),
			total, paid, total-paid, status))
	}
}

func escapeCsv(s string) string {
	// Wrap in quotes if contains comma or newline
	for _, ch := range s {
		if ch == ',' || ch == '\n' || ch == '"' {
			return `"` + s + `"`
		}
	}
	return s
}

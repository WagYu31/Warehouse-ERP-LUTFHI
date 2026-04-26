package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ── Suppliers ─────────────────────────────────────────────────
func (h *Handler) GetSuppliers(c *gin.Context) {
	search := c.Query("search")
	q := `SELECT id, code, name, email, phone, city, is_active FROM suppliers WHERE 1=1`
	args := []interface{}{}
	if search != "" {
		q += ` AND (name LIKE ? OR email LIKE ?)`
		args = append(args, "%"+search+"%")
	}
	q += ` ORDER BY name`

	rows, _ := h.DB.Query(q, args...)
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, name string
		var code, email, phone, city sql.NullString
		var isActive bool
		rows.Scan(&id, &code, &name, &email, &phone, &city, &isActive)
		list = append(list, gin.H{
			"id": id, "code": code.String, "name": name, "email": email.String,
			"phone": phone.String, "city": city.String, "is_active": isActive,
		})
	}
	if list == nil { list = []gin.H{} }
	c.JSON(http.StatusOK, gin.H{"data": list, "total": len(list)})
}

func (h *Handler) CreateSupplier(c *gin.Context) {
	var b struct {
		Name  string `json:"name" binding:"required"`
		Email string `json:"email"`
		Phone string `json:"phone"`
		City  string `json:"city"`
		Code  string `json:"code"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	id := uuid.New().String()
	h.DB.Exec(`INSERT INTO suppliers (id,code,name,email,phone,city) VALUES (?,?,?,?,?,?)`,
		id, b.Code, b.Name, b.Email, b.Phone, b.City)
	c.JSON(http.StatusCreated, gin.H{"message": "Supplier berhasil ditambahkan", "id": id})
}

func (h *Handler) UpdateSupplier(c *gin.Context) {
	id := c.Param("id")
	var b struct {
		Name  string `json:"name"`
		Email string `json:"email"`
		Phone string `json:"phone"`
		City  string `json:"city"`
	}
	c.ShouldBindJSON(&b)
	h.DB.Exec(`UPDATE suppliers SET name=?,email=?,phone=?,city=?,updated_at=? WHERE id=?`,
		b.Name, b.Email, b.Phone, b.City, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "Supplier diperbarui"})
}

func (h *Handler) DeleteSupplier(c *gin.Context) {
	h.DB.Exec(`UPDATE suppliers SET is_active=false WHERE id=?`, c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"message": "Supplier dinonaktifkan"})
}

// ── Items (Barang) ────────────────────────────────────────────
func (h *Handler) GetItems(c *gin.Context) {
	search := "%" + c.Query("search") + "%"
	warehouseID := c.Query("warehouse_id")

	var rows *sql.Rows
	var err error

	if warehouseID != "" {
		rows, err = h.DB.Query(`
			SELECT i.id, i.sku, i.name, i.min_stock, i.price, i.is_active,
				   COALESCE(c.name,''), COALESCE(u.abbreviation,''),
				   COALESCE(SUM(s.current_stock),0)
			FROM items i
			LEFT JOIN categories c ON i.category_id = c.id
			LEFT JOIN units u ON i.unit_id = u.id
			LEFT JOIN item_stocks s ON i.id = s.item_id AND s.warehouse_id = ?
			WHERE i.is_active = true AND (i.name LIKE ? OR i.sku LIKE ?)
			GROUP BY i.id, i.sku, i.name, i.min_stock, i.price, i.is_active, c.name, u.abbreviation
			ORDER BY i.name`, warehouseID, search)
	} else {
		rows, err = h.DB.Query(`
			SELECT i.id, i.sku, i.name, i.min_stock, i.price, i.is_active,
				   COALESCE(c.name,''), COALESCE(u.abbreviation,''),
				   COALESCE(SUM(s.current_stock),0)
			FROM items i
			LEFT JOIN categories c ON i.category_id = c.id
			LEFT JOIN units u ON i.unit_id = u.id
			LEFT JOIN item_stocks s ON i.id = s.item_id
			WHERE i.is_active = true AND (i.name LIKE ? OR i.sku LIKE ?)
			GROUP BY i.id, i.sku, i.name, i.min_stock, i.price, i.is_active, c.name, u.abbreviation
			ORDER BY i.name`, search)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, sku, name, category, unit string
		var minStock, totalStock int
		var price float64
		var isActive bool
		rows.Scan(&id, &sku, &name, &minStock, &price, &isActive, &category, &unit, &totalStock)

		status := "normal"
		if totalStock <= 0 {
			status = "kosong"
		} else if totalStock <= minStock {
			status = "kritis"
		}

		list = append(list, gin.H{
			"id": id, "sku": sku, "name": name, "category": category,
			"unit": unit, "min_stock": minStock, "current_stock": totalStock,
			"price": price, "status": status, "is_active": isActive,
		})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{"data": list, "total": len(list)})
}

func (h *Handler) GetItem(c *gin.Context) {
	id := c.Param("id")
	var item struct {
		ID       string  `json:"id"`
		SKU      string  `json:"sku"`
		Name     string  `json:"name"`
		MinStock int     `json:"min_stock"`
		Price    float64 `json:"price"`
		IsActive bool    `json:"is_active"`
	}
	err := h.DB.QueryRow(`SELECT id,sku,name,min_stock,price,is_active FROM items WHERE id=?`, id).
		Scan(&item.ID, &item.SKU, &item.Name, &item.MinStock, &item.Price, &item.IsActive)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Barang tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *Handler) CreateItem(c *gin.Context) {
	var b struct {
		SKU        string  `json:"sku" binding:"required"`
		Name       string  `json:"name" binding:"required"`
		CategoryID string  `json:"category_id"`
		UnitID     string  `json:"unit_id"`
		MinStock   int     `json:"min_stock"`
		Price      float64 `json:"price"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	id := uuid.New().String()
	_, err := h.DB.Exec(`INSERT INTO items (id,sku,name,category_id,unit_id,min_stock,price) VALUES (?,?,?,?,?,?,?)`,
		id, b.SKU, b.Name, nullStr(b.CategoryID), nullStr(b.UnitID), b.MinStock, b.Price)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "SKU sudah digunakan"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Barang berhasil ditambahkan", "id": id})
}

func (h *Handler) UpdateItem(c *gin.Context) {
	id := c.Param("id")
	var b struct {
		Name     string  `json:"name"`
		MinStock int     `json:"min_stock"`
		Price    float64 `json:"price"`
	}
	c.ShouldBindJSON(&b)
	h.DB.Exec(`UPDATE items SET name=?,min_stock=?,price=?,updated_at=? WHERE id=?`,
		b.Name, b.MinStock, b.Price, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "Barang diperbarui"})
}

func (h *Handler) DeleteItem(c *gin.Context) {
	h.DB.Exec(`UPDATE items SET is_active=false WHERE id=?`, c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"message": "Barang dinonaktifkan"})
}

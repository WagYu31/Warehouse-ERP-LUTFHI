package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ── GET /api/users/me ────────────────────────────────────────
func (h *Handler) GetMe(c *gin.Context) {
	userID := c.GetString("user_id")
	var user struct {
		ID        string  `json:"id"`
		Name      string  `json:"name"`
		Email     string  `json:"email"`
		Role      string  `json:"role"`
		Phone     *string `json:"phone"`
		AvatarURL *string `json:"avatar_url"`
		IsActive  bool    `json:"is_active"`
	}
	err := h.DB.QueryRow(`SELECT id, name, email, role, phone, avatar_url, is_active FROM users WHERE id = ?`, userID).
		Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.Phone, &user.AvatarURL, &user.IsActive)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "User tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": user})
}

// ── PUT /api/users/me ────────────────────────────────────────
func (h *Handler) UpdateMe(c *gin.Context) {
	userID := c.GetString("user_id")
	var body struct {
		Name  string `json:"name"`
		Phone string `json:"phone"`
	}
	c.ShouldBindJSON(&body)
	h.DB.Exec(`UPDATE users SET name=?, phone=?, updated_at=? WHERE id=?`,
		body.Name, body.Phone, time.Now(), userID)
	c.JSON(http.StatusOK, gin.H{"message": "Profil berhasil diperbarui"})
}

// ── GET /api/users ────────────────────────────────────────────
func (h *Handler) GetUsers(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
		       COALESCE(uw.warehouse_id,''), COALESCE(w.name,'')
		FROM users u
		LEFT JOIN user_warehouses uw ON uw.user_id=u.id
		LEFT JOIN warehouses w ON w.id=uw.warehouse_id
		ORDER BY u.created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	defer rows.Close()
	var users []gin.H
	for rows.Next() {
		var id, name, email, role, warehouseID, warehouseName string
		var isActive bool
		var createdAt time.Time
		rows.Scan(&id, &name, &email, &role, &isActive, &createdAt, &warehouseID, &warehouseName)
		users = append(users, gin.H{
			"id": id, "name": name, "email": email,
			"role": role, "is_active": isActive, "created_at": createdAt,
			"warehouse_id": warehouseID, "warehouse_name": warehouseName,
		})
	}
	if users == nil {
		users = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{"data": users, "total": len(users)})
}

// ── POST /api/users ───────────────────────────────────────────
func (h *Handler) CreateUser(c *gin.Context) {
	var body struct {
		Name        string `json:"name" binding:"required"`
		Email       string `json:"email" binding:"required,email"`
		Password    string `json:"password" binding:"required,min=6"`
		Role        string `json:"role" binding:"required"`
		WarehouseID string `json:"warehouse_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
	id := uuid.New().String()
	_, err := h.DB.Exec(
		`INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES (?,?,?,?,?,1)`,
		id, body.Name, body.Email, string(hash), body.Role,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Email sudah terdaftar"})
		return
	}
	if body.WarehouseID != "" {
		h.DB.Exec(`INSERT INTO user_warehouses (user_id,warehouse_id,is_primary) VALUES (?,?,1)`,
			id, body.WarehouseID)
	}
	c.JSON(http.StatusCreated, gin.H{"message": "User berhasil dibuat", "id": id})
}

// ── PUT /api/users/:id ────────────────────────────────────────
func (h *Handler) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		Name        string `json:"name"`
		Role        string `json:"role"`
		IsActive    *bool  `json:"is_active"`
		WarehouseID string `json:"warehouse_id"`
	}
	c.ShouldBindJSON(&body)
	h.DB.Exec(`UPDATE users SET name=?, role=?, is_active=?, updated_at=? WHERE id=?`,
		body.Name, body.Role, body.IsActive, time.Now(), id)
	// Update warehouse assignment: hapus lama, insert baru
	h.DB.Exec(`DELETE FROM user_warehouses WHERE user_id=?`, id)
	if body.WarehouseID != "" {
		h.DB.Exec(`INSERT INTO user_warehouses (user_id,warehouse_id,is_primary) VALUES (?,?,1)`,
			id, body.WarehouseID)
	}
	c.JSON(http.StatusOK, gin.H{"message": "User berhasil diperbarui"})
}

// ── DELETE /api/users/:id ─────────────────────────────────────
func (h *Handler) DeleteUser(c *gin.Context) {
	id := c.Param("id")
	h.DB.Exec(`UPDATE users SET is_active=false WHERE id=?`, id)
	c.JSON(http.StatusOK, gin.H{"message": "User dinonaktifkan"})
}

// ── GET /api/warehouses ───────────────────────────────────────
func (h *Handler) GetWarehouses(c *gin.Context) {
	rows, _ := h.DB.Query(`
		SELECT w.id, w.code, w.name, COALESCE(w.city,''), COALESCE(w.address,''), w.is_active,
		       COALESCE(u.name,''), COALESCE(u.phone,'')
		FROM warehouses w
		LEFT JOIN user_warehouses uw ON uw.warehouse_id=w.id
		LEFT JOIN users u ON u.id=uw.user_id AND u.role='staff' AND u.is_active=1
		ORDER BY w.name`)
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, code, name, city, address, picName, picPhone string
		var isActive bool
		rows.Scan(&id, &code, &name, &city, &address, &isActive, &picName, &picPhone)
		list = append(list, gin.H{
			"id": id, "code": code, "name": name,
			"city": city, "address": address, "is_active": isActive,
			"pic_name": picName, "pic_phone": picPhone,
		})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateWarehouse(c *gin.Context) {
	var b struct {
		Code string `json:"code"`
		Name string `json:"name"`
		City string `json:"city"`
	}
	c.ShouldBindJSON(&b)
	id := uuid.New().String()
	h.DB.Exec(`INSERT INTO warehouses (id,code,name,city) VALUES (?,?,?,?)`, id, b.Code, b.Name, b.City)
	c.JSON(http.StatusCreated, gin.H{"message": "Gudang berhasil dibuat", "id": id})
}

func (h *Handler) UpdateWarehouse(c *gin.Context) {
	id := c.Param("id")
	var b struct {
		Name string `json:"name"`
		City string `json:"city"`
	}
	c.ShouldBindJSON(&b)
	h.DB.Exec(`UPDATE warehouses SET name=?,city=?,updated_at=? WHERE id=?`, b.Name, b.City, time.Now(), id)
	c.JSON(http.StatusOK, gin.H{"message": "Gudang diperbarui"})
}

func (h *Handler) DeleteWarehouse(c *gin.Context) {
	h.DB.Exec(`UPDATE warehouses SET is_active=false WHERE id=?`, c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"message": "Gudang dinonaktifkan"})
}

// ── Categories ────────────────────────────────────────────────
func (h *Handler) GetCategories(c *gin.Context) {
	rows, _ := h.DB.Query(`SELECT id, name FROM categories ORDER BY name`)
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, name string
		rows.Scan(&id, &name)
		list = append(list, gin.H{"id": id, "name": name})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateCategory(c *gin.Context) {
	var b struct{ Name string `json:"name"` }
	c.ShouldBindJSON(&b)
	id := uuid.New().String()
	h.DB.Exec(`INSERT INTO categories (id,name) VALUES (?,?)`, id, b.Name)
	c.JSON(http.StatusCreated, gin.H{"message": "Kategori dibuat", "id": id})
}

// ── Units ─────────────────────────────────────────────────────
func (h *Handler) GetUnits(c *gin.Context) {
	rows, _ := h.DB.Query(`SELECT id, name, abbreviation FROM units ORDER BY name`)
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, name, abbr string
		rows.Scan(&id, &name, &abbr)
		list = append(list, gin.H{"id": id, "name": name, "abbreviation": abbr})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) CreateUnit(c *gin.Context) {
	var b struct {
		Name         string `json:"name"`
		Abbreviation string `json:"abbreviation"`
	}
	c.ShouldBindJSON(&b)
	id := uuid.New().String()
	h.DB.Exec(`INSERT INTO units (id,name,abbreviation) VALUES (?,?,?)`, id, b.Name, b.Abbreviation)
	c.JSON(http.StatusCreated, gin.H{"message": "Satuan dibuat", "id": id})
}

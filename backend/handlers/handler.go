package handlers

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler adalah struct utama yang menyimpan akses ke database
type Handler struct {
	DB *sql.DB
}

// NewHandler — constructor
func NewHandler(db *sql.DB) *Handler {
	return &Handler{DB: db}
}

// ── Pagination Helper ────────────────────────────────────────

type PaginationResult struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
	HasNext    bool        `json:"has_next"`
	HasPrev    bool        `json:"has_prev"`
}

func getPagination(c *gin.Context) (page, limit, offset int) {
	page = 1
	limit = 20
	if p := c.Query("page"); p != "" {
		fmt.Sscan(p, &page)
		if page < 1 { page = 1 }
	}
	if l := c.Query("limit"); l != "" {
		fmt.Sscan(l, &limit)
		if limit < 1 { limit = 1 }
		if limit > 200 { limit = 200 }
	}
	offset = (page - 1) * limit
	return
}

func buildPaginationResponse(data interface{}, total, page, limit int) PaginationResult {
	totalPages := (total + limit - 1) / limit
	return PaginationResult{
		Data:       data,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
		HasNext:    page < totalPages,
		HasPrev:    page > 1,
	}
}

// ── String Helper ─────────────────────────────────────────────

func nullStr(s string) interface{} {
	if s == "" { return nil }
	return s
}

// ── Filter Builder ────────────────────────────────────────────

type QueryFilter struct {
	Wheres []string
	Args   []interface{}
	idx    int
}

func NewFilter() *QueryFilter {
	return &QueryFilter{idx: 1}
}

func (f *QueryFilter) AddIf(cond bool, clause string, val interface{}) {
	if cond {
		f.Wheres = append(f.Wheres, fmt.Sprintf(clause, f.idx))
		f.Args = append(f.Args, val)
		f.idx++
	}
}

func (f *QueryFilter) Add(clause string, val interface{}) {
	f.Wheres = append(f.Wheres, fmt.Sprintf(clause, f.idx))
	f.Args = append(f.Args, val)
	f.idx++
}

func (f *QueryFilter) WhereClause() string {
	if len(f.Wheres) == 0 { return "" }
	return " WHERE " + strings.Join(f.Wheres, " AND ")
}

func (f *QueryFilter) NextIdx() int { return f.idx }

// ── UUID Generator ─────────────────────────────────────────────

func newID() string { return uuid.New().String() }

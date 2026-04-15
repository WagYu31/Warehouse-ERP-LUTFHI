package handlers

import "github.com/gin-gonic/gin"

// Placeholder handlers untuk routes yang belum diimplementasi penuh
func (h *Handler) GetReorders(c *gin.Context) {
	c.JSON(200, gin.H{"data": []gin.H{}, "message": "Reorder suggestions coming soon"})
}

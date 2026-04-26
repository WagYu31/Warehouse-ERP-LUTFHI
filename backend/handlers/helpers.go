package handlers

import "github.com/gin-gonic/gin"

// warehouseFilter returns SQL WHERE fragment and args for warehouse-scoped access.
// staff role → filter by warehouse_id. Others (admin, manager, finance) → no filter.
// If warehouse not assigned yet → no filter (safe fallback).
func warehouseFilter(c *gin.Context, tableAlias string) (string, []interface{}) {
	role := c.GetString("role")
	warehouseID := c.GetString("warehouse_id")
	if role == "staff" && warehouseID != "" {
		return " AND " + tableAlias + ".warehouse_id = ?", []interface{}{warehouseID}
	}
	return "", nil
}

// requesterFilter returns SQL WHERE fragment and args for requester-scoped access.
// requester role → only see their own requests.
func requesterFilter(c *gin.Context, tableAlias string) (string, []interface{}) {
	role := c.GetString("role")
	if role == "requester" {
		userID := c.GetString("user_id")
		return " AND " + tableAlias + ".requested_by = ?", []interface{}{userID}
	}
	return "", nil
}

// buildArgs merges variadic arg slices for use in DB.Query
func buildArgs(slices ...[]interface{}) []interface{} {
	var result []interface{}
	for _, s := range slices {
		result = append(result, s...)
	}
	return result
}

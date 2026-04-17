#!/bin/bash
# ============================================================
#  WMS LUTFHI — Backend Startup Script (Linux/DomaiNesia)
#  Letakkan bersama wms-backend-linux di folder backend/
#  Jalankan: bash start.sh
# ============================================================

cd "$(dirname "$0")"

# ── WAJIB DIGANTI sesuai database DomaiNesia ─────────────────
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=GANTI_INI          # username DB dari panel DomaiNesia
export DB_PASSWORD=GANTI_INI      # password DB dari panel DomaiNesia
export DB_NAME=GANTI_INI          # nama database dari panel DomaiNesia
export DB_SSL_MODE=disable

# ── App Config ────────────────────────────────────────────────
export APP_ENV=production
export APP_PORT=8090
export JWT_SECRET=WmsLutfhi2026_SecretKey_SangatAmanDanPanjangMin32Char
export CORS_ALLOWED_ORIGINS=https://alumni590.web.id,http://alumni590.web.id

# ── Start Backend ─────────────────────────────────────────────
chmod +x ./wms-backend-linux

# Kill proses lama jika ada
pkill -f wms-backend-linux 2>/dev/null && echo "🔄 Restart backend..." || echo "🚀 Starting backend..."
sleep 1

# Jalankan di background
nohup ./wms-backend-linux >> wms.log 2>&1 &
BACKEND_PID=$!

sleep 2
if kill -0 $BACKEND_PID 2>/dev/null; then
  echo "✅ Backend berjalan! PID: $BACKEND_PID port: $APP_PORT"
  echo "📋 Log: tail -f wms.log"
else
  echo "❌ Backend gagal start. Cek error:"
  tail -20 wms.log
fi

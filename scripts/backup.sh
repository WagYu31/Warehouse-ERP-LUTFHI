#!/bin/bash
# ============================================================
#  WMS LUTFHI — Auto Database Backup Script
#  Jalankan via cron: 0 2 * * * /opt/wms/scripts/backup.sh
# ============================================================

set -e

# Load env
source /opt/wms/.env 2>/dev/null || true

# Config
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/wms}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-wms_user}"
DB_NAME="${DB_NAME:-wms_lutfhi}"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="wms_backup_${TIMESTAMP}.sql.gz"

# Buat direktori backup
mkdir -p "$BACKUP_DIR"

echo "[$(date)] 🔄 Mulai backup database WMS LUTFHI..."

# Dump & compress
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" -p "$DB_PORT" \
  -U "$DB_USER" "$DB_NAME" \
  --no-owner --no-privileges \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

SIZE=$(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[$(date)] ✅ Backup selesai: ${FILENAME} (${SIZE})"

# Upload ke MinIO (jika tersedia)
if command -v mc &> /dev/null && [ -n "$MINIO_ENDPOINT" ]; then
  mc alias set wms-minio "http://${MINIO_ENDPOINT}" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --quiet 2>/dev/null || true
  mc cp "${BACKUP_DIR}/${FILENAME}" "wms-minio/wms-backups/${FILENAME}" 2>/dev/null && \
    echo "[$(date)] ☁️  Upload ke MinIO berhasil" || \
    echo "[$(date)] ⚠️  Upload MinIO gagal, backup tersimpan lokal"
fi

# Hapus backup lama
echo "[$(date)] 🗑️  Menghapus backup lebih dari ${RETENTION} hari..."
find "$BACKUP_DIR" -name "wms_backup_*.sql.gz" -mtime "+${RETENTION}" -delete

echo "[$(date)] 🎉 Proses backup selesai!"
echo "[$(date)] 📁 Backup tersedia di: ${BACKUP_DIR}/"
ls -lh "$BACKUP_DIR" | tail -5

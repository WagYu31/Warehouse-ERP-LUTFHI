# WMS LUTFHI — Warehouse Management System & ERP Mini

> Sistem manajemen gudang dan ERP terintegrasi dengan 5 role akses berbeda.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Go (Gin Framework) |
| Database | PostgreSQL 15 |
| Cache | Redis |
| Storage | MinIO (S3-compatible) |
| Container | Docker + Docker Compose |

## Fitur Utama

### WMS (Warehouse Management System)
- ✅ Manajemen Inventaris Stok multi-gudang
- ✅ Barang Masuk (GRN / Goods Receipt)
- ✅ Barang Keluar (Outbound)
- ✅ Permintaan Barang (SPB)
- ✅ Stock Opname (perhitungan fisik)
- ✅ Transfer Stok antar gudang
- ✅ Reorder Point & konfigurasi otomatis

### ERP Mini
- ✅ Purchase Order (Draft → Sent → Complete)
- ✅ Manajemen Supplier
- ✅ Invoice & Catat Pembayaran
- ✅ Budget & Realisasi Anggaran
- ✅ Laporan ERP (KPI, grafik status)

### Sistem & Admin
- ✅ RBAC 5 role (Admin, Staff, Finance, Manager, Requester)
- ✅ JWT Authentication + Refresh Token
- ✅ Notifikasi real-time stok kritis
- ✅ Edit Profil & Ganti Password
- ✅ Master Data (Kategori & Satuan)
- ✅ Manajemen Gudang & Pengguna
- ✅ Audit-ready (tabel audit_logs)

## Akun Demo

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@wms-lutfhi.com | Admin@2026 |
| Staff | staff@wms-lutfhi.com | Staff@2026 |
| Finance | finance@wms-lutfhi.com | Finance@2026 |
| Manager | manager@wms-lutfhi.com | Manager@2026 |
| Requester | requester@wms-lutfhi.com | Requester@2026 |

## Cara Menjalankan

### Development (dengan Dev DB)
```bash
# Start database services
docker compose -f docker-compose.dev.yml up -d

# Start backend
cd backend
go run main.go

# Start frontend
cd frontend
npm install
npm run dev
```

### Production
```bash
docker compose up -d
```

### Environment Variables (backend)
```
DB_HOST=localhost
DB_PORT=5435
DB_USER=wms_user
DB_PASSWORD=<your_password>
DB_NAME=wms_lutfhi
JWT_SECRET=<your_secret>
APP_PORT=8090
```

## Struktur Proyek

```
├── backend/
│   ├── handlers/       # HTTP handlers (auth, users, items, transactions, features)
│   ├── middleware/     # JWT auth middleware
│   ├── database/       # DB migrations & seeds
│   └── main.go         # Entry point + routing (67 routes)
├── frontend/
│   ├── src/
│   │   ├── pages/      # React pages per modul
│   │   ├── layouts/    # AppLayout dengan sidebar & notifikasi
│   │   ├── components/ # Reusable UI components
│   │   ├── services/   # Axios API client
│   │   └── store/      # Zustand state management
│   └── vite.config.js
├── docker-compose.yml
└── docker-compose.dev.yml
```

## API Endpoints

Backend berjalan di `http://localhost:8090/api`

- **Auth:** `POST /auth/login`, `POST /auth/refresh`
- **WMS:** `/inventory`, `/inbound`, `/outbound`, `/requests`, `/opname`, `/stock-transfers`
- **ERP:** `/erp/purchase-orders`, `/erp/invoices`, `/erp/budgets`, `/erp/reorder-configs`
- **Admin:** `/users`, `/warehouses`, `/categories`, `/units`, `/suppliers`
- **Alerts:** `/notifications`, `/alerts/low-stock`

---
*Built with ❤️ — WMS LUTFHI Enterprise v2.0*

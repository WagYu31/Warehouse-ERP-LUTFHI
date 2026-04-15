-- ============================================================
-- SEED DATA LENGKAP WMS LUTFHI
-- ============================================================

-- ── Warehouses ──────────────────────────────────────────────
INSERT INTO warehouses (id, code, name, address, city, capacity, manager, phone, is_active) VALUES
  ('aaaa0001-0000-0000-0000-000000000001','GDG-001','Gudang Utama Jakarta','Jl. Industri Raya No. 1, Kawasan Industri Pulogadung','Jakarta',5000,'Budi Santoso','021-4601234',true),
  ('aaaa0001-0000-0000-0000-000000000002','GDG-002','Gudang Surabaya','Jl. Rungkut Industri No. 45','Surabaya',3000,'Agus Wijaya','031-8411234',true),
  ('aaaa0001-0000-0000-0000-000000000003','GDG-003','Gudang Bandung','Jl. Soekarno Hatta No. 789','Bandung',2000,'Rina Dewi','022-6031234',true),
  ('aaaa0001-0000-0000-0000-000000000004','GDG-004','Gudang Medan','Jl. Gatot Subroto No. 21','Medan',1500,'Hendra Kusuma','061-4551234',true),
  ('aaaa0001-0000-0000-0000-000000000005','GDG-005','Gudang Transit Bekasi','Jl. M.H. Thamrin No. 5, Bekasi Industrial','Bekasi',1200,'Sari Indah','021-8851234',true)
ON CONFLICT (code) DO NOTHING;

-- ── Departments ─────────────────────────────────────────────
INSERT INTO departments (id, code, name) VALUES
  ('bbbb0001-0000-0000-0000-000000000001','DEPT-IT','Divisi Teknologi Informasi'),
  ('bbbb0001-0000-0000-0000-000000000002','DEPT-OPS','Divisi Operasional'),
  ('bbbb0001-0000-0000-0000-000000000003','DEPT-FIN','Divisi Keuangan'),
  ('bbbb0001-0000-0000-0000-000000000004','DEPT-HRD','Divisi Sumber Daya Manusia'),
  ('bbbb0001-0000-0000-0000-000000000005','DEPT-MKT','Divisi Marketing')
ON CONFLICT (code) DO NOTHING;

-- ── Categories ──────────────────────────────────────────────
INSERT INTO categories (id, code, name, description) VALUES
  ('cccc0001-0000-0000-0000-000000000001','CAT-ELK','Elektronik','Perangkat elektronik dan aksesoris'),
  ('cccc0001-0000-0000-0000-000000000002','CAT-ATK','Alat Tulis Kantor','Perlengkapan tulis menulis dan kantor'),
  ('cccc0001-0000-0000-0000-000000000003','CAT-PKT','Peralatan Kantor','Furniture dan peralatan kantor'),
  ('cccc0001-0000-0000-0000-000000000004','CAT-KLN','Kebersihan','Produk kebersihan dan sanitasi'),
  ('cccc0001-0000-0000-0000-000000000005','CAT-KMP','Komputer','Hardware dan komponen komputer'),
  ('cccc0001-0000-0000-0000-000000000006','CAT-NET','Jaringan','Peralatan jaringan dan telekomunikasi'),
  ('cccc0001-0000-0000-0000-000000000007','CAT-MBL','Mebel','Furniture dan mebel kantor'),
  ('cccc0001-0000-0000-0000-000000000008','CAT-P3K','Kesehatan','Perlengkapan P3K dan kesehatan')
ON CONFLICT (code) DO NOTHING;

-- ── Units ────────────────────────────────────────────────────
INSERT INTO units (id, code, name, abbreviation) VALUES
  ('dddd0001-0000-0000-0000-000000000001','PCS','Pieces','pcs'),
  ('dddd0001-0000-0000-0000-000000000002','BOX','Box','box'),
  ('dddd0001-0000-0000-0000-000000000003','RIM','Rim','rim'),
  ('dddd0001-0000-0000-0000-000000000004','SET','Set','set'),
  ('dddd0001-0000-0000-0000-000000000005','BTL','Botol','btl'),
  ('dddd0001-0000-0000-0000-000000000006','BUH','Buah','bh'),
  ('dddd0001-0000-0000-0000-000000000007','LTR','Liter','ltr'),
  ('dddd0001-0000-0000-0000-000000000008','KGM','Kilogram','kg'),
  ('dddd0001-0000-0000-0000-000000000009','MTR','Meter','m'),
  ('dddd0001-0000-0000-0000-000000000010','UNT','Unit','unit')
ON CONFLICT (code) DO NOTHING;

-- ── Suppliers ────────────────────────────────────────────────
INSERT INTO suppliers (id, code, name, contact, phone, email, address, city, payment_terms, is_active) VALUES
  ('eeee0001-0000-0000-0000-000000000001','SUP-001','PT. Maju Jaya Electronics','Budi Hartono','021-5501234','budi@majujaya.co.id','Jl. Mangga Dua No. 45','Jakarta',30,true),
  ('eeee0001-0000-0000-0000-000000000002','SUP-002','CV. Sinar Office Supply','Dewi Kurnia','031-9901234','dewi@sinaroffice.com','Jl. Embong Malang No. 12','Surabaya',14,true),
  ('eeee0001-0000-0000-0000-000000000003','SUP-003','PT. Teknologi Prima','Ahmad Fauzi','022-7601234','ahmad@tekprima.id','Jl. Asia Afrika No. 78','Bandung',45,true),
  ('eeee0001-0000-0000-0000-000000000004','SUP-004','UD. Bersih Selalu','Siti Rahayu','021-7701234','siti@bersihselalu.com','Jl. Kramat Raya No. 99','Jakarta',7,true),
  ('eeee0001-0000-0000-0000-000000000005','SUP-005','PT. Furniture Indo','Rizki Pratama','024-8501234','rizki@furnitureindo.co.id','Jl. Pemuda No. 156','Semarang',60,true),
  ('eeee0001-0000-0000-0000-000000000006','SUP-006','CV. Network Solutions','Andi Wijaya','021-6601234','andi@netsol.id','Jl. Tomang Raya No. 34','Jakarta',30,true),
  ('eeee0001-0000-0000-0000-000000000007','SUP-007','PT. Medika Farma','dr. Lina Susanti','031-5601234','lina@medikafarma.co.id','Jl. Diponegoro No. 67','Surabaya',14,true),
  ('eeee0001-0000-0000-0000-000000000008','SUP-008','Toko Komputer Murah','Hasan Wiryo','022-4401234','hasan@tokokomuter.com','Jl. Kebon Jati No. 23','Bandung',0,true)
ON CONFLICT (code) DO NOTHING;

-- ── Items ─────────────────────────────────────────────────────
INSERT INTO items (id, sku, name, category_id, unit_id, min_stock, price, description, is_active) VALUES
  -- Elektronik
  ('ffff0001-0000-0000-0000-000000000001','ELK-001','Laptop Asus VivoBook 15','cccc0001-0000-0000-0000-000000000001','dddd0001-0000-0000-0000-000000000010',3,8500000,'Laptop Intel Core i5, RAM 8GB, SSD 512GB',true),
  ('ffff0001-0000-0000-0000-000000000002','ELK-002','Monitor LG 24 inch FHD','cccc0001-0000-0000-0000-000000000001','dddd0001-0000-0000-0000-000000000010',5,2750000,'Monitor IPS 24 inch Full HD 1920x1080',true),
  ('ffff0001-0000-0000-0000-000000000003','ELK-003','Keyboard Logitech MK275','cccc0001-0000-0000-0000-000000000001','dddd0001-0000-0000-0000-000000000001',10,350000,'Keyboard wireless combo dengan mouse',true),
  ('ffff0001-0000-0000-0000-000000000004','ELK-004','Mouse Wireless Logitech M280','cccc0001-0000-0000-0000-000000000001','dddd0001-0000-0000-0000-000000000001',10,185000,'Mouse wireless 2.4GHz, baterai AA',true),
  ('ffff0001-0000-0000-0000-000000000005','ELK-005','UPS APC 650VA','cccc0001-0000-0000-0000-000000000001','dddd0001-0000-0000-0000-000000000010',5,875000,'UPS dengan kapasitas 650VA / 400W',true),
  -- ATK
  ('ffff0001-0000-0000-0000-000000000006','ATK-001','Kertas HVS A4 80gr','cccc0001-0000-0000-0000-000000000002','dddd0001-0000-0000-0000-000000000003',20,52000,'Kertas HVS putih A4 80gram 500 lembar',true),
  ('ffff0001-0000-0000-0000-000000000007','ATK-002','Pulpen Pilot G2 0.5','cccc0001-0000-0000-0000-000000000002','dddd0001-0000-0000-0000-000000000002',30,72000,'Pulpen gel hitam isi 12 pcs per box',true),
  ('ffff0001-0000-0000-0000-000000000008','ATK-003','Stabilo Boss Highlighter','cccc0001-0000-0000-0000-000000000002','dddd0001-0000-0000-0000-000000000001',20,12500,'Stabilo boss warna kuning/hijau/merah/biru',true),
  ('ffff0001-0000-0000-0000-000000000009','ATK-004','Tipp-Ex Shake & Squeeze','cccc0001-0000-0000-0000-000000000002','dddd0001-0000-0000-0000-000000000001',25,11000,'Koreksi cair tipe-x 8ml',true),
  ('ffff0001-0000-0000-0000-000000000010','ATK-005','Map Plastik Klip','cccc0001-0000-0000-0000-000000000002','dddd0001-0000-0000-0000-000000000001',50,4500,'Map plastik transparan dengan klip',true),
  ('ffff0001-0000-0000-0000-000000000011','ATK-006','Stapler Joyko ST-101','cccc0001-0000-0000-0000-000000000002','dddd0001-0000-0000-0000-000000000001',10,35000,'Stapler ukuran standard nomor 10',true),
  ('ffff0001-0000-0000-0000-000000000012','ATK-007','Amplop Coklat A4','cccc0001-0000-0000-0000-000000000002','dddd0001-0000-0000-0000-000000000002',15,28000,'Amplop coklat ukuran A4 isi 50 pcs',true),
  -- Peralatan Kantor
  ('ffff0001-0000-0000-0000-000000000013','PKT-001','Printer Epson L3150','cccc0001-0000-0000-0000-000000000003','dddd0001-0000-0000-0000-000000000010',2,2950000,'Printer multifungsi WiFi dengan infus tinta',true),
  ('ffff0001-0000-0000-0000-000000000014','PKT-002','Scanner Epson DS-530','cccc0001-0000-0000-0000-000000000003','dddd0001-0000-0000-0000-000000000010',1,4500000,'Scanner dokumen ADF dupleks 50ppm',true),
  ('ffff0001-0000-0000-0000-000000000015','PKT-003','Shredder Fellowes','cccc0001-0000-0000-0000-000000000003','dddd0001-0000-0000-0000-000000000010',2,1850000,'Mesin penghancur kertas 8 lembar',true),
  -- Kebersihan
  ('ffff0001-0000-0000-0000-000000000016','KLN-001','Wipol Pembersih Lantai 800ml','cccc0001-0000-0000-0000-000000000004','dddd0001-0000-0000-0000-000000000005',20,28000,'Cairan pembersih lantai pine oil 800ml',true),
  ('ffff0001-0000-0000-0000-000000000017','KLN-002','Sabun Cuci Tangan Dettol 500ml','cccc0001-0000-0000-0000-000000000004','dddd0001-0000-0000-0000-000000000005',30,38000,'Sabun antibakteri 500ml pump',true),
  ('ffff0001-0000-0000-0000-000000000018','KLN-003','Tisu Paseo 250 lembar','cccc0001-0000-0000-0000-000000000004','dddd0001-0000-0000-0000-000000000002',25,32000,'Tisu facial 2ply isi 250 lembar',true),
  ('ffff0001-0000-0000-0000-000000000019','KLN-004','Trash Bag Hitam 60x90cm','cccc0001-0000-0000-0000-000000000004','dddd0001-0000-0000-0000-000000000002',15,25000,'Kantong plastik sampah hitam 60x90cm isi 20pcs',true),
  -- Komputer
  ('ffff0001-0000-0000-0000-000000000020','KMP-001','RAM DDR4 8GB Corsair','cccc0001-0000-0000-0000-000000000005','dddd0001-0000-0000-0000-000000000001',5,450000,'RAM Corsair Vengeance 8GB DDR4 3200MHz',true),
  ('ffff0001-0000-0000-0000-000000000021','KMP-002','SSD 256GB Samsung 870 EVO','cccc0001-0000-0000-0000-000000000005','dddd0001-0000-0000-0000-000000000001',3,650000,'SSD SATA 256GB Samsung 870 EVO',true),
  ('ffff0001-0000-0000-0000-000000000022','KMP-003','Flash Disk SanDisk 64GB','cccc0001-0000-0000-0000-000000000005','dddd0001-0000-0000-0000-000000000001',15,125000,'Flash drive USB 3.0 SanDisk Ultra 64GB',true),
  ('ffff0001-0000-0000-0000-000000000023','KMP-004','Kabel HDMI 2m Belden','cccc0001-0000-0000-0000-000000000005','dddd0001-0000-0000-0000-000000000001',10,85000,'Kabel HDMI 4K panjang 2 meter',true),
  -- Jaringan
  ('ffff0001-0000-0000-0000-000000000024','NET-001','Router TP-Link Archer C6','cccc0001-0000-0000-0000-000000000006','dddd0001-0000-0000-0000-000000000010',3,550000,'Router WiFi AC1200 Dual Band gigabit',true),
  ('ffff0001-0000-0000-0000-000000000025','NET-002','Switch Managed 8 Port TP-Link','cccc0001-0000-0000-0000-000000000006','dddd0001-0000-0000-0000-000000000010',2,750000,'Switch jaringan gigabit 8 port managed',true),
  ('ffff0001-0000-0000-0000-000000000026','NET-003','Kabel UTP Cat6 305m','cccc0001-0000-0000-0000-000000000006','dddd0001-0000-0000-0000-000000000010',1,650000,'Kabel UTP Cat6 box 305 meter AMP',true),
  -- P3K
  ('ffff0001-0000-0000-0000-000000000027','P3K-001','Kotak P3K Besar','cccc0001-0000-0000-0000-000000000008','dddd0001-0000-0000-0000-000000000001',5,185000,'Kotak P3K isi lengkap 58 item',true),
  ('ffff0001-0000-0000-0000-000000000028','P3K-002','Masker Earloop 3ply 50pcs','cccc0001-0000-0000-0000-000000000008','dddd0001-0000-0000-0000-000000000002',20,45000,'Masker medis earloop 3 lapisan isi 50 pcs',true),
  ('ffff0001-0000-0000-0000-000000000029','P3K-003','Hand Sanitizer 500ml','cccc0001-0000-0000-0000-000000000008','dddd0001-0000-0000-0000-000000000005',20,55000,'Hand sanitizer gel alkohol 70% 500ml',true),
  ('ffff0001-0000-0000-0000-000000000030','P3K-004','Termometer Digital','cccc0001-0000-0000-0000-000000000008','dddd0001-0000-0000-0000-000000000001',5,95000,'Termometer infrared digital non-kontak',true)
ON CONFLICT (sku) DO NOTHING;

-- ── Item Stocks ───────────────────────────────────────────────
INSERT INTO item_stocks (id, item_id, warehouse_id, current_stock) VALUES
  -- Gudang Utama Jakarta (GDG-001)
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000001','aaaa0001-0000-0000-0000-000000000001',12),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000002','aaaa0001-0000-0000-0000-000000000001',25),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000003','aaaa0001-0000-0000-0000-000000000001',45),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000004','aaaa0001-0000-0000-0000-000000000001',38),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000005','aaaa0001-0000-0000-0000-000000000001',8),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000006','aaaa0001-0000-0000-0000-000000000001',85),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000007','aaaa0001-0000-0000-0000-000000000001',60),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000008','aaaa0001-0000-0000-0000-000000000001',120),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000009','aaaa0001-0000-0000-0000-000000000001',95),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000010','aaaa0001-0000-0000-0000-000000000001',200),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000011','aaaa0001-0000-0000-0000-000000000001',35),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000012','aaaa0001-0000-0000-0000-000000000001',45),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000013','aaaa0001-0000-0000-0000-000000000001',4),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000014','aaaa0001-0000-0000-0000-000000000001',2),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000015','aaaa0001-0000-0000-0000-000000000001',3),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000016','aaaa0001-0000-0000-0000-000000000001',45),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000017','aaaa0001-0000-0000-0000-000000000001',60),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000018','aaaa0001-0000-0000-0000-000000000001',50),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000019','aaaa0001-0000-0000-0000-000000000001',40),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000020','aaaa0001-0000-0000-0000-000000000001',2),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000021','aaaa0001-0000-0000-0000-000000000001',1),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000022','aaaa0001-0000-0000-0000-000000000001',28),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000023','aaaa0001-0000-0000-0000-000000000001',18),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000024','aaaa0001-0000-0000-0000-000000000001',5),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000025','aaaa0001-0000-0000-0000-000000000001',4),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000026','aaaa0001-0000-0000-0000-000000000001',2),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000027','aaaa0001-0000-0000-0000-000000000001',8),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000028','aaaa0001-0000-0000-0000-000000000001',55),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000029','aaaa0001-0000-0000-0000-000000000001',35),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000030','aaaa0001-0000-0000-0000-000000000001',10),
  -- Gudang Surabaya (GDG-002) - subset
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000006','aaaa0001-0000-0000-0000-000000000002',40),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000007','aaaa0001-0000-0000-0000-000000000002',25),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000016','aaaa0001-0000-0000-0000-000000000002',20),
  (gen_random_uuid(),'ffff0001-0000-0000-0000-000000000017','aaaa0001-0000-0000-0000-000000000002',30)
ON CONFLICT (item_id, warehouse_id) DO UPDATE SET current_stock = EXCLUDED.current_stock;

-- ── Inbound Transactions ──────────────────────────────────────
INSERT INTO inbound_transactions (id, ref_number, supplier_id, warehouse_id, received_by, received_date, notes, status) VALUES
  ('gggg0001-0000-0000-0000-000000000001','GRN-202601-A1B2C3','eeee0001-0000-0000-0000-000000000002','aaaa0001-0000-0000-0000-000000000001','8d2bd5e3-e893-4be9-946d-33d79f41f232','2026-01-15','Pembelian ATK bulan Januari 2026','confirmed'),
  ('gggg0001-0000-0000-0000-000000000002','GRN-202602-D4E5F6','eeee0001-0000-0000-0000-000000000001','aaaa0001-0000-0000-0000-000000000001','8d2bd5e3-e893-4be9-946d-33d79f41f232','2026-02-03','Pengadaan laptop Q1 2026','confirmed'),
  ('gggg0001-0000-0000-0000-000000000003','GRN-202602-G7H8I9','eeee0001-0000-0000-0000-000000000004','aaaa0001-0000-0000-0000-000000000001','8d2bd5e3-e893-4be9-946d-33d79f41f232','2026-02-20','Restok perlengkapan kebersihan','confirmed'),
  ('gggg0001-0000-0000-0000-000000000004','GRN-202603-J1K2L3','eeee0001-0000-0000-0000-000000000006','aaaa0001-0000-0000-0000-000000000001','8d2bd5e3-e893-4be9-946d-33d79f41f232','2026-03-10','Pengadaan peralatan jaringan','confirmed'),
  ('gggg0001-0000-0000-0000-000000000005','GRN-202604-M4N5O6','eeee0001-0000-0000-0000-000000000002','aaaa0001-0000-0000-0000-000000000002','7c68d928-3dbf-4fe0-b9ff-bd54436dec25','2026-04-02','ATK Gudang Surabaya April','confirmed'),
  ('gggg0001-0000-0000-0000-000000000006','GRN-202604-P7Q8R9','eeee0001-0000-0000-0000-000000000007','aaaa0001-0000-0000-0000-000000000001','8d2bd5e3-e893-4be9-946d-33d79f41f232','2026-04-08','Pengadaan P3K Q2 2026','confirmed'),
  ('gggg0001-0000-0000-0000-000000000007','GRN-202604-S1T2U3','eeee0001-0000-0000-0000-000000000003','aaaa0001-0000-0000-0000-000000000001','8d2bd5e3-e893-4be9-946d-33d79f41f232','2026-04-11','Server dan peralatan TI','confirmed'),
  ('gggg0001-0000-0000-0000-000000000008','GRN-202604-V4W5X6','eeee0001-0000-0000-0000-000000000001','aaaa0001-0000-0000-0000-000000000001','7c68d928-3dbf-4fe0-b9ff-bd54436dec25','2026-04-14','Monitor tambahan divisi HRD','confirmed')
ON CONFLICT (ref_number) DO NOTHING;

-- ── Inbound Items ─────────────────────────────────────────────
INSERT INTO inbound_items (id, transaction_id, item_id, qty_received, unit_price) VALUES
  -- GRN Jan: ATK
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000001','ffff0001-0000-0000-0000-000000000006',30,52000),
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000001','ffff0001-0000-0000-0000-000000000007',20,72000),
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000001','ffff0001-0000-0000-0000-000000000010',50,4500),
  -- GRN Feb: Laptop
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000002','ffff0001-0000-0000-0000-000000000001',10,8200000),
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000002','ffff0001-0000-0000-0000-000000000002',15,2650000),
  -- GRN Feb: Kebersihan
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000003','ffff0001-0000-0000-0000-000000000016',30,26000),
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000003','ffff0001-0000-0000-0000-000000000017',30,36000),
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000003','ffff0001-0000-0000-0000-000000000018',25,30000),
  -- GRN Mar: Jaringan
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000004','ffff0001-0000-0000-0000-000000000024',5,520000),
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000004','ffff0001-0000-0000-0000-000000000026',2,620000),
  -- GRN Apr: P3K
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000006','ffff0001-0000-0000-0000-000000000027',5,175000),
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000006','ffff0001-0000-0000-0000-000000000028',20,42000),
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000006','ffff0001-0000-0000-0000-000000000029',20,50000),
  -- GRN Apr: Monitor HRD
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000008','ffff0001-0000-0000-0000-000000000002',5,2700000),
  (gen_random_uuid(),'gggg0001-0000-0000-0000-000000000008','ffff0001-0000-0000-0000-000000000003',10,335000);

-- ── Outbound Transactions ─────────────────────────────────────
INSERT INTO outbound_transactions (id, ref_number, warehouse_id, processed_by, outbound_date, notes, status) VALUES
  ('hhhh0001-0000-0000-0000-000000000001','OUT-202601-A1B2','aaaa0001-0000-0000-0000-000000000001','7c68d928-3dbf-4fe0-b9ff-bd54436dec25','2026-01-20','Distribusi ATK ke divisi IT','confirmed'),
  ('hhhh0001-0000-0000-0000-000000000002','OUT-202602-C3D4','aaaa0001-0000-0000-0000-000000000001','7c68d928-3dbf-4fe0-b9ff-bd54436dec25','2026-02-10','Laptop untuk karyawan baru','confirmed'),
  ('hhhh0001-0000-0000-0000-000000000003','OUT-202603-E5F6','aaaa0001-0000-0000-0000-000000000001','7c68d928-3dbf-4fe0-b9ff-bd54436dec25','2026-03-05','Distribusi kebersihan ke semua lantai','confirmed'),
  ('hhhh0001-0000-0000-0000-000000000004','OUT-202604-G7H8','aaaa0001-0000-0000-0000-000000000001','7c68d928-3dbf-4fe0-b9ff-bd54436dec25','2026-04-01','Peralatan rapat Q2 2026','confirmed'),
  ('hhhh0001-0000-0000-0000-000000000005','OUT-202604-I9J0','aaaa0001-0000-0000-0000-000000000001','7c68d928-3dbf-4fe0-b9ff-bd54436dec25','2026-04-12','Distribusi P3K ke semua gudang','confirmed')
ON CONFLICT (ref_number) DO NOTHING;

INSERT INTO outbound_items (id, transaction_id, item_id, qty) VALUES
  (gen_random_uuid(),'hhhh0001-0000-0000-0000-000000000001','ffff0001-0000-0000-0000-000000000006',5),
  (gen_random_uuid(),'hhhh0001-0000-0000-0000-000000000001','ffff0001-0000-0000-0000-000000000007',3),
  (gen_random_uuid(),'hhhh0001-0000-0000-0000-000000000002','ffff0001-0000-0000-0000-000000000001',3),
  (gen_random_uuid(),'hhhh0001-0000-0000-0000-000000000002','ffff0001-0000-0000-0000-000000000003',3),
  (gen_random_uuid(),'hhhh0001-0000-0000-0000-000000000003','ffff0001-0000-0000-0000-000000000016',5),
  (gen_random_uuid(),'hhhh0001-0000-0000-0000-000000000003','ffff0001-0000-0000-0000-000000000017',5),
  (gen_random_uuid(),'hhhh0001-0000-0000-0000-000000000004','ffff0001-0000-0000-0000-000000000003',2),
  (gen_random_uuid(),'hhhh0001-0000-0000-0000-000000000004','ffff0001-0000-0000-0000-000000000004',2),
  (gen_random_uuid(),'hhhh0001-0000-0000-0000-000000000005','ffff0001-0000-0000-0000-000000000028',10),
  (gen_random_uuid(),'hhhh0001-0000-0000-0000-000000000005','ffff0001-0000-0000-0000-000000000029',5);

-- ── Requests (SPB) ────────────────────────────────────────────
INSERT INTO requests (id, spb_number, requester_id, warehouse_id, needed_date, purpose, priority, status, reviewed_by, reviewed_at) VALUES
  ('iiii0001-0000-0000-0000-000000000001','SPB-202604-001','381a47bc-d222-46ce-a68c-e3d6994d3537','aaaa0001-0000-0000-0000-000000000001','2026-04-20','Kebutuhan ATK divisi Finance Q2 2026','normal','approved','0aa03eab-ebe4-40b7-83ee-4b8ff06309b0','2026-04-10 09:00:00'),
  ('iiii0001-0000-0000-0000-000000000002','SPB-202604-002','381a47bc-d222-46ce-a68c-e3d6994d3537','aaaa0001-0000-0000-0000-000000000001','2026-04-25','Pengadaan tinta printer kantor pusat','urgent','pending',null,null),
  ('iiii0001-0000-0000-0000-000000000003','381a47bc-d222-46ce-a68c-e3d6994d3537','381a47bc-d222-46ce-a68c-e3d6994d3537','aaaa0001-0000-0000-0000-000000000002','2026-04-30','Laptop untuk karyawan baru divisi Marketing Surabaya','high','pending',null,null),
  ('iiii0001-0000-0000-0000-000000000004','SPB-202603-009','381a47bc-d222-46ce-a68c-e3d6994d3537','aaaa0001-0000-0000-0000-000000000001','2026-03-25','Peralatan kebersihan tambahan','normal','approved','0aa03eab-ebe4-40b7-83ee-4b8ff06309b0','2026-03-20 14:00:00'),
  ('iiii0001-0000-0000-0000-000000000005','SPB-202604-003','381a47bc-d222-46ce-a68c-e3d6994d3537','aaaa0001-0000-0000-0000-000000000001','2026-04-30','Router WiFi tambahan untuk lantai 3','normal','rejected','0aa03eab-ebe4-40b7-83ee-4b8ff06309b0','2026-04-12 10:00:00')
ON CONFLICT (spb_number) DO NOTHING;

-- ── Purchase Orders ───────────────────────────────────────────
INSERT INTO purchase_orders (id, po_number, supplier_id, warehouse_id, created_by, tax_rate, subtotal, tax_amount, total_amount, notes, status) VALUES
  ('jjjj0001-0000-0000-0000-000000000001','PO-202601-001','eeee0001-0000-0000-0000-000000000001','aaaa0001-0000-0000-0000-000000000001','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286',11,85000000,9350000,94350000,'Pengadaan laptop dan monitor Q1 2026','confirmed'),
  ('jjjj0001-0000-0000-0000-000000000002','PO-202602-001','eeee0001-0000-0000-0000-000000000002','aaaa0001-0000-0000-0000-000000000001','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286',11,12500000,1375000,13875000,'ATK & Perlengkapan Kantor Q1','confirmed'),
  ('jjjj0001-0000-0000-0000-000000000003','PO-202603-001','eeee0001-0000-0000-0000-000000000006','aaaa0001-0000-0000-0000-000000000001','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286',11,18500000,2035000,20535000,'Peralatan jaringan upgrade infrastruktur','approved'),
  ('jjjj0001-0000-0000-0000-000000000004','PO-202604-001','eeee0001-0000-0000-0000-000000000007','aaaa0001-0000-0000-0000-000000000001','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286',11,5500000,605000,6105000,'Perlengkapan P3K Q2 2026','draft'),
  ('jjjj0001-0000-0000-0000-000000000005','PO-202604-002','eeee0001-0000-0000-0000-000000000004','aaaa0001-0000-0000-0000-000000000001','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286',11,8750000,962500,9712500,'Perlengkapan kebersihan semi-tahunan','approved')
ON CONFLICT (po_number) DO NOTHING;

-- ── Invoices ──────────────────────────────────────────────────
INSERT INTO invoices (id, invoice_number, po_id, supplier_id, invoice_date, due_date, total_amount, paid_amount, status, created_by) VALUES
  ('kkkk0001-0000-0000-0000-000000000001','INV-2026-00001','jjjj0001-0000-0000-0000-000000000001','eeee0001-0000-0000-0000-000000000001','2026-01-20','2026-02-19',94350000,94350000,'paid','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286'),
  ('kkkk0001-0000-0000-0000-000000000002','INV-2026-00002','jjjj0001-0000-0000-0000-000000000002','eeee0001-0000-0000-0000-000000000002','2026-02-05','2026-02-19',13875000,13875000,'paid','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286'),
  ('kkkk0001-0000-0000-0000-000000000003','INV-2026-00003','jjjj0001-0000-0000-0000-000000000003','eeee0001-0000-0000-0000-000000000006','2026-03-15','2026-04-29',20535000,0,'unpaid','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286'),
  ('kkkk0001-0000-0000-0000-000000000004','INV-2026-00004','jjjj0001-0000-0000-0000-000000000005','eeee0001-0000-0000-0000-000000000004','2026-04-05','2026-04-12',9712500,0,'overdue','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286')
ON CONFLICT (invoice_number) DO NOTHING;

-- ── Budgets ───────────────────────────────────────────────────
INSERT INTO budgets (id, name, total_amount, spent_amount, period_start, period_end, period_type, created_by) VALUES
  ('llll0001-0000-0000-0000-000000000001','Anggaran IT & Elektronik Q1 2026',150000000,108225000,'2026-01-01','2026-03-31','quarterly','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286'),
  ('llll0001-0000-0000-0000-000000000002','Anggaran ATK 2026',50000000,13875000,'2026-01-01','2026-12-31','yearly','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286'),
  ('llll0001-0000-0000-0000-000000000003','Anggaran Kebersihan Q2 2026',20000000,9712500,'2026-04-01','2026-06-30','quarterly','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286'),
  ('llll0001-0000-0000-0000-000000000004','Anggaran P3K & Kesehatan 2026',25000000,6105000,'2026-01-01','2026-12-31','yearly','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286'),
  ('llll0001-0000-0000-0000-000000000005','Anggaran Infrastruktur Jaringan Q2 2026',75000000,20535000,'2026-04-01','2026-06-30','quarterly','dbfe3ff0-a301-41ee-9d0c-f5c4dabe6286')
ON CONFLICT DO NOTHING;

-- ── Update SPB number yang tidak valid ────────────────────────
UPDATE requests SET spb_number = 'SPB-202604-HR01' WHERE id = 'iiii0001-0000-0000-0000-000000000003';

-- ── Summary Stats ─────────────────────────────────────────────
SELECT 'Warehouses'   AS tabel, COUNT(*) AS jumlah FROM warehouses
UNION ALL SELECT 'Suppliers', COUNT(*) FROM suppliers
UNION ALL SELECT 'Categories', COUNT(*) FROM categories
UNION ALL SELECT 'Units', COUNT(*) FROM units
UNION ALL SELECT 'Items', COUNT(*) FROM items
UNION ALL SELECT 'Item Stocks', COUNT(*) FROM item_stocks
UNION ALL SELECT 'Inbound Txn', COUNT(*) FROM inbound_transactions
UNION ALL SELECT 'Outbound Txn', COUNT(*) FROM outbound_transactions
UNION ALL SELECT 'Requests/SPB', COUNT(*) FROM requests
UNION ALL SELECT 'Purchase Orders', COUNT(*) FROM purchase_orders
UNION ALL SELECT 'Invoices', COUNT(*) FROM invoices
UNION ALL SELECT 'Budgets', COUNT(*) FROM budgets;

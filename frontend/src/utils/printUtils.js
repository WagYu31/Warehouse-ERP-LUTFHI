/**
 * Print Utilities — WMS LUTFHI
 * Fungsi-fungsi untuk generate HTML print dan membuka print dialog
 */

const COMPANY = {
  name: 'PT. LUTFHI ENTERPRISES',
  address: 'Jl. Gudang Utama No. 1, Jakarta Selatan',
  phone: '(021) 1234-5678',
  email: 'info@lutfhi.co.id',
}

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
  .header h1 { font-size: 16px; font-weight: bold; }
  .header p { font-size: 10px; color: #555; }
  .doc-title { font-size: 14px; font-weight: bold; text-align: center; margin: 10px 0;
               border: 2px solid #000; padding: 6px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
  .info-box { border: 1px solid #ccc; padding: 8px; border-radius: 4px; }
  .info-box h4 { font-size: 9px; color: #777; text-transform: uppercase; margin-bottom: 2px; }
  .info-box p { font-size: 11px; font-weight: bold; }
  .info-box small { font-size: 10px; font-weight: normal; color: #444; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #1E3A5F; color: white; padding: 7px 8px; font-size: 10px; text-align: left; }
  td { border: 1px solid #ccc; padding: 6px 8px; font-size: 11px; vertical-align: top; }
  tr:nth-child(even) td { background: #f9f9f9; }
  .total-row td { font-weight: bold; background: #e8f4f8; border-top: 2px solid #000; }
  .sign-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; }
  .sign-box { text-align: center; }
  .sign-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 4px; font-size: 10px; }
  .footer { font-size: 9px; color: #777; text-align: center; margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: bold; }
  .badge-info { background: #bee3f8; color: #2b6cb0; }
  .badge-warning { background: #ffeaa7; color: #8B6914; }
  .badge-success { background: #c6f6d5; color: #276749; }
  @media print {
    body { padding: 5px; }
    @page { margin: 15mm; size: A4; }
  }
`

function printHTML(title, body) {
  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>${title}</title>
    <style>${CSS}</style>
  </head><body>${body}</body></html>`)
  win.document.close()
  setTimeout(() => win.print(), 500)
}

function companyHeader() {
  return `
    <div class="header">
      <h1>${COMPANY.name}</h1>
      <p>${COMPANY.address}</p>
      <p>Tel: ${COMPANY.phone} | Email: ${COMPANY.email}</p>
    </div>`
}

function signatureRow(labels3) {
  return `
    <div class="sign-row">
      ${labels3.map(l => `<div class="sign-box"><div class="sign-line">${l}</div></div>`).join('')}
    </div>`
}

function footer() {
  return `<div class="footer">Dicetak oleh sistem WMS LUTFHI pada ${new Date().toLocaleString('id-ID')} | Dokumen ini sah tanpa tanda tangan basah jika dicetak dari sistem</div>`
}

/** ── PRINT PURCHASE ORDER (PO) ── */
export function printPurchaseOrder(po) {
  if (!po) return

  const items = (po.items || []).map((i, idx) => `
    <tr>
      <td style="text-align:center">${idx + 1}</td>
      <td>${i.name || ''}</td>
      <td style="font-family:monospace;font-size:10px">${i.sku || ''}</td>
      <td style="text-align:center">${i.qty || 0}</td>
      <td style="text-align:center">${i.unit || ''}</td>
      <td style="text-align:right">Rp ${Number(i.unit_price || 0).toLocaleString('id-ID')}</td>
      <td style="text-align:right">Rp ${Number((i.unit_price || 0) * (i.qty || 0)).toLocaleString('id-ID')}</td>
    </tr>`).join('')

  const total = (po.items || []).reduce((s, i) => s + (i.unit_price || 0) * (i.qty || 0), 0)

  printHTML(`PO ${po.po_number}`, `
    ${companyHeader()}
    <div class="doc-title">PURCHASE ORDER</div>
    <div class="info-grid">
      <div class="info-box">
        <h4>No. PO</h4><p>${po.po_number}</p>
        <h4 style="margin-top:6px">Tanggal</h4><p>${po.order_date || '—'}</p>
        <h4 style="margin-top:6px">Status</h4>
        <p><span class="badge badge-info">${po.status?.toUpperCase() || ''}</span></p>
      </div>
      <div class="info-box">
        <h4>Supplier</h4><p>${po.supplier_name || po.supplier || '—'}</p>
        <h4 style="margin-top:6px">Alamat Supplier</h4>
        <p><small>${po.supplier_address || '—'}</small></p>
        <h4 style="margin-top:6px">Dibuat Oleh</h4><p>${po.created_by || '—'}</p>
      </div>
    </div>
    <table>
      <thead><tr>
        <th style="width:30px">#</th>
        <th>Nama Item</th><th>SKU</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:center">Satuan</th>
        <th style="text-align:right">Harga Satuan</th>
        <th style="text-align:right">Subtotal</th>
      </tr></thead>
      <tbody>${items || '<tr><td colspan="7" style="text-align:center">Tidak ada item</td></tr>'}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="6" style="text-align:right">TOTAL</td>
          <td style="text-align:right">Rp ${Number(total).toLocaleString('id-ID')}</td>
        </tr>
      </tfoot>
    </table>
    ${po.notes ? `<p style="font-size:10px;color:#555;margin:8px 0"><b>Catatan:</b> ${po.notes}</p>` : ''}
    ${signatureRow(['Disetujui Oleh', 'Dibuat Oleh', 'Diterima Supplier'])}
    ${footer()}
  `)
}

/** ── PRINT INVOICE / KWITANSI ── */
export function printInvoice(inv) {
  if (!inv) return

  printHTML(`Invoice ${inv.invoice_number}`, `
    ${companyHeader()}
    <div class="doc-title">INVOICE / FAKTUR TAGIHAN</div>
    <div class="info-grid">
      <div class="info-box">
        <h4>No. Invoice</h4><p style="color:#1E3A5F">${inv.invoice_number}</p>
        <h4 style="margin-top:6px">Tanggal Invoice</h4><p>${inv.invoice_date || '—'}</p>
        <h4 style="margin-top:6px">Jatuh Tempo</h4>
        <p style="color:#c53030">${inv.due_date || '—'}</p>
      </div>
      <div class="info-box">
        <h4>Supplier / Vendor</h4><p>${inv.supplier_name || '—'}</p>
        <h4 style="margin-top:6px">Status</h4>
        <p><span class="badge ${inv.status === 'paid' ? 'badge-success' : 'badge-warning'}">${inv.status?.toUpperCase()}</span></p>
        <h4 style="margin-top:6px">Referensi PO</h4><p>${inv.po_number || '—'}</p>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>Keterangan</th>
        <th style="text-align:right">Jumlah</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>Tagihan sesuai PO ${inv.po_number || '—'} dari ${inv.supplier_name || '—'}</td>
          <td style="text-align:right;font-weight:bold">Rp ${Number(inv.total || inv.total_amount || 0).toLocaleString('id-ID')}</td>
        </tr>
        ${inv.paid_amount > 0 ? `
        <tr>
          <td>Sudah Dibayar</td>
          <td style="text-align:right;color:#276749">(Rp ${Number(inv.paid_amount).toLocaleString('id-ID')})</td>
        </tr>` : ''}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td style="text-align:right">SISA TAGIHAN</td>
          <td style="text-align:right;color:#c53030">
            Rp ${Number((inv.total || inv.total_amount || 0) - (inv.paid_amount || 0)).toLocaleString('id-ID')}
          </td>
        </tr>
      </tfoot>
    </table>
    <div style="background:#f0f4f8;padding:10px;border-radius:4px;margin:10px 0;font-size:10px">
      <b>Instruksi Pembayaran:</b><br>
      Transfer ke rekening perusahaan dengan mencantumkan No. Invoice sebagai referensi.
      Pembayaran dianggap sah setelah dikonfirmasi oleh tim keuangan.
    </div>
    ${signatureRow(['Disetujui Finance', 'Dibuat Oleh', 'Penerima'])}
    ${footer()}
  `)
}

/** ── PRINT GRN (Goods Receipt Note / Barang Masuk) ── */
export function printGRN(inbound) {
  if (!inbound) return

  const items = (inbound.items || []).map((i, idx) => `
    <tr>
      <td style="text-align:center">${idx + 1}</td>
      <td>${i.name || ''}</td>
      <td style="font-family:monospace;font-size:10px">${i.sku || ''}</td>
      <td style="text-align:center">${i.qty || 0}</td>
      <td style="text-align:center">${i.qty_received || i.qty || 0}</td>
      <td></td>
    </tr>`).join('')

  printHTML(`GRN ${inbound.ref_number}`, `
    ${companyHeader()}
    <div class="doc-title">GOODS RECEIPT NOTE (GRN)</div>
    <div class="info-grid">
      <div class="info-box">
        <h4>No. GRN</h4><p>${inbound.ref_number || '—'}</p>
        <h4 style="margin-top:6px">Tanggal Terima</h4><p>${inbound.transaction_date || '—'}</p>
        <h4 style="margin-top:6px">Status</h4>
        <p><span class="badge badge-success">${inbound.status?.toUpperCase() || 'DRAFT'}</span></p>
      </div>
      <div class="info-box">
        <h4>Gudang Tujuan</h4><p>${inbound.warehouse || '—'}</p>
        <h4 style="margin-top:6px">Supplier</h4><p>${inbound.supplier || '—'}</p>
        <h4 style="margin-top:6px">Diterima Oleh</h4><p>${inbound.created_by || '—'}</p>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>Nama Item</th><th>SKU</th>
        <th style="text-align:center">Qty PO</th>
        <th style="text-align:center">Qty Diterima</th>
        <th>Catatan</th>
      </tr></thead>
      <tbody>${items || '<tr><td colspan="6" style="text-align:center">Tidak ada item</td></tr>'}</tbody>
    </table>
    ${inbound.notes ? `<p style="font-size:10px;color:#555"><b>Catatan:</b> ${inbound.notes}</p>` : ''}
    ${signatureRow(['Pengirim / Supplier', 'Penerima Gudang', 'Supervisor'])}
    ${footer()}
  `)
}

/** ── PRINT SPB (Surat Permintaan Barang) ── */
export function printSPB(request) {
  if (!request) return

  const items = (request.items || []).map((i, idx) => `
    <tr>
      <td style="text-align:center">${idx + 1}</td>
      <td>${i.name || ''}</td>
      <td style="font-family:monospace;font-size:10px">${i.sku || ''}</td>
      <td style="text-align:center">${i.qty_requested || 0}</td>
      <td style="text-align:center">${i.qty_approved || '—'}</td>
      <td>${i.notes || ''}</td>
    </tr>`).join('')

  const statusColor = request.status === 'approved' ? '#276749' : request.status === 'rejected' ? '#c53030' : '#8B6914'

  printHTML(`SPB ${request.request_number}`, `
    ${companyHeader()}
    <div class="doc-title">SURAT PERMINTAAN BARANG (SPB)</div>
    <div class="info-grid">
      <div class="info-box">
        <h4>No. SPB</h4><p>${request.request_number || '—'}</p>
        <h4 style="margin-top:6px">Tanggal Permintaan</h4><p>${request.request_date || '—'}</p>
        <h4 style="margin-top:6px">Status</h4>
        <p style="color:${statusColor};font-weight:bold">${request.status?.toUpperCase() || '—'}</p>
      </div>
      <div class="info-box">
        <h4>Diminta Oleh</h4><p>${request.requester || request.created_by || '—'}</p>
        <h4 style="margin-top:6px">Departemen</h4><p>${request.department || '—'}</p>
        <h4 style="margin-top:6px">Keperluan</h4><p><small>${request.purpose || request.notes || '—'}</small></p>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>Nama Item</th><th>SKU</th>
        <th style="text-align:center">Qty Minta</th>
        <th style="text-align:center">Qty Disetujui</th>
        <th>Keterangan</th>
      </tr></thead>
      <tbody>${items || '<tr><td colspan="6" style="text-align:center">Tidak ada item</td></tr>'}</tbody>
    </table>
    ${request.reject_reason ? `<p style="font-size:10px;color:#c53030"><b>Alasan Penolakan:</b> ${request.reject_reason}</p>` : ''}
    ${signatureRow(['Pemohon', 'Kabag / Supervisor', 'Admin Gudang'])}
    ${footer()}
  `)
}

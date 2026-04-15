import { useState, useEffect } from 'react'
import { User, Lock, Save, Phone, Mail, Shield } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { PageShell } from '@/components/ui'

const ROLE_LABEL = {
  admin: '👑 Administrator',
  staff: '📦 Warehouse Staff',
  requester: '📋 Requester',
  finance_procurement: '💼 Finance & Procurement',
  manager: '👁️ Manager',
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const [profile, setProfile]   = useState({ name: '', email: '', phone: '', role: '' })
  const [passwords, setPasswords] = useState({ old_password: '', new_password: '', confirm: '' })
  const [loading, setLoading]   = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [tab, setTab]           = useState('profile')

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/users/me')
        const d = res.data || res
        setProfile({ name: d.name || '', email: d.email || '', phone: d.phone || '', role: d.role || '' })
      } catch { toast.error('Gagal memuat profil') }
    }
    fetch()
  }, [])

  const saveProfile = async () => {
    if (!profile.name.trim()) { toast.error('Nama tidak boleh kosong'); return }
    setLoading(true)
    try {
      await api.put('/users/me', { name: profile.name, phone: profile.phone })
      toast.success('Profil berhasil disimpan')
      if (setUser) setUser({ ...user, name: profile.name })
    } catch { toast.error('Gagal menyimpan profil') }
    finally { setLoading(false) }
  }

  const changePassword = async () => {
    if (!passwords.old_password) { toast.error('Masukkan password lama'); return }
    if (passwords.new_password.length < 6) { toast.error('Password baru minimal 6 karakter'); return }
    if (passwords.new_password !== passwords.confirm) { toast.error('Konfirmasi password tidak cocok'); return }
    setPwLoading(true)
    try {
      await api.put('/users/me/password', { old_password: passwords.old_password, new_password: passwords.new_password })
      toast.success('Password berhasil diubah')
      setPasswords({ old_password: '', new_password: '', confirm: '' })
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal mengubah password')
    }
    finally { setPwLoading(false) }
  }

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center shadow-glow-gold">
            <span className="text-white font-bold text-2xl">{profile.name?.[0]?.toUpperCase() || 'U'}</span>
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">{profile.name}</h1>
            <p className="text-slate-400 text-sm">{ROLE_LABEL[profile.role] || profile.role}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'profile', label: 'Edit Profil', icon: User },
            { key: 'password', label: 'Ganti Password', icon: Lock },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${tab === t.key ? 'bg-gold-500/15 text-gold-400 border border-gold-500/25' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <User size={16} className="text-gold-400" /> Informasi Profil
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
              <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-gold-500/50 transition-all"
                placeholder="Nama lengkap" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Mail size={11} /> Email (tidak bisa diubah)
              </label>
              <input value={profile.email} readOnly
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-slate-500 text-sm cursor-not-allowed" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Phone size={11} /> Nomor Telepon
              </label>
              <input value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-gold-500/50 transition-all"
                placeholder="+62 8xx xxxx xxxx" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Shield size={11} /> Role Akses
              </label>
              <div className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-slate-300 text-sm">{ROLE_LABEL[profile.role] || profile.role}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex justify-end">
              <button onClick={saveProfile} disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-navy-900 font-semibold text-sm transition-all shadow-glow-gold">
                <Save size={15} /> {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        )}

        {tab === 'password' && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Lock size={16} className="text-gold-400" /> Ganti Password
            </h2>
            <p className="text-slate-500 text-sm">Password baru minimal 6 karakter dan harus mengandung kombinasi huruf & angka.</p>

            {[
              { key: 'old_password', label: 'Password Lama', placeholder: 'Masukkan password saat ini' },
              { key: 'new_password', label: 'Password Baru', placeholder: 'Minimal 6 karakter' },
              { key: 'confirm',      label: 'Konfirmasi Password Baru', placeholder: 'Ulangi password baru' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{f.label}</label>
                <input type="password" value={passwords[f.key]}
                  onChange={e => setPasswords({...passwords, [f.key]: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-gold-500/50 transition-all"
                  placeholder={f.placeholder} />
              </div>
            ))}

            <div className="pt-2 border-t border-white/[0.06] flex justify-end">
              <button onClick={changePassword} disabled={pwLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white font-semibold text-sm transition-all">
                <Lock size={15} /> {pwLoading ? 'Memproses...' : 'Ubah Password'}
              </button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}

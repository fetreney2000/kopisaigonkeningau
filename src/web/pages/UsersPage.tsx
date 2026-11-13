import { useState } from 'react';
import { KeyRound, Eye, EyeOff, Plus, QrCode, ShieldCheck, UserRound, UserRoundCheck, UserRoundPen, UserRoundX } from 'lucide-react';
import { api, useApi } from '../api';
import { tarikh } from '../format';
import { Badge, Button, Card, EmptyState, Field, inputCls, Modal, Spinner, toast } from '../ui';
import { QrLoginModal } from './UserQr';
import type { User } from '../../shared/types';

const ROLE_LABEL: Record<User['role'], string> = { admin: 'Admin', staff: 'Staff' };
const ROLE_CLS: Record<User['role'], string> = {
  admin: 'bg-bark-800 text-cream-100',
  staff: 'bg-cream-200 text-bark-700',
};

// ------------------------------------------------------------------ borang tambah

function AddUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (u: User, qr: string) => void }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await api.post<{ user: User; qr_code: string }>('/api/users', { full_name: fullName, username, position, role, password });
      toast('Pengguna dicipta', 'success');
      onCreated(res.user, res.qr_code);
      setFullName(''); setUsername(''); setPosition(''); setRole('staff'); setPassword('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ralat', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tambah Pengguna">
      <div className="space-y-4">
        <Field label="Nama Penuh">
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Nama Pengguna" hint="3-32 aksara: huruf kecil, nombor, titik, garis bawah atau sempang">
          <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
        </Field>
        <Field label="Jawatan">
          <input className={inputCls} value={position} onChange={(e) => setPosition(e.target.value)} />
        </Field>
        <Field label="Peranan">
          <div className="flex gap-2">
            {(['staff', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors ${
                  role === r ? 'border-bark-800 bg-cream-100' : 'border-cream-300 bg-white hover:bg-cream-100/50'
                }`}
              >
                <span className="block text-sm font-bold text-bark-900">{ROLE_LABEL[r]}</span>
                <span className="block text-xs text-bark-700/60">{r === 'admin' ? 'Akses penuh + urus pengguna' : 'Imbas stok keluar sahaja'}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Kata Laluan Awal" hint="Sekurang-kurangnya 8 aksara, boleh ditetapkan semula kemudian">
          <div className="relative">
            <input className={`${inputCls} !pr-11`} type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-bark-700/60 hover:text-bark-900"
              aria-label={showPw ? 'Sembunyikan kata laluan' : 'Tunjuk kata laluan'}
            >
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </Field>
        <div className="flex gap-3">
          <Button variant="secondary" full onClick={onClose}>Batal</Button>
          <Button full onClick={submit} disabled={saving || !fullName || !username || password.length < 8}>
            {saving ? <Spinner small /> : <><Plus size={17} /> Cipta</>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ borang sunting

function EditUserModal({ open, user, onClose, onSaved }: { open: boolean; user: User | null; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [position, setPosition] = useState(user?.position ?? '');
  const [role, setRole] = useState<User['role']>(user?.role ?? 'staff');
  const [saving, setSaving] = useState(false);
  const meId = JSON.parse(localStorage.getItem('me') ?? 'null')?.id as string | null;

  // Muat semula nilai bila pengguna sasaran berubah
  const [loadedId, setLoadedId] = useState(user?.id);
  if (user && user.id !== loadedId) {
    setLoadedId(user.id);
    setFullName(user.full_name); setUsername(user.username); setPosition(user.position); setRole(user.role);
  }

  async function submit() {
    if (!user) return;
    setSaving(true);
    try {
      await api.patch('/api/users/' + user.id, { full_name: fullName, username, position, role });
      toast('Pengguna dikemas kini', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ralat', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Sunting Pengguna">
      <div className="space-y-4">
        <Field label="Nama Penuh">
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Nama Pengguna">
          <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
        </Field>
        <Field label="Jawatan">
          <input className={inputCls} value={position} onChange={(e) => setPosition(e.target.value)} />
        </Field>
        <Field label="Peranan" hint={user && meId === user.id ? 'Tidak boleh menukar peranan akaun sendiri' : undefined}>
          <div className="flex gap-2">
            {(['staff', 'admin'] as const).map((r) => (
              <button
                key={r}
                disabled={!!user && meId === user.id}
                onClick={() => setRole(r)}
                className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50 ${
                  role === r ? 'border-bark-800 bg-cream-100' : 'border-cream-300 bg-white hover:bg-cream-100/50'
                }`}
              >
                <span className="block text-sm font-bold text-bark-900">{ROLE_LABEL[r]}</span>
              </button>
            ))}
          </div>
        </Field>
        <div className="flex gap-3">
          <Button variant="secondary" full onClick={onClose}>Batal</Button>
          <Button full onClick={submit} disabled={saving || !fullName || !username}>
            {saving ? <Spinner small /> : 'Simpan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ halaman

export default function UsersPage() {
  const { data, loading, error, reload } = useApi<{ users: User[] }>('/api/users');
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [qrModal, setQrModal] = useState<{ name: string; username: string; position?: string; code: string } | null>(null);
  const [pwModal, setPwModal] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [disableUser, setDisableUser] = useState<User | null>(null);
  const [rotateUser, setRotateUser] = useState<User | null>(null);

  const users = data?.users ?? [];
  const active = users.filter((u) => !u.archived);

  async function resetPassword(u: User) {
    try {
      const res = await api.post<{ password: string }>(`/api/users/${u.id}/reset-password`, {});
      setNewPassword(res.password);
      toast('Kata laluan ditetapkan semula. Sesi lain dilumpuhkan', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ralat', 'error');
      setPwModal(null);
    }
  }

  async function rotateQr(u: User) {
    try {
      const res = await api.post<{ qr_code: string }>(`/api/users/${u.id}/rotate-qr`, {});
      setQrModal({ name: u.full_name, username: u.username, position: u.position, code: res.qr_code });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ralat', 'error');
    }
  }

  async function disable(u: User) {
    try {
      await api.del(`/api/users/${u.id}`);
      toast(`${u.full_name} dilumpuhkan`, 'success');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ralat', 'error');
    }
  }

  async function restore(u: User) {
    try {
      await api.post(`/api/users/${u.id}/restore`, {});
      toast(`${u.full_name} diaktifkan semula`, 'success');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ralat', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-bark-900">Pengguna</h2>
          <p className="text-sm text-bark-700/70">{active.length} akaun aktif</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={17} /> Tambah Pengguna
        </Button>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <EmptyState icon={<UserRound size={22} />} title="Sesuatu tidak kena" message={error} />
      ) : (
        <Card className="divide-y divide-cream-100">
          {users.map((u) => (
            <div key={u.id} className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${u.archived ? 'opacity-45' : ''}`}>
              <span className={`flex h-10 w-10 items-center justify-center ${u.role === 'admin' ? 'bg-bark-800 text-cream-50' : 'bg-cream-200 text-coffee-500'}`}>
                <UserRound size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[15px] font-bold text-bark-900">{u.full_name}</span>
                  <Badge className={ROLE_CLS[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                  {u.archived && <Badge className="bg-berry-soft text-berry-600">Dilumpuhkan</Badge>}
                </span>
                <span className="block truncate text-xs text-bark-700/60">
                  @{u.username}{u.position ? ` · ${u.position}` : ''} · dicipta {tarikh(u.created_at)}
                </span>
              </span>
              {u.archived ? (
                <span className="flex shrink-0 flex-wrap gap-1.5">
                  <button onClick={() => restore(u)} className="flex h-9 items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-2.5 text-xs font-semibold text-leaf-700 hover:bg-cream-100" title="Aktifkan semula akaun">
                    <UserRoundCheck size={15} /> Aktifkan
                  </button>
                </span>
              ) : (
                <span className="flex shrink-0 flex-wrap gap-1.5">
                  <button onClick={() => setRotateUser(u)} className="flex h-9 items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-2.5 text-xs font-semibold text-bark-700 hover:bg-cream-100" title="Jana kod QR log masuk baharu">
                    <QrCode size={15} /> Tukar Kod QR
                  </button>
                  <button onClick={() => { setPwModal(u); setNewPassword(null); }} className="flex h-9 items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-2.5 text-xs font-semibold text-bark-700 hover:bg-cream-100" title="Tetapkan semula kata laluan">
                    <KeyRound size={15} /> Reset
                  </button>
                  <button onClick={() => setEditUser(u)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-cream-300 bg-white text-bark-700 hover:bg-cream-100" aria-label="Sunting">
                    <UserRoundPen size={15} />
                  </button>
                  <button onClick={() => setDisableUser(u)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-cream-300 bg-white text-berry-600 hover:bg-berry-soft" aria-label="Lumpuhkan">
                    <UserRoundX size={15} />
                  </button>
                </span>
              )}
            </div>
          ))}
        </Card>
      )}

      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(u, qr) => {
          setAddOpen(false);
          setQrModal({ name: u.full_name, username: u.username, position: u.position, code: qr });
          reload();
        }}
      />

      <EditUserModal
        open={!!editUser}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={reload}
      />

      {/* Sahkan tukar kod QR */}
      <Modal open={!!rotateUser} onClose={() => setRotateUser(null)} title="Tukar Kod QR Log Masuk">
        {rotateUser && (
          <div className="space-y-4">
            <p className="text-[15px] text-bark-800">
              Jana kod QR log masuk baharu untuk <b>{rotateUser.full_name}</b>? Kad yang lama <b>terus tidak sah</b> - pastikan
              kad baharu dicetak sebelum menutup modal.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" full onClick={() => setRotateUser(null)}>Batal</Button>
              <Button full onClick={() => { const u = rotateUser; setRotateUser(null); void rotateQr(u); }}>Jana Kod Baharu</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal kod QR (dipaparkan sekali sahaja selepas dicipta/jana) */}
      <QrLoginModal data={qrModal} onClose={() => setQrModal(null)} />

      {/* Sahkan reset kata laluan */}
      <Modal open={!!pwModal && !newPassword} onClose={() => setPwModal(null)} title="Tetapkan Semula Kata Laluan">
        {pwModal && (
          <div className="space-y-4">
            <p className="text-[15px] text-bark-800">
              Jana kata laluan sementara untuk <b>{pwModal.full_name}</b>? Sesi lain akan dilumpuhkan selepas reset.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" full onClick={() => setPwModal(null)}>Batal</Button>
              <Button variant="danger" full onClick={() => resetPassword(pwModal)}>Jana & Reset</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Kata laluan sementara baharu */}
      <Modal open={!!newPassword} onClose={() => { setNewPassword(null); setPwModal(null); reload(); }} title="Kata Laluan Sementara">
        {newPassword && (
          <div className="space-y-4 text-center">
            <div className="rounded-xl bg-cream-100 px-4 py-4">
              <div className="num text-2xl font-extrabold tracking-wide text-bark-900">{newPassword}</div>
            </div>
            <p className="text-sm text-bark-700/70">
              Salin dan beritahu kepada pengguna. <b className="text-berry-600">Kata laluan ini tidak akan dipaparkan lagi.</b>
              Pengguna boleh menukarnya selepas log masuk (akan datang).
            </p>
            <Button full onClick={async () => { try { await navigator.clipboard.writeText(newPassword); toast('Disalin', 'success'); } catch { toast('Gagal menyalin', 'error'); } }}>
              <ShieldCheck size={17} /> Salin Kata Laluan
            </Button>
          </div>
        )}
      </Modal>

      {/* Sahkan lumpuhkan */}
      <Modal open={!!disableUser} onClose={() => setDisableUser(null)} title="Lumpuhkan Pengguna">
        {disableUser && (
          <div className="space-y-4">
            <p className="text-[15px] text-bark-800">
              Lumpuhkan <b>{disableUser.full_name}</b>? Akaun tidak dapat log masuk lagi (termasuk kod QR), tetapi data tidak dipadam.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" full onClick={() => setDisableUser(null)}>Batal</Button>
              <Button variant="danger" full onClick={() => { void disable(disableUser); setDisableUser(null); }}>Lumpuhkan</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

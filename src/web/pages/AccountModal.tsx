import { useEffect, useState } from 'react';
import { KeyRound, LogOut, QrCode, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../api';
import { useAuth, isAdmin } from '../auth';
import { Badge, Button, Field, inputCls, Modal, Spinner, toast } from '../ui';
import { QrLoginModal, type UserQrData } from './UserQr';

/** Modal akaun saya - info pengguna + tukar kata laluan + log keluar */
export default function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, setUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [qrConfirm, setQrConfirm] = useState(false);
  const [qrData, setQrData] = useState<UserQrData | null>(null);
  const [rotating, setRotating] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);

  // Reset borang bila modal ditutup/dibuka
  useEffect(() => {
    if (!open) {
      setCurrent(''); setNext(''); setConfirm(''); setSaving(false); setShowForm(false);
      setQrConfirm(false); setQrData(null); setRotating(false); setLoadingQr(false);
    }
  }, [open]);

  async function changePassword() {
    if (next.length < 8) {
      toast('Kata laluan baharu mesti sekurang-kurangnya 8 aksara', 'error');
      return;
    }
    if (next !== confirm) {
      toast('Kata laluan baharu tidak sepadan', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/auth/change-password', { current_password: current, new_password: next });
      toast('Kata laluan ditukar. Peranti lain akan diminta log masuk semula', 'success');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ralat', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // kuki tetap dibersihkan oleh pelayan
    }
    setUser(null);
    window.location.hash = '/';
  }

  async function rotateMyQr() {
    if (!user) return;
    setRotating(true);
    try {
      const res = await api.post<{ qr_code: string }>(`/api/users/${user.id}/rotate-qr`, {});
      setQrConfirm(false);
      setQrData({ name: user.full_name, username: user.username, position: user.position, code: res.qr_code });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ralat', 'error');
    } finally {
      setRotating(false);
    }
  }

  /** Lihat kod QR sedia ada; kod lama perlu ditukar sekali */
  async function viewMyQr() {
    if (!user) return;
    setLoadingQr(true);
    try {
      const res = await api.get<{ qr_code: string }>(`/api/users/${user.id}/qr`);
      setQrData({ name: user.full_name, username: user.username, position: user.position, code: res.qr_code });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast(e.message, 'error');
        setQrConfirm(true);
      } else {
        toast(e instanceof Error ? e.message : 'Ralat', 'error');
      }
    } finally {
      setLoadingQr(false);
    }
  }

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose} title="Akaun Saya">
      <div className="space-y-4">
        {/* Info pengguna */}
        <div className="flex items-center gap-3 rounded-xl bg-cream-100 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold text-bark-900">{user.full_name}</div>
            <div className="text-xs text-bark-700/60">
              @{user.username}{user.position ? ` · ${user.position}` : ''}
            </div>
          </div>
          <Badge className={isAdmin(user) ? 'bg-bark-800 text-cream-100' : 'bg-cream-200 text-bark-700'}>
            {isAdmin(user) ? 'Admin' : 'Staff'}
          </Badge>
        </div>

        {/* Kad QR log masuk */}
        <div className="rounded-xl border border-cream-300 px-4 py-3.5">
          <div className="text-sm font-bold text-bark-900">Kad QR Log Masuk</div>
          <p className="mt-1 text-xs leading-relaxed text-bark-700/60">
            Lihat dan cetak kad QR anda bila-bila masa. Jika kad hilang, tukar ke kod baharu - kad lama terus tidak sah.
          </p>
          <Button variant="secondary" full className="mt-3" onClick={viewMyQr} disabled={loadingQr}>
            {loadingQr ? <Spinner small /> : <><QrCode size={17} /> Lihat Kod QR</>}
          </Button>
        </div>

        {/* Tukar kata laluan */}
        {!showForm ? (
          <Button variant="secondary" full onClick={() => setShowForm(true)}>
            <KeyRound size={17} /> Tukar Kata Laluan
          </Button>
        ) : (
          <div className="space-y-3">
            <Field label="Kata Laluan Semasa">
              <input className={inputCls} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
            </Field>
            <Field label="Kata Laluan Baharu" hint="Sekurang-kurangnya 8 aksara">
              <input className={inputCls} type="password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <Field label="Sahkan Kata Laluan Baharu">
              <input className={inputCls} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <div className="flex gap-3">
              <Button variant="secondary" full onClick={() => setShowForm(false)}>Batal</Button>
              <Button full onClick={changePassword} disabled={saving || !current || next.length < 8 || next !== confirm}>
                {saving ? <Spinner small /> : <><ShieldCheck size={17} /> Simpan</>}
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-bark-700/60">
              Selepas menukar, peranti lain yang log masuk akan diminta log masuk semula. Peranti ini kekal berjalan.
            </p>
          </div>
        )}

        {/* Log keluar */}
        <Button variant="ghost" full className="!text-berry-600 hover:!bg-berry-soft" onClick={logout}>
          <LogOut size={17} /> Log Keluar
        </Button>
      </div>

      {/* Sahkan jana kod QR sendiri */}
      <Modal open={qrConfirm} onClose={() => setQrConfirm(false)} title="Jana Kod QR Baharu">
        <div className="space-y-4">
          <p className="text-[15px] text-bark-800">
            Jana kod QR log masuk baharu untuk akaun anda? Kad lama <b>terus tidak sah</b> - cetak kad baharu sebelum menutup
            modal.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" full onClick={() => setQrConfirm(false)}>Batal</Button>
            <Button full onClick={rotateMyQr} disabled={rotating}>
              {rotating ? <Spinner small /> : 'Jana Kod Baharu'}
            </Button>
          </div>
        </div>
      </Modal>

      <QrLoginModal
        data={qrData}
        onClose={() => setQrData(null)}
        onRotate={() => { setQrData(null); setQrConfirm(true); }}
      />
    </Modal>
  );
}

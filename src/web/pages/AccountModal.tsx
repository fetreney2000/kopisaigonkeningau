import { useEffect, useState } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { useAuth, isAdmin } from '../auth';
import { Badge, Button, Field, inputCls, Modal, Spinner, toast } from '../ui';

/** Modal akaun saya - info pengguna + tukar kata laluan + log keluar */
export default function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, setUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Reset borang bila modal ditutup/dibuka
  useEffect(() => {
    if (!open) {
      setCurrent(''); setNext(''); setConfirm(''); setSaving(false); setShowForm(false);
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
    </Modal>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { toggleUserSuspension, adjustUserCredits, deleteUserByAdmin } from '@/lib/admin-actions';
import { formatCredits } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { Trash2, AlertTriangle, Loader2, Check } from 'lucide-react';

export interface UserItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  suspended: boolean;
  createdAt: string;
  credits: number;
}

interface UsersTableProps {
  users: UserItem[];
  currentAdminId: string;
}

export function UsersTable({ users, currentAdminId }: UsersTableProps) {
  const { t } = useTranslation();
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<UserItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleDeleteUser = () => {
    if (!selectedUserForDelete) return;
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('id', selectedUserForDelete.id);
        await deleteUserByAdmin(fd);
        setSuccessMessage(`Pengguna ${selectedUserForDelete.email} berhasil dihapus.`);
        setSelectedUserForDelete(null);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Gagal menghapus pengguna.');
      }
    });
  };

  return (
    <>
      {/* Toast Alert */}
      {(successMessage || errorMessage) && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center justify-between border shadow-2xs mb-4 ${
            successMessage
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {successMessage ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{successMessage || errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              setErrorMessage(null);
            }}
            className="text-neutral-500 hover:text-neutral-900 cursor-pointer text-xs font-semibold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-200/80 bg-neutral-50/50">
                <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-4">
                  {t.admin.users.thUser}
                </th>
                <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-3">
                  {t.admin.users.thRole}
                </th>
                <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-3">
                  {t.admin.users.thStatus}
                </th>
                <th className="text-right font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-3">
                  {t.admin.users.thCredits}
                </th>
                <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-3">
                  {t.admin.users.thJoined}
                </th>
                <th className="text-right font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-4">
                  {t.admin.users.thActions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {users.map((u) => {
                const isSelf = u.id === currentAdminId;
                return (
                  <tr key={u.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-neutral-950 flex items-center gap-1.5">
                        <span>{u.email}</span>
                        {isSelf && (
                          <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200">
                            Anda
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">{u.name || t.admin.users.noDisplayName}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin'
                            ? 'bg-neutral-950 text-white'
                            : 'bg-neutral-100 text-neutral-600 border border-neutral-200/80'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {u.suspended ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-red-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
                          {t.admin.status.suspended}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-neutral-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                          {t.admin.status.active}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-neutral-950">
                      {formatCredits(u.credits ?? 0)}
                    </td>
                    <td className="py-3 px-3 font-mono text-neutral-500 text-[11px] whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Adjust credits form */}
                        <form action={adjustUserCredits} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={u.id} />
                          <label htmlFor={`adjust-${u.id}`} className="sr-only">
                            Adjust credits for {u.email}
                          </label>
                          <input
                            id={`adjust-${u.id}`}
                            name="amount"
                            type="number"
                            aria-label={`Adjust credits for ${u.email}`}
                            className="w-20 px-2 py-1 text-xs rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
                            placeholder={t.admin.users.adjustPlaceholder}
                          />
                          <button
                            type="submit"
                            title={t.admin.users.adjustBtn}
                            className="px-2 py-1 text-xs font-semibold rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 cursor-pointer shadow-2xs whitespace-nowrap"
                          >
                            {t.admin.users.adjustBtn}
                          </button>
                        </form>

                        {/* Suspend / Unsuspend button */}
                        {!isSelf && (
                          <form action={toggleUserSuspension}>
                            <input type="hidden" name="id" value={u.id} />
                            <button
                              type="submit"
                              className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 cursor-pointer shadow-2xs whitespace-nowrap ${
                                u.suspended
                                  ? 'border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-100'
                                  : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
                              }`}
                            >
                              {u.suspended ? t.admin.users.unsuspendBtn : t.admin.users.suspendBtn}
                            </button>
                          </form>
                        )}

                        {/* Delete User Button */}
                        {!isSelf ? (
                          <button
                            type="button"
                            onClick={() => setSelectedUserForDelete(u)}
                            title="Hapus Pengguna"
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Pengguna (Admin) */}
      {selectedUserForDelete && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) setSelectedUserForDelete(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-red-200 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h4 className="text-base font-bold text-neutral-950 font-heading">
                  Hapus Akun Pengguna
                </h4>
                <p className="text-xs text-neutral-500">{selectedUserForDelete.email}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-red-50/70 border border-red-200/80 text-xs text-red-900 leading-relaxed space-y-1.5">
              <p>
                Apakah Anda yakin ingin menghapus akun <strong>{selectedUserForDelete.email}</strong> secara permanen?
              </p>
              <ul className="list-disc list-inside text-[11px] text-red-800 space-y-0.5">
                <li>Semua API key aktif milik pengguna ini akan dicabut.</li>
                <li>Saldo kredit ({formatCredits(selectedUserForDelete.credits ?? 0)} credits) akan dihapus.</li>
                <li>Sesi login dan kredensial akun akan dibersihkan dari server.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForDelete(null)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Pengguna</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

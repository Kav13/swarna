import React, { useState, useEffect } from 'react';
import { HardDrive, Download, Upload, ShieldCheck, AlertTriangle, CheckCircle2, Folder } from 'lucide-react';
import { formatDate } from '../utils/dates';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { api } from '../api';

export const BackupRestoreView: React.FC = () => {
  const { isOwner } = useAuth();
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [creating, setCreating] = useState<boolean>(false);

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = useState<boolean>(false);
  const [selectedBackupPath, setSelectedBackupPath] = useState<string>('');
  const [ownerPassword, setOwnerPassword] = useState<string>('');
  const [restoring, setRestoring] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchBackups = async () => {
    setLoading(true);
    try {
      if (window.api) {
        const list = await window.api.backups.listBackups();
        setBackups(list || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      if (window.api) {
        // Prompt for folder or use default
        const folder = await window.api.backups.selectBackupDirectory();
        const res = await window.api.backups.createBackup(folder || undefined);
        alert(`Backup successfully created at:\n${res.backupPath}`);
        fetchBackups();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to create database backup');
    } finally {
      setCreating(false);
    }
  };

  const handleChooseRestoreFile = async () => {
    try {
      if (window.api) {
        const file = await window.api.backups.selectBackupFile();
        if (file) {
          setSelectedBackupPath(file);
          setRestoreModalOpen(true);
          setError('');
        }
      }
    } catch (err: any) {
      alert(err?.message || 'Error selecting backup file');
    }
  };

  const handleConfirmRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerPassword) {
      setError('Owner password is required to restore database.');
      return;
    }

    setRestoring(true);
    setError('');
    try {
      if (window.api) {
        await window.api.backups.restoreBackup(selectedBackupPath, ownerPassword);
        alert('Database successfully restored! The application will now reload.');
        window.location.reload();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to restore database');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-amber-500" /> Offline Vault Backup & Recovery
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Safeguard your jewellery loan database with verified SQLite snapshots and tamper recovery
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="gold"
            size="sm"
            isLoading={creating}
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleCreateBackup}
          >
            Create Backup Snapshot Now
          </Button>

          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              icon={<Upload className="w-3.5 h-3.5" />}
              onClick={handleChooseRestoreFile}
            >
              Restore Database
            </Button>
          )}
        </div>
      </div>

      {/* Safety Notice Card */}
      <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-800 rounded-2xl text-white shadow-xl flex items-start gap-4 text-xs">
        <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="font-bold text-sm text-white">Full Database Integrity Protection</h3>
          <p className="text-slate-300">
            Every backup is verified using <code>PRAGMA integrity_check</code> before writing to disk. Before any restore operation, an automated safety snapshot of the live database is created.
          </p>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Local Backup History</h3>
          <span className="text-slate-400 font-mono text-[11px]">{backups.length} snapshots recorded</span>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
              <th className="py-3 px-4">Backup ID</th>
              <th className="py-3 px-4">Created Date</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">File Path</th>
              <th className="py-3 px-4 text-right">Size</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {backups.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No backup records found. Click &quot;Create Backup Snapshot Now&quot; to archive your database.
                </td>
              </tr>
            ) : (
              backups.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.id}</td>
                  <td className="py-3 px-4 font-mono">{formatDate(b.created_at)}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                      {b.backup_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 text-[11px] max-w-xs truncate" title={b.backup_path}>
                    {b.backup_path}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">
                    {(b.file_size_bytes / 1024).toFixed(1)} KB
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Restore Database Modal */}
      <Modal isOpen={restoreModalOpen} onClose={() => setRestoreModalOpen(false)} title="Restore Database From Backup">
        <form onSubmit={handleConfirmRestore} className="space-y-4 text-xs">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1">
            <div className="font-bold flex items-center gap-2 text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600" /> WARNING: Database Replacement
            </div>
            <p>
              Restoring will replace the current live database with the selected snapshot. An automatic safety pre-restore backup will be created first.
            </p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Selected Backup File:</label>
            <div className="p-2 bg-slate-100 rounded border border-slate-200 font-mono text-slate-800 break-all">
              {selectedBackupPath}
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Owner Password for Authorization *
            </label>
            <input
              type="password"
              required
              autoFocus
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500"
              placeholder="Enter Owner master password"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
            />
          </div>

          {error && <div className="text-rose-600 font-semibold">{error}</div>}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setRestoreModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={restoring}>
              Confirm & Restore Database
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

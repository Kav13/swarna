import React, { useState, useEffect } from 'react';
import { UserCog, Plus, Shield, KeyRound, UserX, UserCheck, AlertCircle } from 'lucide-react';
import { User, Role } from '../types';
import { formatDate } from '../utils/dates';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { api } from '../api';

export const UsersManagementView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [resetModalOpen, setResetModalOpen] = useState<boolean>(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState<boolean>(false);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');

  const [newUser, setNewUser] = useState({
    username: '',
    full_name: '',
    password: '',
    role: 'EXECUTIVE' as Role,
  });
  const [error, setError] = useState<string>('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      if (window.api) {
        const list = await window.api.auth.listUsers();
        setUsers(list || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newUser.username.trim() || !newUser.full_name.trim() || !newUser.password) {
      setError('All fields are required.');
      return;
    }
    if (newUser.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      if (window.api) {
        await window.api.auth.createUser(newUser);
        setCreateModalOpen(false);
        setNewUser({ username: '', full_name: '', password: '', role: 'EXECUTIVE' });
        fetchUsers();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create user account');
    }
  };

  const handleTogglePermission = async (permissionKey: string, currentValue: boolean) => {
    if (!selectedUser) return;
    try {
      if (window.api) {
        await window.api.auth.setUserPermission(selectedUser.id, permissionKey, !currentValue);
        // Refresh local user state and full list
        const updatedPermissions = {
          ...(selectedUser.permissions || {}),
          [permissionKey]: !currentValue,
        };
        setSelectedUser({ ...selectedUser, permissions: updatedPermissions });
        fetchUsers();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update permission');
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (user.role === 'OWNER') {
      alert('Cannot disable the primary Owner account.');
      return;
    }

    try {
      if (window.api) {
        await window.api.auth.toggleUserStatus(user.id, !user.is_active);
        fetchUsers();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to change user status');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert('New password must be at least 6 characters.');
      return;
    }

    try {
      if (window.api) {
        await window.api.auth.resetPassword(targetUserId, newPassword);
        setResetModalOpen(false);
        setNewPassword('');
        setTargetUserId('');
        alert('Password has been successfully updated.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to reset password');
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCog className="w-5 h-5 text-amber-500" /> Employee & Role Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Role-based access control (RBAC) and staff authentication credentials
          </p>
        </div>

        <Button
          variant="gold"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setCreateModalOpen(true)}
        >
          Add Staff Account
        </Button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
              <th className="py-3 px-4">Full Name</th>
              <th className="py-3 px-4">Username</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Privileges</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4">Created Date</th>
              <th className="py-3 px-4">Last Login</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-semibold text-slate-900">{u.full_name}</td>
                <td className="py-3 px-4 font-mono text-slate-700">{u.username}</td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                      u.role === 'OWNER'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {u.role === 'OWNER' ? (
                    <span className="text-[11px] font-semibold text-amber-800">Full System Access</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.permissions?.CREATE_BACKDATED_LOAN && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-medium">
                          Backdated
                        </span>
                      )}
                      {u.permissions?.IMPORT_HISTORICAL_LOANS && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-medium">
                          CSV Import
                        </span>
                      )}
                      {u.permissions?.OVERRIDE_LTV && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                          LTV Override
                        </span>
                      )}
                      {!u.permissions?.CREATE_BACKDATED_LOAN &&
                        !u.permissions?.IMPORT_HISTORICAL_LOANS &&
                        !u.permissions?.OVERRIDE_LTV && (
                          <span className="text-[11px] text-slate-400">Standard Staff</span>
                        )}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      u.is_active
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {u.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-500 font-mono">{formatDate(u.created_at)}</td>
                <td className="py-3 px-4 text-slate-500 font-mono">
                  {u.last_login ? formatDate(u.last_login) : 'Never'}
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setPermissionsModalOpen(true);
                      }}
                      className="p-1 text-slate-500 hover:text-amber-700 rounded"
                      title="Manage Staff Privileges & Permissions"
                    >
                      <Shield className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setTargetUserId(u.id);
                        setResetModalOpen(true);
                      }}
                      className="p-1 text-slate-500 hover:text-amber-700 rounded"
                      title="Reset Password"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>

                    {u.role !== 'OWNER' && (
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`p-1 rounded ${
                          u.is_active
                            ? 'text-rose-500 hover:text-rose-700'
                            : 'text-emerald-500 hover:text-emerald-700'
                        }`}
                        title={u.is_active ? 'Disable Account' : 'Enable Account'}
                      >
                        {u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Staff Account">
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Full Legal Name *</label>
            <input
              type="text"
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
              placeholder="e.g. Ramesh Patel"
              value={newUser.full_name}
              onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Username *</label>
            <input
              type="text"
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
              placeholder="e.g. ramesh"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
              placeholder="Min 6 characters"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Role Permission Level *</label>
            <select
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
            >
              <option value="EXECUTIVE">Executive / Worker (Operational Only)</option>
              <option value="OWNER">Super Admin / Owner (Full Control)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold">
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={resetModalOpen} onClose={() => setResetModalOpen(false)} title="Reset Account Password">
        <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Enter New Password *</label>
            <input
              type="password"
              required
              autoFocus
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
              placeholder="Min 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setResetModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold">
              Save New Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Granular Staff Permissions Modal */}
      <Modal
        isOpen={permissionsModalOpen}
        onClose={() => setPermissionsModalOpen(false)}
        title={`Staff Privileges: ${selectedUser?.full_name || ''}`}
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <div className="font-bold text-slate-900 text-sm">{selectedUser?.full_name}</div>
              <div className="text-slate-500 font-mono">@{selectedUser?.username} • Role: {selectedUser?.role}</div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                selectedUser?.role === 'OWNER'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              {selectedUser?.role}
            </span>
          </div>

          {selectedUser?.role === 'OWNER' ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                Unrestricted Owner Privileges
              </div>
              <p className="text-[11px] text-amber-800">
                The business Owner account possesses full administrative control across all system functions, audit logs, ledger operations, and backdating permissions by architecture.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-500 text-[11px]">
                Configure granular capabilities for this executive staff account. Changes take effect immediately.
              </p>

              {/* CREATE_BACKDATED_LOAN Toggle */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>Record Backdated Loans</span>
                    {selectedUser?.permissions?.CREATE_BACKDATED_LOAN && (
                      <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] rounded font-semibold">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Allows this executive to record loans with past business dates (requires audit reason).
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer mt-0.5"
                  checked={Boolean(selectedUser?.permissions?.CREATE_BACKDATED_LOAN)}
                  onChange={() =>
                    handleTogglePermission(
                      'CREATE_BACKDATED_LOAN',
                      Boolean(selectedUser?.permissions?.CREATE_BACKDATED_LOAN)
                    )
                  }
                />
              </div>

              {/* IMPORT_HISTORICAL_LOANS Toggle */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>Historical Loans CSV Import</span>
                    {selectedUser?.permissions?.IMPORT_HISTORICAL_LOANS && (
                      <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[10px] rounded font-semibold">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Allows this executive to access and execute offline historical CSV loan batch imports.
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer mt-0.5"
                  checked={Boolean(selectedUser?.permissions?.IMPORT_HISTORICAL_LOANS)}
                  onChange={() =>
                    handleTogglePermission(
                      'IMPORT_HISTORICAL_LOANS',
                      Boolean(selectedUser?.permissions?.IMPORT_HISTORICAL_LOANS)
                    )
                  }
                />
              </div>

              {/* OVERRIDE_LTV Toggle */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900">Approve LTV Overrides</div>
                  <div className="text-slate-500 text-[11px]">
                    Allows this executive to authorize loans that exceed standard maximum loan-to-value limits.
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer mt-0.5"
                  checked={Boolean(selectedUser?.permissions?.OVERRIDE_LTV)}
                  onChange={() =>
                    handleTogglePermission(
                      'OVERRIDE_LTV',
                      Boolean(selectedUser?.permissions?.OVERRIDE_LTV)
                    )
                  }
                />
              </div>

              {/* VIEW_FULL_AADHAAR Toggle */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900">View Full Aadhaar Numbers</div>
                  <div className="text-slate-500 text-[11px]">
                    Allows unmasking and viewing customer 12-digit Aadhaar numbers with audit logging.
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer mt-0.5"
                  checked={Boolean(selectedUser?.permissions?.VIEW_FULL_AADHAAR)}
                  onChange={() =>
                    handleTogglePermission(
                      'VIEW_FULL_AADHAAR',
                      Boolean(selectedUser?.permissions?.VIEW_FULL_AADHAAR)
                    )
                  }
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setPermissionsModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

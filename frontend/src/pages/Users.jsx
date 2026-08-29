import { useEffect, useState } from "react";
import client, { getErrorMessage } from "../api/client.js";
import Modal from "../components/Modal.jsx";

const emptyForm = { full_name: "", email: "", phone: "", role: "employee", password: "" };
const PASSWORD_HINT = "At least 8 characters, including a letter and a number.";

function isPasswordStrong(password) {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalItem, setModalItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await client.get("/users");
      setUsers(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setModalItem({});
  }

  function openEdit(user) {
    setForm({ full_name: user.full_name, email: user.email, phone: user.phone || "", role: user.role, password: "" });
    setModalItem(user);
  }

  async function handleSave(e) {
    e.preventDefault();
    const needsPassword = !modalItem?.id || form.password;
    if (needsPassword && !isPasswordStrong(form.password)) {
      alert(PASSWORD_HINT);
      return;
    }
    setSaving(true);
    try {
      if (modalItem?.id) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        delete payload.email;
        await client.put(`/users/${modalItem.id}`, payload);
      } else {
        await client.post("/users", form);
      }
      setModalItem(null);
      loadUsers();
    } catch (err) {
      alert(getErrorMessage(err, "Failed to save user"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user) {
    try {
      await client.put(`/users/${user.id}`, { is_active: !user.is_active });
      loadUsers();
    } catch (err) {
      alert(getErrorMessage(err, "Failed to update user"));
    }
  }

  async function handleDelete(user) {
    if (!confirm(`Delete account for "${user.full_name}"?`)) return;
    try {
      await client.delete(`/users/${user.id}`);
      loadUsers();
    } catch (err) {
      alert(getErrorMessage(err, "Failed to delete user"));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">User Accounts</h2>
        <button
          onClick={openCreate}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Add User
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-800">{u.full_name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {u.is_active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3 space-x-3">
                  <button onClick={() => openEdit(u)} className="text-brand-600 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => toggleActive(u)} className="text-amber-600 hover:underline">
                    {u.is_active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => handleDelete(u)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalItem !== null && (
        <Modal title={modalItem.id ? "Edit User" : "Add User"} onClose={() => setModalItem(null)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                required
                disabled={!!modalItem.id}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {modalItem.id ? "New Password (leave blank to keep current)" : "Password"}
              </label>
              <input
                type="password"
                required={!modalItem.id}
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {(!modalItem.id || form.password) && (
                <p className="mt-1 text-xs text-gray-400">{PASSWORD_HINT}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalItem(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

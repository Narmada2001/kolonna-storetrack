import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  fulfilled: "bg-emerald-100 text-emerald-700",
};

export default function Requests() {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(Boolean(location.state?.openCreate));
  const [form, setForm] = useState({ item_id: "", quantity: 1 });
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (location.state?.openCreate) {
      setShowCreate(true);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await client.get("/requests");
      setRequests(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
    client.get("/items").then((res) => setItems(res.data));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await client.post("/requests", { item_id: Number(form.item_id), quantity: Number(form.quantity) });
      setShowCreate(false);
      setForm({ item_id: "", quantity: 1 });
      loadRequests();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create request");
    }
  }

  async function handleAction(request, action) {
    setBusyId(request.id);
    try {
      if (action === "fulfill") {
        await client.post(`/requests/${request.id}/fulfill`);
      } else {
        await client.post(`/requests/${request.id}/${action}`, {});
      }
      loadRequests();
    } catch (err) {
      alert(err.response?.data?.detail || `Failed to ${action} request`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{isAdmin ? "All Item Requests" : "My Requests"}</h2>
        {!isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + New Request
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">Item</th>
              {isAdmin && <th className="px-4 py-3">Requested By</th>}
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Requested On</th>
              {isAdmin && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && requests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No requests found.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-800">{r.item_name}</td>
                {isAdmin && <td className="px-4 py-3 text-gray-600">{r.employee_name}</td>}
                <td className="px-4 py-3">{r.quantity}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(r.request_date).toLocaleString()}</td>
                {isAdmin && (
                  <td className="px-4 py-3 space-x-3">
                    {r.status === "pending" && (
                      <>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => handleAction(r, "approve")}
                          className="text-emerald-600 hover:underline disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => handleAction(r, "reject")}
                          className="text-red-600 hover:underline disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <button
                        disabled={busyId === r.id}
                        onClick={() => handleAction(r, "fulfill")}
                        className="text-brand-600 hover:underline disabled:opacity-50"
                      >
                        Fulfill
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="New Item Request" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Item</label>
              <select
                required
                value={form.item_id}
                onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select an item...</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.quantity_in_stock} in stock)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Submit Request
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

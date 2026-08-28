import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import { IconClock, IconCheckCircle, IconBox, IconXCircle } from "../components/Icons.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  fulfilled: "bg-emerald-100 text-emerald-700",
};

const STATUS_ICONS = {
  pending: IconClock,
  approved: IconCheckCircle,
  fulfilled: IconBox,
  rejected: IconXCircle,
};

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "fulfilled", label: "Fulfilled" },
  { key: "rejected", label: "Rejected" },
];

const RESPONSE_LABEL = {
  fulfilled: "Fulfilled",
  rejected: "Rejected",
  approved: "Approved",
};

export default function Requests() {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(Boolean(location.state?.openCreate));
  const [form, setForm] = useState({ item_id: "", quantity: 1 });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [decision, setDecision] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (location.state?.openCreate) {
      setShowCreate(true);
      if (location.state?.itemId) {
        setForm((f) => ({ ...f, item_id: String(location.state.itemId) }));
      }
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await client.get("/requests");
      setRequests(res.data);
      setError("");
    } catch {
      setError("Could not load requests.");
    } finally {
      setLoading(false);
    }
  }

  function loadItemOptions() {
    setItemsLoading(true);
    client
      .get("/items")
      .then((res) => {
        setItems(res.data);
        setItemsError("");
      })
      .catch(() => setItemsError("Could not load the item list."))
      .finally(() => setItemsLoading(false));
  }

  useEffect(() => {
    loadRequests();
    loadItemOptions();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setCreateError("");
    try {
      await client.post("/requests", { item_id: Number(form.item_id), quantity: Number(form.quantity) });
      setShowCreate(false);
      setForm({ item_id: "", quantity: 1 });
      loadRequests();
    } catch (err) {
      setCreateError(err.response?.data?.detail || "Failed to create request");
    } finally {
      setCreating(false);
    }
  }

  function closeCreateModal() {
    if (creating) return;
    setShowCreate(false);
    setCreateError("");
    setForm({ item_id: "", quantity: 1 });
  }

  function openDecision(request, action) {
    setDecision({ request, action, note: "", error: "" });
  }

  async function handleDecision(e) {
    e.preventDefault();
    if (!decision || busyId) return;
    const { request, action, note } = decision;
    if (action === "reject" && !note.trim()) {
      setDecision({ ...decision, error: "Please provide a reason for rejecting this request." });
      return;
    }
    setBusyId(request.id);
    try {
      if (action === "fulfill") {
        await client.post(`/requests/${request.id}/fulfill`);
      } else {
        await client.post(`/requests/${request.id}/${action}`, { admin_note: note.trim() || null });
      }
      setDecision(null);
      loadRequests();
    } catch (err) {
      setDecision((current) => ({
        ...current,
        error: err.response?.data?.detail || `Failed to ${action} request`,
      }));
    } finally {
      setBusyId(null);
    }
  }

  const statusCounts = useMemo(
    () => requests.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {}),
    [requests]
  );

  const filteredRequests = useMemo(
    () => (statusFilter === "all" ? requests : requests.filter((r) => r.status === statusFilter)),
    [requests, statusFilter]
  );

  const colCount = isAdmin ? 6 : 4;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
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

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={loadRequests} className="font-medium underline hover:no-underline">
            Try again
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter requests by status">
          {STATUS_TABS.map((tab) => {
            const count = tab.key === "all" ? requests.length : statusCounts[tab.key] || 0;
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {tab.label} <span className={active ? "opacity-80" : "text-gray-400"}>({count})</span>
              </button>
            );
          })}
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
            {loading && <SkeletonRows rows={4} columns={colCount} />}
            {!loading && !error && filteredRequests.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center">
                  {requests.length === 0 ? (
                    <>
                      <p className="text-gray-400">
                        {isAdmin ? "No requests found." : "You haven't made any requests yet."}
                      </p>
                      {!isAdmin && (
                        <button
                          onClick={() => setShowCreate(true)}
                          className="mt-3 rounded-md bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          + New Request
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-gray-400">No {statusFilter} requests.</p>
                      <button
                        onClick={() => setStatusFilter("all")}
                        className="mt-2 text-xs font-medium text-brand-600 hover:underline"
                      >
                        Show all requests
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )}
            {!loading && filteredRequests.map((r) => {
              const StatusIcon = STATUS_ICONS[r.status];
              return (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-800">{r.item_name}</td>
                {isAdmin && <td className="px-4 py-3 text-gray-600">{r.employee_name}</td>}
                <td className="px-4 py-3">{r.quantity}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[r.status]}`}
                  >
                    {StatusIcon && <StatusIcon className="h-3 w-3" />}
                    {r.status}
                  </span>
                  {r.admin_note && (
                    <p className="mt-1 max-w-[240px] text-xs italic text-gray-500" title={r.admin_note}>
                      &ldquo;{r.admin_note}&rdquo;
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(r.request_date).toLocaleString()}
                  {r.response_date && (
                    <p className="text-xs text-gray-400">
                      {RESPONSE_LABEL[r.status] || "Updated"}: {new Date(r.response_date).toLocaleDateString()}
                    </p>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 space-x-3">
                    {r.status === "pending" && (
                      <>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => openDecision(r, "approve")}
                          className="text-emerald-600 hover:underline disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => openDecision(r, "reject")}
                          className="text-red-600 hover:underline disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <button
                        disabled={busyId === r.id}
                        onClick={() => openDecision(r, "fulfill")}
                        className="text-brand-600 hover:underline disabled:opacity-50"
                      >
                        Fulfill
                      </button>
                    )}
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="New Item Request" onClose={closeCreateModal}>
          <form onSubmit={handleCreate} className="space-y-3">
            {createError && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Item</label>
              <select
                required
                disabled={itemsLoading || items.length === 0}
                value={form.item_id}
                onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
              >
                {itemsLoading && <option value="">Loading items...</option>}
                {!itemsLoading && items.length === 0 && <option value="">No items available</option>}
                {!itemsLoading && items.length > 0 && (
                  <>
                    <option value="">Select an item...</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.quantity_in_stock} in stock)
                      </option>
                    ))}
                  </>
                )}
              </select>
              {itemsError && (
                <p className="mt-1 text-xs text-red-600">
                  {itemsError}{" "}
                  <button type="button" onClick={loadItemOptions} className="underline hover:no-underline">
                    Retry
                  </button>
                </p>
              )}
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
                disabled={creating}
                onClick={closeCreateModal}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || itemsLoading || items.length === 0}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {decision && (
        <Modal
          title={`${decision.action === "fulfill" ? "Fulfill" : decision.action === "approve" ? "Approve" : "Reject"} Request`}
          onClose={() => !busyId && setDecision(null)}
        >
          <form onSubmit={handleDecision} className="space-y-4">
            <p className="text-sm text-gray-600">
              {decision.action === "fulfill"
                ? `Issue ${decision.request.quantity} × ${decision.request.item_name}?`
                : `${decision.action === "approve" ? "Approve" : "Reject"} ${decision.request.item_name} for ${decision.request.employee_name}?`}
            </p>
            {decision.action !== "fulfill" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Admin note {decision.action === "reject" ? "(required)" : "(optional)"}
                </label>
                <textarea
                  rows="3"
                  required={decision.action === "reject"}
                  value={decision.note}
                  onChange={(e) => setDecision({ ...decision, note: e.target.value, error: "" })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}
            {decision.error && <p role="alert" className="text-sm text-red-600">{decision.error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={Boolean(busyId)} onClick={() => setDecision(null)} className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={Boolean(busyId)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busyId ? "Saving..." : "Confirm"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

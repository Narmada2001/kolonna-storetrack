import { useEffect, useState } from "react";
import client from "../api/client.js";
import Modal from "../components/Modal.jsx";

const emptyForm = { item_id: "", supplier_id: "", type: "received", quantity: 1, reference_no: "" };

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter]);

  const filteredTransactions = transactions.filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    
    const q = searchQuery.toLowerCase();
    if (q) {
      return (
        (t.item_name && t.item_name.toLowerCase().includes(q)) ||
        (t.supplier_name && t.supplier_name.toLowerCase().includes(q)) ||
        (t.reference_no && t.reference_no.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const currentData = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  async function loadTransactions() {
    setLoading(true);
    try {
      const res = await client.get("/transactions");
      setTransactions(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
    client.get("/items").then((res) => setItems(res.data));
    client.get("/suppliers").then((res) => setSuppliers(res.data));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await client.post("/transactions", {
        item_id: Number(form.item_id),
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        type: form.type,
        quantity: Number(form.quantity),
        reference_no: form.reference_no || null,
      });
      setShowCreate(false);
      setForm(emptyForm);
      loadTransactions();
      client.get("/items").then((res) => setItems(res.data));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to record transaction");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Stock Transactions</h2>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + Record Transaction
          </button>
        </div>
      </div>
      
      <div className="mb-4 flex space-x-2">
        {["all", "received", "issued"].map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
              typeFilter === type
                ? "bg-brand-100 text-brand-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Recorded By</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && transactions.length > 0 && filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  No transactions match your search/filter.
                </td>
              </tr>
            )}
            {currentData.map((t) => (
              <tr key={t.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-800">{t.item_name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                      t.type === "received" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {t.type}
                  </span>
                </td>
                <td className="px-4 py-3">{t.quantity}</td>
                <td className="px-4 py-3">{t.supplier_name || "-"}</td>
                <td className="px-4 py-3">{t.reference_no || "-"}</td>
                <td className="px-4 py-3">{t.recorded_by_name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(t.transaction_date).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit"
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of{" "}
            {filteredTransactions.length} results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <Modal title="Record Stock Transaction" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="received">Received (stock in)</option>
                <option value="issued">Issued (stock out)</option>
              </select>
            </div>
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
            {form.type === "received" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Supplier (optional)</label>
                <select
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reference No.</label>
                <input
                  value={form.reference_no}
                  onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. PO-2026-014"
                />
              </div>
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
                disabled={saving}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Record"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

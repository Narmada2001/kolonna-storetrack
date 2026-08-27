import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import { IconSearch, IconPlus } from "../components/Icons.jsx";

const emptyForm = {
  name: "",
  category: "",
  description: "",
  unit: "",
  quantity_in_stock: 0,
  reorder_level: 0,
  unit_price: 0,
};

const SORT_OPTIONS = [
  { value: "name", label: "Sort: Name (A–Z)" },
  { value: "stock_asc", label: "Sort: Stock (Low → High)" },
  { value: "stock_desc", label: "Sort: Stock (High → Low)" },
];

function sortItems(items, sortBy) {
  const arr = [...items];
  if (sortBy === "stock_asc") arr.sort((a, b) => a.quantity_in_stock - b.quantity_in_stock);
  else if (sortBy === "stock_desc") arr.sort((a, b) => b.quantity_in_stock - a.quantity_in_stock);
  else arr.sort((a, b) => a.name.localeCompare(b.name));
  return arr;
}

export default function Inventory() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalItem, setModalItem] = useState(null); // null = closed, {} = create, {...} = edit
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadItems() {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (lowStockOnly) params.low_stock_only = true;
      const res = await client.get("/items", { params });
      setItems(res.data);
      setError("");
    } catch {
      setError("Could not load inventory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadItems, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, lowStockOnly]);

  // Full category list, independent of the current filters, so choosing one
  // category doesn't make the others disappear from the dropdown.
  useEffect(() => {
    client
      .get("/items")
      .then((res) => {
        const unique = [...new Set(res.data.map((i) => i.category).filter(Boolean))].sort();
        setCategories(unique);
      })
      .catch(() => {
        // non-fatal: the category filter just stays empty
      });
  }, []);

  const sortedItems = useMemo(() => sortItems(items, sortBy), [items, sortBy]);
  const hasActiveFilters = Boolean(search || category || lowStockOnly);

  function clearFilters() {
    setSearch("");
    setCategory("");
    setLowStockOnly(false);
  }

  function openCreate() {
    setForm(emptyForm);
    setModalItem({});
  }

  function openEdit(item) {
    setForm({
      name: item.name,
      category: item.category || "",
      description: item.description || "",
      unit: item.unit || "",
      quantity_in_stock: item.quantity_in_stock,
      reorder_level: item.reorder_level,
      unit_price: item.unit_price,
    });
    setModalItem(item);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (modalItem?.id) {
        await client.put(`/items/${modalItem.id}`, form);
      } else {
        await client.post("/items", form);
      }
      setModalItem(null);
      loadItems();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await client.delete(`/items/${item.id}`);
      loadItems();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete item");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Inventory</h2>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + Add Item
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          Low stock only
        </label>

        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-sm font-medium text-brand-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      <p className="mb-4 text-xs text-gray-500">
        {loading ? "Loading..." : `${sortedItems.length} item${sortedItems.length === 1 ? "" : "s"} found`}
      </p>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Reorder Level</th>
              <th className="px-4 py-3">Unit Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
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
            {!loading && sortedItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <p className="text-gray-400">
                    {hasActiveFilters ? "No items match your filters." : "No items found."}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="mt-2 text-xs font-medium text-brand-600 hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            )}
            {sortedItems.map((item) => (
              <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                <td className="px-4 py-3 text-gray-600">{item.category || "-"}</td>
                <td className="px-4 py-3">
                  {item.quantity_in_stock} {item.unit}
                </td>
                <td className="px-4 py-3">{item.reorder_level}</td>
                <td className="px-4 py-3">Rs {Number(item.unit_price).toFixed(2)}</td>
                <td className="px-4 py-3">
                  {item.is_low_stock ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Low Stock
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      OK
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <div className="space-x-3">
                      <button onClick={() => openEdit(item)} className="text-brand-600 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(item)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </div>
                  ) : (
                    <Link
                      to="/requests"
                      state={{ openCreate: true, itemId: item.id }}
                      className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
                    >
                      <IconPlus className="h-3.5 w-3.5" />
                      Request
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalItem !== null && (
        <Modal title={modalItem.id ? "Edit Item" : "Add Item"} onClose={() => setModalItem(null)}>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                <input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. box, unit, ream"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.quantity_in_stock}
                  onChange={(e) => setForm({ ...form, quantity_in_stock: Number(e.target.value) })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Level</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.reorder_level}
                  onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Unit Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
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

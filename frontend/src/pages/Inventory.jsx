import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import { IconSearch, IconPlus } from "../components/Icons.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";

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
  { value: "status", label: "Sort: Status (Most Urgent First)" },
];

// "" = old behavior preserved (no filter). "needs_attention" maps to the
// existing low_stock_only API param (low_stock + out_of_stock together,
// unchanged from before); the other two use the newer, more precise
// stock_status param so an admin can isolate just one tier.
const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "needs_attention", label: "Needs Restocking (Low + Out)" },
  { value: "low_stock", label: "Low Stock Only" },
  { value: "out_of_stock", label: "Out of Stock Only" },
];

function formatApiError(err, fallback) {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  }
  return fallback;
}

// FastAPI/pydantic 422 errors come back as a list of {loc, msg} objects.
// Map them to {fieldName: message} so the form can show them inline;
// returns null for non-validation errors (403, 404, network, ...).
function parseFieldErrors(err) {
  const detail = err.response?.data?.detail;
  if (!Array.isArray(detail)) return null;
  const fieldErrors = {};
  for (const d of detail) {
    const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null;
    if (typeof field === "string") {
      fieldErrors[field] = d.msg || "Invalid value";
    }
  }
  return Object.keys(fieldErrors).length ? fieldErrors : null;
}

const MAX_UNIT_PRICE = 99999999.99;
// Sanity ceiling for a physical store's stock counts — mirrors the backend's
// _MAX_STOCK_QUANTITY, well within what a fat-fingered extra digit could hit.
const MAX_STOCK_QUANTITY = 1_000_000;

// Mirrors the backend's ItemCreate/ItemUpdate rules so mistakes are caught
// instantly, without a round trip — the backend stays the source of truth.
function validateItemForm(f) {
  const errors = {};
  const name = (f.name || "").trim();
  if (!name) errors.name = "Item name cannot be blank";
  else if (name.length > 150) errors.name = "Name must be 150 characters or fewer";

  if ((f.category || "").length > 100) errors.category = "Category must be 100 characters or fewer";
  if ((f.unit || "").length > 30) errors.unit = "Unit must be 30 characters or fewer";

  if (f.quantity_in_stock === "" || Number.isNaN(Number(f.quantity_in_stock)) || Number(f.quantity_in_stock) < 0) {
    errors.quantity_in_stock = "Quantity must be 0 or greater";
  } else if (Number(f.quantity_in_stock) > MAX_STOCK_QUANTITY) {
    errors.quantity_in_stock = "Quantity is too large";
  }
  if (f.reorder_level === "" || Number.isNaN(Number(f.reorder_level)) || Number(f.reorder_level) < 0) {
    errors.reorder_level = "Reorder level must be 0 or greater";
  } else if (Number(f.reorder_level) > MAX_STOCK_QUANTITY) {
    errors.reorder_level = "Reorder level is too large";
  }
  if (f.unit_price === "" || Number.isNaN(Number(f.unit_price)) || Number(f.unit_price) < 0) {
    errors.unit_price = "Unit price must be 0 or greater";
  } else if (Number(f.unit_price) > MAX_UNIT_PRICE) {
    errors.unit_price = "Unit price is too large";
  }
  return errors;
}

// Mirrors the backend's items.py _stock_status(): a three-tier read on where
// an item sits relative to its own reorder point, distinguishing "empty" from
// "just below the reorder line" — is_low_stock (kept for existing callers)
// only ever expressed the coarser two-tier version.
const STOCK_STATUS_META = {
  out_of_stock: { label: "Out of Stock", badge: "bg-red-100 text-red-700", text: "text-red-600 font-semibold" },
  low_stock: { label: "Low Stock", badge: "bg-amber-100 text-amber-700", text: "text-amber-700 font-semibold" },
  ok: { label: "OK", badge: "bg-emerald-100 text-emerald-700", text: "text-gray-700" },
};

function computeStockStatus(quantity, reorderLevel) {
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= reorderLevel) return "low_stock";
  return "ok";
}

// Lower = more urgent. Used only for the "most urgent first" sort; the
// server-side stock_status filter is the source of truth for which tier
// an item is actually in.
const STATUS_SEVERITY = { out_of_stock: 0, low_stock: 1, ok: 2 };

function sortItems(items, sortBy) {
  const arr = [...items];
  if (sortBy === "stock_asc") arr.sort((a, b) => a.quantity_in_stock - b.quantity_in_stock);
  else if (sortBy === "stock_desc") arr.sort((a, b) => b.quantity_in_stock - a.quantity_in_stock);
  else if (sortBy === "status") {
    arr.sort(
      (a, b) =>
        STATUS_SEVERITY[a.stock_status] - STATUS_SEVERITY[b.stock_status] || a.name.localeCompare(b.name)
    );
  } else arr.sort((a, b) => a.name.localeCompare(b.name));
  return arr;
}

export default function Inventory() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalItem, setModalItem] = useState(null); // null = closed, {} = create, {...} = edit
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function loadItems() {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (statusFilter === "needs_attention") params.low_stock_only = true;
      else if (statusFilter === "low_stock" || statusFilter === "out_of_stock") {
        params.stock_status = statusFilter;
      }
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
  }, [search, category, statusFilter]);

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
  const hasActiveFilters = Boolean(search || category || statusFilter);

  // Quick health-check counts alongside the result count, from whatever is
  // currently loaded — useful to both admin (what needs restocking) and
  // employee (what might not be requestable) at a glance.
  const statusCounts = useMemo(() => {
    let lowStock = 0;
    let outOfStock = 0;
    for (const item of sortedItems) {
      if (item.stock_status === "low_stock") lowStock += 1;
      else if (item.stock_status === "out_of_stock") outOfStock += 1;
    }
    return { lowStock, outOfStock };
  }, [sortedItems]);

  // Live preview of how the item will read once saved, so an admin can see
  // the effect of the Quantity/Reorder Level pair before submitting.
  const modalStockStatus = useMemo(() => {
    const q = Number(form.quantity_in_stock);
    const r = Number(form.reorder_level);
    if (Number.isNaN(q) || Number.isNaN(r) || q < 0 || r < 0) return null;
    return computeStockStatus(q, r);
  }, [form.quantity_in_stock, form.reorder_level]);

  function clearFilters() {
    setSearch("");
    setCategory("");
    setStatusFilter("");
  }

  function openCreate() {
    setForm(emptyForm);
    setFormErrors({});
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
    setFormErrors({});
    setModalItem(item);
  }

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    const clientErrors = validateItemForm(form);
    if (Object.keys(clientErrors).length > 0) {
      setFormErrors(clientErrors);
      return;
    }
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
      const fieldErrors = parseFieldErrors(err);
      if (fieldErrors) {
        setFormErrors(fieldErrors);
      } else {
        alert(formatApiError(err, "Failed to save item"));
      }
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
      alert(formatApiError(err, "Failed to delete item"));
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

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-sm font-medium text-brand-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {!error && (
        <p className="mb-4 text-xs text-gray-500">
          {loading ? (
            "Loading..."
          ) : (
            <>
              {sortedItems.length} item{sortedItems.length === 1 ? "" : "s"} found
              {statusCounts.outOfStock > 0 && (
                <span className="text-red-600"> · {statusCounts.outOfStock} out of stock</span>
              )}
              {statusCounts.lowStock > 0 && (
                <span className="text-amber-700"> · {statusCounts.lowStock} low stock</span>
              )}
            </>
          )}
        </p>
      )}

      {error && (
        <div className="mb-3 flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={loadItems} className="font-medium underline hover:no-underline">
            Try again
          </button>
        </div>
      )}

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
            {loading && <SkeletonRows rows={5} columns={7} />}
            {!loading && !error && sortedItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <p className="text-gray-400">
                    {hasActiveFilters ? "No items match your filters." : "No items in inventory yet."}
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
            {!loading && sortedItems.map((item) => (
              <tr
                key={item.id}
                className={`border-t border-gray-100 hover:bg-gray-50 ${
                  item.stock_status === "out_of_stock"
                    ? "border-l-4 border-l-red-400"
                    : item.stock_status === "low_stock"
                    ? "border-l-4 border-l-amber-400"
                    : ""
                }`}
              >
                <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                <td className="px-4 py-3 text-gray-600">{item.category || "-"}</td>
                <td className={`px-4 py-3 ${STOCK_STATUS_META[item.stock_status]?.text || ""}`}>
                  {item.quantity_in_stock} {item.unit}
                </td>
                <td className="px-4 py-3">{item.reorder_level}</td>
                <td className="px-4 py-3">Rs {Number(item.unit_price).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      STOCK_STATUS_META[item.stock_status]?.badge || STOCK_STATUS_META.ok.badge
                    }`}
                  >
                    {STOCK_STATUS_META[item.stock_status]?.label || "OK"}
                  </span>
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
                onChange={(e) => updateForm("name", e.target.value)}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  formErrors.name ? "border-red-400" : "border-gray-300"
                }`}
              />
              {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <input
                  value={form.category}
                  onChange={(e) => updateForm("category", e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${
                    formErrors.category ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {formErrors.category && <p className="mt-1 text-xs text-red-600">{formErrors.category}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                <input
                  value={form.unit}
                  onChange={(e) => updateForm("unit", e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${
                    formErrors.unit ? "border-red-400" : "border-gray-300"
                  }`}
                  placeholder="e.g. box, unit, ream"
                />
                {formErrors.unit && <p className="mt-1 text-xs text-red-600">{formErrors.unit}</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
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
                  max={MAX_STOCK_QUANTITY}
                  required
                  value={form.quantity_in_stock}
                  onChange={(e) => updateForm("quantity_in_stock", Number(e.target.value))}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${
                    formErrors.quantity_in_stock ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {formErrors.quantity_in_stock && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.quantity_in_stock}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reorder Level</label>
                <input
                  type="number"
                  min="0"
                  max={MAX_STOCK_QUANTITY}
                  required
                  value={form.reorder_level}
                  onChange={(e) => updateForm("reorder_level", Number(e.target.value))}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${
                    formErrors.reorder_level ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {formErrors.reorder_level && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.reorder_level}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Unit Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.unit_price}
                  onChange={(e) => updateForm("unit_price", Number(e.target.value))}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${
                    formErrors.unit_price ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {formErrors.unit_price && <p className="mt-1 text-xs text-red-600">{formErrors.unit_price}</p>}
              </div>
            </div>
            {modalStockStatus && (
              <p className="text-xs text-gray-500">
                Will show as{" "}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STOCK_STATUS_META[modalStockStatus].badge}`}
                >
                  {STOCK_STATUS_META[modalStockStatus].label}
                </span>{" "}
                at these levels.
              </p>
            )}
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

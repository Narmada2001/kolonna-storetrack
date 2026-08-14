import { useEffect, useState } from "react";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

const CARD_STYLES = [
  { key: "total_items", label: "Total Items", accent: "text-brand-600" },
  { key: "low_stock_items", label: "Low Stock Items", accent: "text-amber-600" },
  { key: "pending_requests", label: "Pending Requests", accent: "text-orange-600" },
  { key: "total_suppliers", label: "Suppliers", accent: "text-emerald-600" },
  { key: "transactions_this_month", label: "Transactions (This Month)", accent: "text-purple-600" },
];

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    client
      .get("/reports/dashboard")
      .then((res) => setStats(res.data))
      .catch(() => setError("Could not load dashboard statistics."));
  }, [isAdmin]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800">Welcome, {user?.full_name}</h2>
      <p className="text-gray-500 mt-1">
        {isAdmin
          ? "Here's an overview of the store."
          : "Use the sidebar to browse inventory and manage your item requests."}
      </p>

      {isAdmin && (
        <div className="mt-6">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {!stats && !error && <p className="text-gray-400 text-sm">Loading statistics...</p>}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {CARD_STYLES.map((card) => (
                <div key={card.key} className="rounded-lg bg-white border border-gray-200 p-5 shadow-sm">
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className={`text-3xl font-bold mt-2 ${card.accent}`}>{stats[card.key]}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

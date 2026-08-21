import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import TransactionsChart from "../components/TransactionsChart.jsx";
import MyRequestsChart from "../components/MyRequestsChart.jsx";

const REQUEST_CHART_DAYS = 30;

// Local calendar-day key (not toISOString, which forces UTC and would shift
// every bucket by a day for any non-UTC+0 timezone, e.g. Sri Lanka's +5:30).
function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildDailyRequestSeries(requests, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const counts = {};
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    counts[key] = 0;
    series.push(key);
  }

  requests.forEach((r) => {
    const key = localDateKey(new Date(r.request_date));
    if (key in counts) counts[key] += 1;
  });

  return series.map((date) => ({ date, count: counts[date] }));
}

const CARD_STYLES = [
  { key: "total_items", label: "Total Items", accent: "text-brand-600" },
  { key: "low_stock_items", label: "Low Stock Items", accent: "text-amber-600" },
  { key: "pending_requests", label: "Pending Requests", accent: "text-orange-600" },
  { key: "total_suppliers", label: "Suppliers", accent: "text-emerald-600" },
  { key: "transactions_this_month", label: "Transactions (This Month)", accent: "text-purple-600" },
];

const MY_CARD_STYLES = [
  { key: "pending", label: "Pending", accent: "text-orange-600" },
  { key: "approved", label: "Approved", accent: "text-blue-600" },
  { key: "fulfilled", label: "Fulfilled", accent: "text-emerald-600" },
  { key: "rejected", label: "Rejected", accent: "text-red-600" },
];

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  fulfilled: "bg-emerald-100 text-emerald-700",
};

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [myRequests, setMyRequests] = useState(null);
  const [timeseries, setTimeseries] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    client
      .get("/reports/dashboard")
      .then((res) => setStats(res.data))
      .catch(() => setError("Could not load dashboard statistics."));
    client
      .get("/reports/dashboard/transactions", { params: { days: 30 } })
      .then((res) => setTimeseries(res.data))
      .catch(() => {
        // non-fatal: the stat cards above still work without the chart
      });
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    client
      .get("/requests")
      .then((res) => setMyRequests(res.data))
      .catch(() => setError("Could not load your requests."));
  }, [isAdmin]);

  const myCounts = (myRequests || []).reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
    {}
  );

  const myRequestSeries = useMemo(
    () => (myRequests ? buildDailyRequestSeries(myRequests, REQUEST_CHART_DAYS) : null),
    [myRequests]
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Welcome, {user?.full_name}</h2>
          <p className="text-gray-500 mt-1">
            {isAdmin
              ? "Here's an overview of the store."
              : "Use the sidebar to browse inventory and manage your item requests."}
          </p>
        </div>
        {!isAdmin && (
          <Link
            to="/requests"
            state={{ openCreate: true }}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + New Request
          </Link>
        )}
      </div>

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
          {timeseries && (
            <div className="mt-6">
              <TransactionsChart data={timeseries} />
            </div>
          )}
        </div>
      )}

      {!isAdmin && (
        <div className="mt-6">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {!myRequests && !error && <p className="text-gray-400 text-sm">Loading your requests...</p>}
          {myRequests && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {MY_CARD_STYLES.map((card) => (
                  <div key={card.key} className="rounded-lg bg-white border border-gray-200 p-5 shadow-sm">
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className={`text-3xl font-bold mt-2 ${card.accent}`}>{myCounts[card.key] || 0}</p>
                  </div>
                ))}
              </div>

              {myRequestSeries && (
                <div className="mt-6">
                  <MyRequestsChart data={myRequestSeries} />
                </div>
              )}

              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Recent Requests</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-left text-gray-600">
                      <tr>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Requested On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myRequests.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                            You haven't made any requests yet.
                          </td>
                        </tr>
                      )}
                      {myRequests.slice(0, 5).map((r) => (
                        <tr key={r.id} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-medium text-gray-800">{r.item_name}</td>
                          <td className="px-4 py-3">{r.quantity}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[r.status]}`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(r.request_date).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

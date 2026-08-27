import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import TransactionsChart from "../components/TransactionsChart.jsx";
import MyRequestsChart from "../components/MyRequestsChart.jsx";
import { SkeletonBlock, SkeletonRows } from "../components/Skeleton.jsx";
import {
  IconClock,
  IconCheckCircle,
  IconBox,
  IconXCircle,
  IconAlertTriangle,
  IconInventory,
  IconList,
  IconPlus,
} from "../components/Icons.jsx";

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

const CARD_ICONS = {
  pending: IconClock,
  approved: IconCheckCircle,
  fulfilled: IconBox,
  rejected: IconXCircle,
};

const CARD_ICON_BG = {
  pending: "bg-orange-50 text-orange-600",
  approved: "bg-blue-50 text-blue-600",
  fulfilled: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-600",
};

const QUICK_ACTIONS = [
  {
    to: "/requests",
    state: { openCreate: true },
    label: "New Request",
    desc: "Ask for an item",
    icon: IconPlus,
    accent: "bg-brand-600 text-white hover:bg-brand-700",
  },
  {
    to: "/inventory",
    label: "Browse Inventory",
    desc: "Check what's in stock",
    icon: IconInventory,
    accent: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
  },
  {
    to: "/requests",
    label: "All My Requests",
    desc: "Track request status",
    icon: IconList,
    accent: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
  },
];

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [myRequests, setMyRequests] = useState(null);
  const [timeseries, setTimeseries] = useState(null);
  const [lowStockItems, setLowStockItems] = useState(null);

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

  function loadEmployeeData() {
    setError("");
    client
      .get("/requests")
      .then((res) => setMyRequests(res.data))
      .catch(() => setError("Could not load your requests."));
    client
      .get("/items", { params: { low_stock_only: true } })
      .then((res) => setLowStockItems(res.data))
      .catch(() => {
        // non-fatal: the rest of the dashboard still works without this widget
      });
  }

  useEffect(() => {
    if (isAdmin) return;
    loadEmployeeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const myCounts = (myRequests || []).reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
    {}
  );

  const myRequestSeries = useMemo(
    () => (myRequests ? buildDailyRequestSeries(myRequests, REQUEST_CHART_DAYS) : null),
    [myRequests]
  );

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
    []
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Welcome, {user?.full_name}</h2>
          <p className="text-gray-500 mt-1">
            {isAdmin ? "Here's an overview of the store." : todayLabel}
          </p>
        </div>
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
          {error && (
            <div className="mb-4 flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              <span>{error}</span>
              <button onClick={loadEmployeeData} className="font-medium underline hover:no-underline">
                Try again
              </button>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                state={action.state}
                className={`flex items-center gap-3 rounded-lg p-4 shadow-sm transition ${action.accent}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/5">
                  <action.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{action.label}</span>
                  <span className="block text-xs opacity-80">{action.desc}</span>
                </span>
              </Link>
            ))}
          </div>

          {!myRequests && !error && (
            <>
              <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                {MY_CARD_STYLES.map((card) => (
                  <div
                    key={card.key}
                    className="h-[92px] rounded-lg bg-white border border-gray-200 p-5 shadow-sm animate-pulse"
                  >
                    <div className="h-3 w-16 rounded bg-gray-100" />
                    <div className="mt-3 h-6 w-10 rounded bg-gray-100" />
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <SkeletonBlock className="h-4 w-40" />
                  <SkeletonBlock className="mt-4 h-[160px] w-full" />
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <SkeletonBlock className="h-4 w-24" />
                  <div className="mt-4 space-y-3">
                    <SkeletonBlock className="h-4 w-full" />
                    <SkeletonBlock className="h-4 w-full" />
                    <SkeletonBlock className="h-4 w-3/4" />
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <SkeletonBlock className="h-6 w-40 mb-3" />
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
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
                      <SkeletonRows rows={3} columns={4} />
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {myRequests && (
            <>
              <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                {MY_CARD_STYLES.map((card) => {
                  const Icon = CARD_ICONS[card.key];
                  return (
                    <div
                      key={card.key}
                      className="flex items-start gap-3 rounded-lg bg-white border border-gray-200 p-5 shadow-sm"
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${CARD_ICON_BG[card.key]}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span>
                        <p className="text-sm text-gray-500">{card.label}</p>
                        <p className={`text-3xl font-bold mt-1 ${card.accent}`}>{myCounts[card.key] || 0}</p>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {myRequestSeries && (
                  <div className="lg:col-span-2">
                    <MyRequestsChart data={myRequestSeries} />
                  </div>
                )}

                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <IconAlertTriangle className="h-4 w-4 text-amber-600" />
                    <h3 className="font-semibold text-gray-800">Running Low</h3>
                  </div>
                  {!lowStockItems && (
                    <p className="text-xs text-gray-400">Checking stock levels...</p>
                  )}
                  {lowStockItems && lowStockItems.length === 0 && (
                    <p className="text-xs text-gray-400">Everything is well stocked right now.</p>
                  )}
                  {lowStockItems && lowStockItems.length > 0 && (
                    <ul className="space-y-2.5">
                      {lowStockItems.slice(0, 5).map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-gray-700 truncate">{item.name}</span>
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            {item.quantity_in_stock} {item.unit} left
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {lowStockItems && lowStockItems.length > 0 && (
                    <Link
                      to="/inventory"
                      className="mt-4 block text-center text-xs font-medium text-brand-600 hover:underline"
                    >
                      View full inventory →
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">Recent Requests</h3>
                  <Link to="/requests" className="text-sm font-medium text-brand-600 hover:underline">
                    View all →
                  </Link>
                </div>
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
                          <td colSpan={4} className="px-4 py-10 text-center">
                            <p className="text-gray-400">You haven't made any requests yet.</p>
                            <Link
                              to="/requests"
                              state={{ openCreate: true }}
                              className="mt-3 inline-block rounded-md bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                            >
                              + New Request
                            </Link>
                          </td>
                        </tr>
                      )}
                      {myRequests.slice(0, 5).map((r) => {
                        const StatusIcon = CARD_ICONS[r.status];
                        return (
                        <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{r.item_name}</td>
                          <td className="px-4 py-3">{r.quantity}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[r.status]}`}
                            >
                              {StatusIcon && <StatusIcon className="h-3 w-3" />}
                              {r.status}
                            </span>
                            {r.admin_note && (
                              <p className="mt-1 max-w-[220px] text-xs italic text-gray-500" title={r.admin_note}>
                                “{r.admin_note}”
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(r.request_date).toLocaleString()}
                            {r.response_date && (
                              <p className="text-xs text-gray-400">
                                Updated: {new Date(r.response_date).toLocaleDateString()}
                              </p>
                            )}
                          </td>
                        </tr>
                        );
                      })}
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

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import useIdleLogout from "../hooks/useIdleLogout.js";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // auto-logout after 15 minutes of inactivity

const navItems = [
  { to: "/", label: "Dashboard", adminOnly: false },
  { to: "/inventory", label: "Inventory", adminOnly: false },
  { to: "/requests", label: "Requests", adminOnly: false },
  { to: "/suppliers", label: "Suppliers", adminOnly: true },
  { to: "/transactions", label: "Transactions", adminOnly: true },
  { to: "/reports", label: "Reports", adminOnly: true },
  { to: "/users", label: "Users", adminOnly: true },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  useIdleLogout(() => {
    logout();
    navigate("/login", { state: { reason: "idle" } });
  }, IDLE_TIMEOUT_MS);

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-brand-700 text-white flex flex-col">
        <div className="px-6 py-5 border-b border-brand-600">
          <h1 className="text-lg font-bold leading-tight">Kolonna StoreTrack</h1>
          <p className="text-xs text-brand-100 mt-1">Divisional Secretariat Store</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive ? "bg-white text-brand-700" : "text-brand-50 hover:bg-brand-600"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
        </nav>
        <div className="px-4 py-4 border-t border-brand-600 text-sm">
          <p className="font-medium">{user?.full_name}</p>
          <p className="text-brand-100 text-xs capitalize">{user?.role}</p>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-md bg-brand-600 hover:bg-brand-500 px-3 py-1.5 text-xs font-semibold"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}

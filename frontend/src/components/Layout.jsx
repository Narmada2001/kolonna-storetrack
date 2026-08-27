import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import useIdleLogout from "../hooks/useIdleLogout.js";
import { IconMenu, IconX } from "./Icons.jsx";

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
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  useIdleLogout(() => {
    logout();
    navigate("/login", { state: { reason: "idle" } });
  }, IDLE_TIMEOUT_MS);

  // Small screens use an off-canvas drawer; close it whenever the route
  // changes so tapping a nav link doesn't leave it open behind the page.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex min-h-screen">
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 transform flex-col bg-brand-700 text-white transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-2 px-6 py-5 border-b border-brand-600">
          <div>
            <h1 className="text-lg font-bold leading-tight">Kolonna StoreTrack</h1>
            <p className="text-xs text-brand-100 mt-1">Divisional Secretariat Store</p>
          </div>
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
            className="shrink-0 rounded-md p-1 text-brand-100 hover:bg-brand-600 md:hidden"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => (
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

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="shrink-0 rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
          >
            <IconMenu className="h-6 w-6" />
          </button>
          <h1 className="truncate text-sm font-semibold text-gray-800">Kolonna StoreTrack</h1>
        </div>
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

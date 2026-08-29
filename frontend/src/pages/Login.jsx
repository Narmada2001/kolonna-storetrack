import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import StoreIllustration from "../components/StoreIllustration.jsx";
import { getErrorMessage } from "../api/client.js";

const SIGN_OUT_NOTICES = {
  idle: "You were signed out after 15 minutes of inactivity.",
  expired: "Your session expired. Please log in again.",
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice] = useState(() => {
    const reason = location.state?.reason || new URLSearchParams(location.search).get("reason");
    if (reason) window.history.replaceState({}, "", location.pathname);
    return SIGN_OUT_NOTICES[reason] || "";
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err, "Login failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-brand-700">
      <div className="flex md:w-1/2 flex-col items-center justify-center px-6 md:px-12 pt-10 pb-6 md:py-12 text-white">
        <div className="max-w-xs md:max-w-sm">
          <StoreIllustration />
          <h2 className="text-xl md:text-2xl font-bold text-center mt-6 md:mt-8">Kolonna StoreTrack</h2>
          <p className="hidden md:block text-brand-100 text-center mt-2 text-sm">
            Track inventory, manage requests, and keep the Divisional Secretariat's store
            running smoothly — all in one place.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-12 pt-2 md:py-12">
        <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lg">
          <p className="text-sm text-gray-500 text-center mt-1 mb-6">
            Store Management System — Kolonna Divisional Secretariat
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder="admin@kolonna.lk"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            {notice && !error && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {notice}
              </p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

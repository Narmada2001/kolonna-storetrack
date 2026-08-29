import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("storetrack_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem("storetrack_token");
      localStorage.removeItem("storetrack_token");
      localStorage.removeItem("storetrack_user");
      if (window.location.pathname !== "/login") {
        // A full navigation (not react-router) since this runs outside React context;
        // only flag it as a rejected session if we actually had a token, not a fresh
        // visit that never logged in. Pass along the backend's specific reason (e.g.
        // "session expired" vs an invalid/tampered token) so the login page can show it.
        if (hadToken) {
          const detail = error.response?.data?.detail;
          const message = typeof detail === "string" ? detail : "Your session has ended. Please log in again.";
          window.location.href = `/login?${new URLSearchParams({ reason: message })}`;
        } else {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d) => d.msg).filter(Boolean).join(" ") || fallback;
  }
  return fallback;
}

export default client;

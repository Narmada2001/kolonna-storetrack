import { useEffect, useState } from "react";
import client from "../api/client.js";

const REPORTS = [
  { key: "inventory", label: "Inventory Report", description: "Current stock levels, reorder points and low-stock flags." },
  { key: "requests", label: "Item Requests Report", description: "All item requests with status and requester." },
  { key: "transactions", label: "Transactions Report", description: "Full log of stock received and issued." },
];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Reports() {
  const [backups, setBackups] = useState([]);
  const [backupError, setBackupError] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadBackups() {
    try {
      const res = await client.get("/admin/backups");
      setBackups(res.data);
    } catch {
      // non-fatal: the reports above still work without this
    }
  }

  useEffect(() => {
    loadBackups();
  }, []);

  async function download(reportKey, format) {
    const res = await client.get(`/reports/${reportKey}/${format}`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${reportKey}_report.${format === "excel" ? "xlsx" : "pdf"}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async function handleBackupNow() {
    setCreating(true);
    setBackupError("");
    try {
      await client.post("/admin/backups");
      await loadBackups();
    } catch (err) {
      setBackupError(err.response?.data?.detail || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Reports</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {REPORTS.map((report) => (
          <div key={report.key} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800">{report.label}</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{report.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => download(report.key, "pdf")}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Download PDF
              </button>
              <button
                onClick={() => download(report.key, "excel")}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Download Excel
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Database Backups</h3>
            <p className="text-sm text-gray-500">
              Regular backups protect against accidental data loss. Trigger one manually below, or
              schedule <code className="bg-gray-100 px-1 rounded">python -m app.backup</code> to run
              automatically — see SETUP.md.
            </p>
          </div>
          <button
            onClick={handleBackupNow}
            disabled={creating}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 shrink-0"
          >
            {creating ? "Backing up..." : "Backup Now"}
          </button>
        </div>
        {backupError && <p className="text-sm text-red-600 mb-3">{backupError}</p>}
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                    No backups yet. Click "Backup Now" to create the first one.
                  </td>
                </tr>
              )}
              {backups.map((b) => (
                <tr key={b.filename} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{b.filename}</td>
                  <td className="px-4 py-3 text-gray-600">{formatSize(b.size_bytes)}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(b.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

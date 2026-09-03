import { useEffect, useState } from "react";
import client from "../api/client.js";
import { Download, Trash2, HardDrive } from "lucide-react";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Backups() {
  const [backups, setBackups] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadBackups() {
    try {
      const res = await client.get("/admin/backups");
      setBackups(res.data);
    } catch (err) {
      setError("Failed to load backups");
    }
  }

  useEffect(() => {
    loadBackups();
  }, []);

  async function handleBackupNow() {
    setLoading(true);
    setError("");
    try {
      await client.post("/admin/backups");
      await loadBackups();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create backup");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(filename) {
    try {
      const res = await client.get(`/admin/backups/${filename}/download`, { responseType: "blob" });
      const objectUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = objectUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError("Failed to download backup");
    }
  }

  async function handleDelete(filename) {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;
    
    try {
      await client.delete(`/admin/backups/${filename}`);
      await loadBackups();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete backup");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">System Backups</h2>
        <button
          onClick={handleBackupNow}
          disabled={loading}
          className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <HardDrive size={16} />
          {loading ? "Backing up..." : "Backup Now"}
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-6 max-w-3xl">
        Regular backups protect against accidental data loss. You can trigger one manually here, or configure automated backups by running <code className="bg-gray-100 px-1 rounded">python -m app.backup</code> via cron or Task Scheduler.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">Filename</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Created Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {backups.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No backups found. Click "Backup Now" to create the first one.
                </td>
              </tr>
            )}
            {backups.map((b) => (
              <tr key={b.filename} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{b.filename}</td>
                <td className="px-4 py-3 text-gray-600">{formatSize(b.size_bytes)}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(b.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDownload(b.filename)}
                    className="text-brand-600 hover:text-brand-800 mr-4"
                    title="Download"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(b.filename)}
                    className="text-red-500 hover:text-red-700"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

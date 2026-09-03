import { useEffect, useState } from "react";
import client from "../api/client.js";
import Modal from "../components/Modal.jsx";

const REPORTS = [
  { key: "inventory", label: "Inventory Report", description: "Current stock levels, reorder points and low-stock flags." },
  { key: "requests", label: "Item Requests Report", description: "All item requests with status and requester." },
  { key: "transactions", label: "Transactions Report", description: "Full log of stock received and issued." },
];

export default function Reports() {
  const [reportConfig, setReportConfig] = useState(null);
  const [filterForm, setFilterForm] = useState({ startDate: "", endDate: "", filterVal: "all" });

  function openConfig(reportKey) {
    setReportConfig(reportKey);
    setFilterForm({ startDate: "", endDate: "", filterVal: "all" });
  }

  async function download(reportKey, format, filters) {
    let url = `/reports/${reportKey}/${format}`;
    const params = new URLSearchParams();
    if (filters.startDate) params.append("start_date", filters.startDate);
    if (filters.endDate) params.append("end_date", filters.endDate);
    if (filters.filterVal && filters.filterVal !== "all") params.append("filter_val", filters.filterVal);
    
    if (params.toString()) url += `?${params.toString()}`;

    const res = await client.get(url, { responseType: "blob" });
    const objectUrl = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = objectUrl;
    link.setAttribute("download", `${reportKey}_report.${format === "excel" ? "xlsx" : "pdf"}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
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
                onClick={() => openConfig(report.key)}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Configure & Download
              </button>
            </div>
          </div>
        ))}
      </div>

      {reportConfig && (
        <Modal title={`Configure ${REPORTS.find(r => r.key === reportConfig)?.label}`} onClose={() => setReportConfig(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filterForm.startDate}
                  onChange={(e) => setFilterForm({ ...filterForm, startDate: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={filterForm.endDate}
                  onChange={(e) => setFilterForm({ ...filterForm, endDate: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Filter</label>
              <select
                value={filterForm.filterVal}
                onChange={(e) => setFilterForm({ ...filterForm, filterVal: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                {reportConfig === "inventory" && <option value="low_stock">Low Stock Only</option>}
                {reportConfig === "requests" && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="rejected">Rejected</option>
                  </>
                )}
                {reportConfig === "transactions" && (
                  <>
                    <option value="received">Received</option>
                    <option value="issued">Issued</option>
                  </>
                )}
              </select>
            </div>

            <div className="flex gap-2 pt-4 mt-4 border-t border-gray-100">
              <button
                onClick={() => download(reportConfig, "pdf", filterForm)}
                className="flex-1 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Download PDF
              </button>
              <button
                onClick={() => download(reportConfig, "excel", filterForm)}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Download Excel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

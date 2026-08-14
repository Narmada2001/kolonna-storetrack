import client from "../api/client.js";

const REPORTS = [
  { key: "inventory", label: "Inventory Report", description: "Current stock levels, reorder points and low-stock flags." },
  { key: "requests", label: "Item Requests Report", description: "All item requests with status and requester." },
  { key: "transactions", label: "Transactions Report", description: "Full log of stock received and issued." },
];

export default function Reports() {
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
    </div>
  );
}

import { useMemo, useState } from "react";

// Validated categorical pair (dataviz skill palette, slots 1-2): passes CVD,
// contrast and lightness checks — see the skill's validate_palette.js.
const COLORS = {
  received: "#2a78d6",
  issued: "#eb6834",
};

const WIDTH = 760;
const HEIGHT = 260;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 44 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / magnitude) * magnitude;
}

function formatDate(dateStr, opts) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, opts);
}

export default function TransactionsChart({ data }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const maxValue = useMemo(
    () => niceMax(Math.max(1, ...data.map((d) => Math.max(d.received, d.issued)))),
    [data]
  );

  const xFor = (i) => (data.length <= 1 ? 0 : (i / (data.length - 1)) * PLOT_W);
  const yFor = (v) => PLOT_H - (v / maxValue) * PLOT_H;

  function pathFor(key) {
    return data.map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(d[key]).toFixed(1)}`).join(" ");
  }

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(ratio * (data.length - 1)));
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxValue * f));
  const xLabelEvery = Math.max(1, Math.ceil(data.length / 6));
  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const lastIndex = data.length - 1;

  const hoverLeftPct = hoverIndex !== null ? ((MARGIN.left + xFor(hoverIndex)) / WIDTH) * 100 : 0;
  const anchorRight = hoverLeftPct > 65;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="font-semibold text-gray-800">Stock Movement</h3>
          <p className="text-xs text-gray-500">Quantity moved per day, last {data.length} days</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: COLORS.received }} />
            Received
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: COLORS.issued }} />
            Issued
          </span>
          <button
            onClick={() => setShowTable((v) => !v)}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            {showTable ? "Show chart" : "Show as table"}
          </button>
        </div>
      </div>

      {showTable ? (
        <div className="mt-3 max-h-64 overflow-y-auto overflow-x-auto rounded-md border border-gray-100">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-left text-gray-500 sticky top-0">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Received</th>
                <th className="px-3 py-2">Issued</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 text-gray-700">{formatDate(d.date, { month: "short", day: "numeric" })}</td>
                  <td className="px-3 py-1.5 text-gray-600">{d.received}</td>
                  <td className="px-3 py-1.5 text-gray-600">{d.issued}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-2">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full h-auto"
            role="img"
            aria-label={`Stock received and issued per day, last ${data.length} days`}
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {yTicks.map((t) => (
                <g key={t}>
                  <line x1={0} x2={PLOT_W} y1={yFor(t)} y2={yFor(t)} stroke="#e1e0d9" strokeWidth="1" />
                  <text x={-8} y={yFor(t) + 3} textAnchor="end" fontSize="10" fill="#898781">
                    {t.toLocaleString()}
                  </text>
                </g>
              ))}
              <line x1={0} x2={PLOT_W} y1={PLOT_H} y2={PLOT_H} stroke="#c3c2b7" strokeWidth="1" />

              {data.map((d, i) =>
                i % xLabelEvery === 0 || i === lastIndex ? (
                  <text key={d.date} x={xFor(i)} y={PLOT_H + 18} textAnchor="middle" fontSize="10" fill="#898781">
                    {formatDate(d.date, { month: "short", day: "numeric" })}
                  </text>
                ) : null
              )}

              <path d={pathFor("received")} fill="none" stroke={COLORS.received} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <path d={pathFor("issued")} fill="none" stroke={COLORS.issued} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

              {lastIndex >= 0 && (
                <>
                  <circle cx={xFor(lastIndex)} cy={yFor(data[lastIndex].received)} r="4" fill={COLORS.received} stroke="#ffffff" strokeWidth="2" />
                  <circle cx={xFor(lastIndex)} cy={yFor(data[lastIndex].issued)} r="4" fill={COLORS.issued} stroke="#ffffff" strokeWidth="2" />
                </>
              )}

              {hovered && (
                <>
                  <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={0} y2={PLOT_H} stroke="#c3c2b7" strokeWidth="1" />
                  <circle cx={xFor(hoverIndex)} cy={yFor(hovered.received)} r="4" fill={COLORS.received} stroke="#ffffff" strokeWidth="2" />
                  <circle cx={xFor(hoverIndex)} cy={yFor(hovered.issued)} r="4" fill={COLORS.issued} stroke="#ffffff" strokeWidth="2" />
                </>
              )}

              <rect
                x={0}
                y={0}
                width={PLOT_W}
                height={PLOT_H}
                fill="transparent"
                onMouseMove={handleMove}
                onMouseLeave={() => setHoverIndex(null)}
              />
            </g>
          </svg>

          {hovered && (
            <div
              className="pointer-events-none absolute top-2 z-10 w-36 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md"
              style={{
                left: `${hoverLeftPct}%`,
                transform: anchorRight ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
              }}
            >
              <p className="font-semibold text-gray-800 mb-1">
                {formatDate(hovered.date, { weekday: "short", month: "short", day: "numeric" })}
              </p>
              <p className="flex items-center gap-1.5 text-gray-600">
                <span className="inline-block w-2.5 h-0.5" style={{ backgroundColor: COLORS.received }} />
                Received
                <span className="ml-auto font-semibold text-gray-800">{hovered.received}</span>
              </p>
              <p className="flex items-center gap-1.5 text-gray-600">
                <span className="inline-block w-2.5 h-0.5" style={{ backgroundColor: COLORS.issued }} />
                Issued
                <span className="ml-auto font-semibold text-gray-800">{hovered.issued}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

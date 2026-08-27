// Lightweight pulse placeholders used while a page's data is still loading.
// Deterministic bar widths (no randomness) so re-renders don't jitter.

const WIDTH_CYCLE = ["70%", "45%", "85%", "55%"];

export function SkeletonRows({ rows = 4, columns = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-gray-100">
          {Array.from({ length: columns }).map((__, c) => (
            <td key={c} className="px-4 py-3">
              <div
                className="h-4 animate-pulse rounded bg-gray-100"
                style={{ width: WIDTH_CYCLE[(r + c) % WIDTH_CYCLE.length] }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className}`} />;
}

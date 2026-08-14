export default function StoreIllustration() {
  return (
    <svg viewBox="0 0 480 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      <ellipse cx="240" cy="360" rx="170" ry="18" fill="#3730a3" opacity="0.35" />

      {/* Shelving unit */}
      <rect x="70" y="80" width="200" height="240" rx="6" fill="#4338ca" opacity="0.5" />
      <rect x="70" y="80" width="200" height="240" rx="6" stroke="#c7d2fe" strokeWidth="3" fill="none" />
      <line x1="70" y1="150" x2="270" y2="150" stroke="#c7d2fe" strokeWidth="3" />
      <line x1="70" y1="220" x2="270" y2="220" stroke="#c7d2fe" strokeWidth="3" />
      <line x1="70" y1="290" x2="270" y2="290" stroke="#c7d2fe" strokeWidth="3" />

      {/* Boxes on shelves */}
      <rect x="85" y="100" width="46" height="38" rx="3" fill="#fbbf24" />
      <rect x="140" y="96" width="52" height="42" rx="3" fill="#f97316" />
      <rect x="205" y="102" width="44" height="36" rx="3" fill="#fbbf24" />

      <rect x="88" y="168" width="50" height="40" rx="3" fill="#34d399" />
      <rect x="150" y="172" width="44" height="36" rx="3" fill="#fbbf24" />
      <rect x="205" y="166" width="48" height="42" rx="3" fill="#f97316" />

      <rect x="85" y="238" width="48" height="40" rx="3" fill="#f97316" />
      <rect x="145" y="242" width="52" height="36" rx="3" fill="#34d399" />
      <rect x="210" y="236" width="42" height="42" rx="3" fill="#fbbf24" />

      <rect x="90" y="298" width="46" height="20" rx="3" fill="#fbbf24" />
      <rect x="150" y="298" width="52" height="20" rx="3" fill="#f97316" />

      {/* Clipboard with checklist */}
      <g transform="translate(300,150)">
        <rect x="0" y="0" width="120" height="150" rx="10" fill="#ffffff" />
        <rect x="0" y="0" width="120" height="150" rx="10" stroke="#e0e7ff" strokeWidth="3" />
        <rect x="38" y="-10" width="44" height="20" rx="5" fill="#4f46e5" />
        <g stroke="#c7d2fe" strokeWidth="2">
          <line x1="16" y1="40" x2="104" y2="40" />
          <line x1="16" y1="66" x2="104" y2="66" />
          <line x1="16" y1="92" x2="104" y2="92" />
          <line x1="16" y1="118" x2="80" y2="118" />
        </g>
        <g fill="#34d399">
          <circle cx="24" cy="40" r="7" />
          <circle cx="24" cy="66" r="7" />
          <circle cx="24" cy="92" r="7" />
        </g>
        <path d="M21 40l2 2 4-4" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 66l2 2 4-4" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 92l2 2 4-4" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Person */}
      <g transform="translate(310,300)">
        <circle cx="20" cy="0" r="16" fill="#fcd34d" />
        <path d="M0 60c0-18 9-32 20-32s20 14 20 32" fill="#4338ca" />
      </g>
    </svg>
  );
}

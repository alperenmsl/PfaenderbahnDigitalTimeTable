export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-label="Pfänderbahn"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="pfLogoBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0A4FA8" />
          <stop offset="1" stopColor="#3B8EF0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#pfLogoBg)" />
      {/* Tragseil */}
      <path
        d="M3 9 L29 5.5"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Aufhängung */}
      <line
        x1="16"
        y1="7.2"
        x2="16"
        y2="12"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Kabine */}
      <rect x="8.5" y="12" width="15" height="11" rx="2.8" fill="#fff" />
      <rect x="11" y="14.6" width="4" height="4.2" rx="1" fill="#0A4FA8" />
      <rect x="17" y="14.6" width="4" height="4.2" rx="1" fill="#0A4FA8" />
      <rect x="8.5" y="20.6" width="15" height="2.4" rx="1.2" fill="#F59E0B" />
    </svg>
  );
}

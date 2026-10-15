export default function Magnet({ size = 24, tips = "#9AA39E", label }: { size?: number; tips?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.033)}
      viewBox="0 0 120 124"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d="M8 0 H44 V70 a16 16 0 0 0 32 0 V0 H112 V70 a52 52 0 0 1 -104 0 Z" fill="#F2A93B" />
      <rect x="8" y="0" width="36" height="22" fill={tips} />
      <rect x="76" y="0" width="36" height="22" fill={tips} />
    </svg>
  );
}

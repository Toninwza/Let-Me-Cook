import { useId } from "react";

/** `body` is one colour, or two colours to split the horseshoe left and right like the PULL logo. */
export default function Magnet({
  size = 24,
  tips = "#FFFFFF",
  body = ["#674DF1", "#FA81E9"],
  label,
}: {
  size?: number;
  tips?: string;
  body?: string | [string, string];
  label?: string;
}) {
  const gid = useId();
  const split = Array.isArray(body);
  return (
    <svg
      width={size}
      height={Math.round(size * 1.033)}
      viewBox="0 0 120 124"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {split && (
        <defs>
          <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0.5" stopColor={body[0]} />
            <stop offset="0.5" stopColor={body[1]} />
          </linearGradient>
        </defs>
      )}
      <path d="M8 0 H44 V70 a16 16 0 0 0 32 0 V0 H112 V70 a52 52 0 0 1 -104 0 Z" fill={split ? `url(#${gid})` : body} />
      <rect x="8" y="0" width="36" height="22" fill={tips} />
      <rect x="76" y="0" width="36" height="22" fill={tips} />
    </svg>
  );
}

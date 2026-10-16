const TINTS = [
  ["#E4DDFB", "#3B2A99"],
  ["#FBD9F6", "#7A1F6C"],
  ["#DDE0F7", "#262E7A"],
  ["#F6E1FA", "#6B2A7A"],
  ["#EFEAF5", "#3D4170"],
];

function tintFor(key: string) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

export default function ProductThumb({
  imageUrl,
  category,
  className = "",
}: {
  imageUrl: string | null;
  category: string;
  className?: string;
}) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className={`object-cover ${className}`} />;
  }
  const [bg, fg] = tintFor(category);
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center font-display text-sm font-extrabold tracking-wide ${className}`}
      style={{ background: bg, color: fg }}
    >
      {category}
    </div>
  );
}

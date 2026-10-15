const TINTS = [
  ["#E7D7B8", "#4A3510"],
  ["#CFE3D8", "#14513A"],
  ["#DDE4F0", "#24365A"],
  ["#F3D9D2", "#7A2E1E"],
  ["#EDE7DA", "#3A433E"],
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

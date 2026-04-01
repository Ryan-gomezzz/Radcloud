/**
 * Brand mark — served from `public/images/logo.png`.
 */
export function ProductLogo({
  className = "",
  heightClass = "h-9",
  decorative = false,
}) {
  return (
    <img
      src="/images/logo.png"
      alt={decorative ? "" : "RADCloud"}
      role={decorative ? "presentation" : undefined}
      className={`w-auto max-w-[220px] object-contain object-left ${heightClass} ${className}`}
      decoding="async"
    />
  );
}

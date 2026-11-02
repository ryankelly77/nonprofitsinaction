/*
 * The mark: a calendar page whose filled dots are booked days. A stand-in
 * until the real logo file is dropped into public/brand/ and used here.
 */
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="0" y="0" width="40" height="40" rx="10" fill="#0E5650" />
      <rect x="8" y="9" width="24" height="3" rx="1.5" fill="#FFFFFF" />
      <circle cx="13" cy="20" r="3" fill="#F4A62A" />
      <circle cx="20" cy="20" r="3" fill="#FFFFFF" />
      <circle cx="27" cy="20" r="3" fill="#FFFFFF" />
      <circle cx="13" cy="28" r="3" fill="#FFFFFF" />
      <circle cx="20" cy="28" r="3" fill="#F4A62A" />
      <circle cx="27" cy="28" r="3" fill="#FFFFFF" opacity="0.45" />
    </svg>
  );
}

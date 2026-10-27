// The DocuChat mark: a geometric "D" with an accent dot. Same shape as
// web/public/favicon.svg, but themed via CSS variables.
export function LogoMark({ size = 30 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="logo-bg" />
      <path d="M11 8.5h4.75a7.5 7.5 0 0 1 0 15H11z" fill="none" className="logo-d" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="24.5" cy="7.5" r="2.5" className="logo-dot" />
    </svg>
  );
}

export default function Logo({ size, showName = true }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      {showName && <span className="logo-name">DocuChat</span>}
    </span>
  );
}

/** Small ES mark shown beside "Source:" lines, so readers recognise where the numbers come from. */
export function SourceMark() {
  return (
    <svg className="fp-source-mark" viewBox="0 0 36 36" width="18" height="18" aria-hidden="true" focusable="false">
      <rect width="36" height="36" rx="10" fill="var(--es-blue-600)" />
      <path d="M6 19h6l3-7 5 13 3-6h7" fill="none" stroke="var(--es-on-brand)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

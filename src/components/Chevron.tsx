/**
 * The EssentiallySports chevron (same path as es-frontend/components/icons/chevron.tsx).
 * Use it for every directional cue: links that go somewhere, breadcrumbs, "next".
 * Decorative: the link or button text carries the meaning.
 */
const ROTATE = { right: 0, down: 90, left: 180, up: 270 } as const;

export function Chevron({ direction = "right", className }: { direction?: keyof typeof ROTATE; className?: string }) {
  return (
    <svg
      className={`fp-chevron${className ? ` ${className}` : ""}`}
      viewBox="0 0 6 10"
      aria-hidden="true"
      focusable="false"
      style={ROTATE[direction] ? { transform: `rotate(${ROTATE[direction]}deg)` } : undefined}
    >
      <path d="M0.171875 8.77057L1.11468 9.71338L5.82875 4.99935L1.1147 0.2853L0.171894 1.22811L3.94312 4.99933L0.171875 8.77057Z" fill="currentColor" />
    </svg>
  );
}

import estilos from "../page.module.css";

/** Vapor decorativo sobre la taza del hero; se anima solo con CSS y se detiene con prefers-reduced-motion. */
export function Vapor() {
  return (
    <svg className={estilos.vapor} viewBox="0 0 120 90" aria-hidden="true" focusable="false">
      <path d="M30 86c-12-14 12-22 0-38s10-24 0-40" />
      <path d="M60 86c-12-14 12-22 0-38s10-24 0-40" />
      <path d="M90 86c-12-14 12-22 0-38s10-24 0-40" />
    </svg>
  );
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import estilos from "../page.module.css";

/**
 * Hace aparecer su contenido al entrar en pantalla. Sin JavaScript, sin IntersectionObserver o con
 * prefers-reduced-motion el contenido se muestra tal cual: solo se oculta lo que aún no se ve.
 */
export function Aparecer({ children, retraso = 0 }: { children: ReactNode; retraso?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.dataset.aparecer = "pendiente";
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          el.dataset.aparecer = "visible";
          observador.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={ref} className={estilos.aparecer} style={{ transitionDelay: `${retraso}ms` }}>
      {children}
    </div>
  );
}

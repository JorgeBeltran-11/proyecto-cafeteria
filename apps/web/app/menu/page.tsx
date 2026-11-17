import type { Metadata } from "next";
import Link from "next/link";
import { Carta } from "./carta";

export const metadata: Metadata = {
  title: "Menú · Proyecto cafetería",
  description: "Productos de la cafetería con precio, alérgenos y disponibilidad.",
};

export default function PaginaMenu() {
  return (
    <main>
      <p>
        <Link href="/">Volver al inicio</Link>
      </p>
      <Carta />
    </main>
  );
}

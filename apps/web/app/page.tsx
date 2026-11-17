import Link from "next/link";
import { HealthStatus } from "./health-status";

export default function Home() {
  return (
    <main>
      <h1>Proyecto cafetería</h1>
      <HealthStatus />
      <ul className="enlaces-inicio">
        <li>
          <Link href="/menu">Ver el menú</Link>
        </li>
        <li>
          <Link href="/carrito">Ir a tu carrito</Link>
        </li>
        <li>
          <Link href="/personal/disponibilidad">Personal: disponibilidad del día</Link>
        </li>
      </ul>
    </main>
  );
}

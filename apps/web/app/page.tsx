import Link from "next/link";
import { HealthStatus } from "./health-status";

export default function Home() {
  return (
    <main>
      <h1>Proyecto cafetería</h1>
      <HealthStatus />
      <p>
        <Link href="/carrito">Ir a tu carrito</Link>
      </p>
    </main>
  );
}

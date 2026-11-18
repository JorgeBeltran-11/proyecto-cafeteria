import estilos from "../page.module.css";
import { CAFES, dolares } from "./datos";

/** Cafés que se muestran en "Destacados de hoy", tomados de la carta estática de /cafes. */
const IDS_DESTACADOS = ["capuchino", "latte", "mocaccino"] as const;

const DESTACADOS = IDS_DESTACADOS.flatMap((id) => CAFES.filter((c) => c.id === id));

export function Destacados() {
  return (
    <ul className={estilos.rejillaProductos}>
      {DESTACADOS.map((c) => (
        <li key={c.id} className={estilos.producto}>
          <div className={estilos.productoIlustracion}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.imagen} alt={c.alt} width={240} height={200} loading="lazy" />
          </div>
          <div className={estilos.productoTexto}>
            <h3 className={estilos.productoNombre}>{c.nombre}</h3>
            <p className={estilos.productoDescripcion}>{c.descripcion}</p>
            <p className={estilos.productoPrecio}>
              <span className={estilos.soloLector}>Precio: </span>
              {dolares(c.precioCentavos)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

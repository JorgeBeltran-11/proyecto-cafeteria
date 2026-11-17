/**
 * Reglas de publicación de un menú (FR-004, FR-005). Funciones puras.
 */
import type {
  BorradorMenu,
  ContenidoVersion,
  ProductoActual,
  ProductoEnVersion,
} from './contenido';
import { textoHorario } from './horario';

/** Dinero para textos de auditoría: 275 → "$2,75". Solo enteros (constitución VI). */
export function textoDinero(centavos: number): string {
  const enteros = Math.floor(centavos / 100);
  const resto = String(centavos % 100).padStart(2, '0');
  return `$${enteros},${resto}`;
}

/**
 * Lo que impide publicar el borrador, en frases que dicen cómo corregirlo.
 * Lista vacía = se puede publicar.
 */
export function problemasParaPublicar(
  borrador: BorradorMenu,
  productos: ReadonlyMap<string, ProductoActual>,
): string[] {
  const problemas: string[] = [];
  if (borrador.nombre.trim() === '') {
    problemas.push('El menú no tiene nombre: escribe uno.');
  }
  const total = borrador.categorias.reduce((n, c) => n + c.productoIds.length, 0);
  if (total === 0) {
    problemas.push('El menú no tiene productos: añade al menos uno a una categoría.');
  }

  const revisados = new Set<string>();
  for (const categoria of borrador.categorias) {
    const enCategoria = new Set<string>();
    for (const id of categoria.productoIds) {
      if (enCategoria.has(id)) {
        problemas.push(
          `El producto "${id}" está repetido en la categoría "${categoria.nombre}": déjalo una sola vez.`,
        );
      }
      enCategoria.add(id);
      if (revisados.has(id)) continue;
      revisados.add(id);

      const p = productos.get(id);
      if (!p) {
        problemas.push(`El producto "${id}" no existe: créalo o quítalo del menú.`);
        continue;
      }
      if (p.retirado) {
        problemas.push(`"${p.nombre}" está retirado: reactívalo o quítalo del menú.`);
      }
      if (!p.imagenUrl) {
        problemas.push(`"${p.nombre}" no tiene imagen: añade una con su texto alternativo.`);
      }
      if (!p.imagenAlt || p.imagenAlt.trim() === '') {
        problemas.push(
          `"${p.nombre}" no tiene texto alternativo en la imagen: describe la imagen en imagenAlt.`,
        );
      }
      if (p.alergenos === null) {
        problemas.push(
          `"${p.nombre}" no tiene alérgenos declarados: indica sus alérgenos o una lista vacía si no tiene.`,
        );
      }
    }
  }
  return problemas;
}

/** Copia del borrador con los datos actuales de cada producto. Requiere un borrador publicable. */
export function armarContenido(
  borrador: BorradorMenu,
  productos: ReadonlyMap<string, ProductoActual>,
): ContenidoVersion {
  return {
    nombre: borrador.nombre.trim(),
    horario: borrador.horario,
    categorias: borrador.categorias.map((c) => ({
      nombre: c.nombre,
      productos: c.productoIds.map((id): ProductoEnVersion => {
        const p = productos.get(id);
        if (!p) throw new Error(`Producto ${id} inexistente al armar la versión`);
        return {
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precioCentavos: p.precioCentavos,
          imagenUrl: p.imagenUrl,
          imagenAlt: p.imagenAlt,
          alergenos: p.alergenos ?? [],
        };
      }),
    })),
  };
}

function productosPorId(contenido: ContenidoVersion): Map<string, ProductoEnVersion> {
  const mapa = new Map<string, ProductoEnVersion>();
  for (const c of contenido.categorias) {
    for (const p of c.productos) {
      if (!mapa.has(p.id)) mapa.set(p.id, p);
    }
  }
  return mapa;
}

function mismaLista(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Resumen legible de lo que cambia `nuevo` respecto a `anterior` (FR-005, US3-4). */
export function resumirCambios(
  anterior: ContenidoVersion | null,
  nuevo: ContenidoVersion,
): string[] {
  if (anterior === null) return ['Primera publicación.'];
  const cambios: string[] = [];

  if (anterior.nombre !== nuevo.nombre) {
    cambios.push(`Nombre: "${anterior.nombre}" → "${nuevo.nombre}".`);
  }
  const horarioAntes = textoHorario(anterior.horario);
  const horarioAhora = textoHorario(nuevo.horario);
  if (horarioAntes !== horarioAhora) {
    cambios.push(`Horario: ${horarioAntes} → ${horarioAhora}.`);
  }

  const categoriasAntes = anterior.categorias.map((c) => c.nombre);
  const categoriasAhora = nuevo.categorias.map((c) => c.nombre);
  for (const nombre of categoriasAhora) {
    if (!categoriasAntes.includes(nombre)) cambios.push(`Categoría añadida: ${nombre}.`);
  }
  for (const nombre of categoriasAntes) {
    if (!categoriasAhora.includes(nombre)) cambios.push(`Categoría quitada: ${nombre}.`);
  }

  const antes = productosPorId(anterior);
  const ahora = productosPorId(nuevo);
  for (const [id, p] of ahora) {
    const previo = antes.get(id);
    if (!previo) {
      cambios.push(`Producto añadido: ${p.nombre} (${textoDinero(p.precioCentavos)}).`);
      continue;
    }
    if (previo.precioCentavos !== p.precioCentavos) {
      cambios.push(
        `Precio de ${p.nombre}: ${textoDinero(previo.precioCentavos)} → ${textoDinero(p.precioCentavos)}.`,
      );
    }
    if (previo.nombre !== p.nombre) {
      cambios.push(`Producto renombrado: "${previo.nombre}" → "${p.nombre}".`);
    }
    if (previo.descripcion !== p.descripcion) {
      cambios.push(`Descripción de ${p.nombre} actualizada.`);
    }
    if (previo.imagenUrl !== p.imagenUrl || previo.imagenAlt !== p.imagenAlt) {
      cambios.push(`Imagen de ${p.nombre} actualizada.`);
    }
    if (!mismaLista([...previo.alergenos].sort(), [...p.alergenos].sort())) {
      cambios.push(`Alérgenos de ${p.nombre} actualizados.`);
    }
  }
  for (const [id, p] of antes) {
    if (!ahora.has(id)) cambios.push(`Producto quitado: ${p.nombre}.`);
  }

  return cambios.length > 0 ? cambios : ['Sin cambios de contenido.'];
}

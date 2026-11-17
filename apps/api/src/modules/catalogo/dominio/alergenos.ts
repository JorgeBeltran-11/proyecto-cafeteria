import type { Alergeno, AlergenoVista } from '@cafeteria/shared';

/**
 * Lista cerrada de alérgenos de declaración obligatoria (data-model.md, "Alérgenos").
 * PENDIENTE: validarla contra el reglamento de etiquetado vigente en Ecuador.
 */
export const ALERGENOS: readonly AlergenoVista[] = [
  { codigo: 'gluten', nombre: 'Gluten' },
  { codigo: 'crustaceos', nombre: 'Crustáceos' },
  { codigo: 'huevo', nombre: 'Huevo' },
  { codigo: 'pescado', nombre: 'Pescado' },
  { codigo: 'mani', nombre: 'Maní' },
  { codigo: 'soya', nombre: 'Soya' },
  { codigo: 'leche', nombre: 'Leche' },
  { codigo: 'frutos_de_cascara', nombre: 'Frutos de cáscara' },
  { codigo: 'apio', nombre: 'Apio' },
  { codigo: 'mostaza', nombre: 'Mostaza' },
  { codigo: 'sesamo', nombre: 'Sésamo' },
  { codigo: 'sulfitos', nombre: 'Sulfitos' },
  { codigo: 'altramuces', nombre: 'Altramuces' },
  { codigo: 'moluscos', nombre: 'Moluscos' },
];

const CODIGOS = new Set<string>(ALERGENOS.map((a) => a.codigo));

export function esAlergeno(valor: unknown): valor is Alergeno {
  return typeof valor === 'string' && CODIGOS.has(valor);
}

/** Devuelve los alérgenos con su nombre, en el orden de la lista oficial. */
export function vistaAlergenos(codigos: readonly Alergeno[]): AlergenoVista[] {
  const presentes = new Set(codigos);
  return ALERGENOS.filter((a) => presentes.has(a.codigo));
}

/**
 * Horarios de los menús (research R6). Funciones puras: reciben el momento como parámetro.
 * La cafetería usa la hora de Ecuador continental (UTC−5, sin horario de verano).
 */
import type { DiaSemana, FranjaHoraria, Horario } from '@cafeteria/shared';

export const DESFASE_LOCAL_MINUTOS = -5 * 60;

const NOMBRE_DIA: Record<DiaSemana, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
  7: 'domingo',
};

/** "07:30" → 450. No valida: el formato lo comprueba validacion.ts. */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** Día de la semana (1 = lunes) y minuto del día en hora local. */
export function horaLocal(ahora: Date): { dia: DiaSemana; minuto: number } {
  const local = new Date(ahora.getTime() + DESFASE_LOCAL_MINUTOS * 60_000);
  const domingoCero = local.getUTCDay();
  const dia = (domingoCero === 0 ? 7 : domingoCero) as DiaSemana;
  return { dia, minuto: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

function franjaActiva(franja: FranjaHoraria, dia: DiaSemana, minuto: number): boolean {
  return (
    franja.dias.includes(dia) &&
    minuto >= aMinutos(franja.desde) &&
    minuto < aMinutos(franja.hasta)
  );
}

/** true si el menú está disponible en el momento `ahora`. Sin horario = siempre. */
export function estaEnHorario(horario: Horario, ahora: Date): boolean {
  if (horario === null) return true;
  const { dia, minuto } = horaLocal(ahora);
  return horario.some((f) => franjaActiva(f, dia, minuto));
}

function siguienteDia(dia: DiaSemana, salto: number): DiaSemana {
  return ((((dia - 1 + salto) % 7) + 7) % 7 + 1) as DiaSemana;
}

/**
 * Próxima apertura en texto ("Hoy a las 07:00", "Mañana a las 07:00", "El lunes a las 07:00"),
 * o null si ya está abierto o no tiene franjas.
 */
export function proximaApertura(horario: Horario, ahora: Date): string | null {
  if (horario === null || estaEnHorario(horario, ahora)) return null;
  const { dia, minuto } = horaLocal(ahora);

  for (let salto = 0; salto <= 7; salto++) {
    const diaBuscado = siguienteDia(dia, salto);
    const inicios = horario
      .filter((f) => f.dias.includes(diaBuscado))
      .map((f) => aMinutos(f.desde))
      .filter((inicio) => salto > 0 || inicio > minuto)
      .sort((a, b) => a - b);
    if (inicios.length === 0) continue;

    const hora = formatoHora(inicios[0]);
    if (salto === 0) return `Hoy a las ${hora}`;
    if (salto === 1) return `Mañana a las ${hora}`;
    return `El ${NOMBRE_DIA[diaBuscado]} a las ${hora}`;
  }
  return null;
}

function formatoHora(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "lunes a viernes", "sábado y domingo", "todos los días", "lunes, miércoles y viernes". */
export function textoDias(dias: readonly DiaSemana[]): string {
  const ordenados = [...new Set(dias)].sort((a, b) => a - b);
  if (ordenados.length === 7) return 'todos los días';
  const consecutivos = ordenados.every(
    (d, i) => i === 0 || d === ordenados[i - 1] + 1,
  );
  if (consecutivos && ordenados.length >= 3) {
    return `${NOMBRE_DIA[ordenados[0]]} a ${NOMBRE_DIA[ordenados[ordenados.length - 1]]}`;
  }
  const nombres = ordenados.map((d) => NOMBRE_DIA[d]);
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** Horario legible: "Todos los días de 07:00 a 11:00; sábado de 08:00 a 12:00". */
export function textoHorario(horario: Horario): string {
  if (horario === null || horario.length === 0) return 'Disponible a cualquier hora';
  const partes = horario.map(
    (f) => `${textoDias(f.dias)} de ${f.desde} a ${f.hasta}`,
  );
  const texto = partes.join('; ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

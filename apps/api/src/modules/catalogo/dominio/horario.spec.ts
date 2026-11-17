import type { Horario } from '@cafeteria/shared';
import {
  estaEnHorario,
  horaLocal,
  proximaApertura,
  textoDias,
  textoHorario,
} from './horario';

/** Hora local de Ecuador (UTC−5) → Date. 2026-11-16 es lunes. */
function local(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00-05:00`);
}

const DESAYUNO: Horario = [{ dias: [1, 2, 3, 4, 5], desde: '07:00', hasta: '11:00' }];

describe('horario de los menús', () => {
  it('calcula el día y la hora local en UTC−5', () => {
    // 02:00 UTC del martes = 21:00 del lunes en Ecuador.
    expect(horaLocal(new Date('2026-11-17T02:00:00Z'))).toEqual({
      dia: 1,
      minuto: 21 * 60,
    });
  });

  it('sin horario está siempre disponible', () => {
    expect(estaEnHorario(null, local('2026-11-16', '03:00'))).toBe(true);
    expect(proximaApertura(null, local('2026-11-16', '03:00'))).toBeNull();
  });

  it('dentro de la franja está disponible; el final de la franja ya no', () => {
    expect(estaEnHorario(DESAYUNO, local('2026-11-16', '07:00'))).toBe(true);
    expect(estaEnHorario(DESAYUNO, local('2026-11-16', '10:59'))).toBe(true);
    expect(estaEnHorario(DESAYUNO, local('2026-11-16', '11:00'))).toBe(false);
    expect(estaEnHorario(DESAYUNO, local('2026-11-16', '06:59'))).toBe(false);
  });

  it('respeta los días de la semana', () => {
    // 2026-11-21 es sábado.
    expect(estaEnHorario(DESAYUNO, local('2026-11-21', '08:00'))).toBe(false);
  });

  it('próxima apertura: hoy, mañana u otro día', () => {
    expect(proximaApertura(DESAYUNO, local('2026-11-16', '06:00'))).toBe('Hoy a las 07:00');
    expect(proximaApertura(DESAYUNO, local('2026-11-16', '12:00'))).toBe('Mañana a las 07:00');
    // Viernes por la tarde → el lunes.
    expect(proximaApertura(DESAYUNO, local('2026-11-20', '15:00'))).toBe('El lunes a las 07:00');
    expect(proximaApertura(DESAYUNO, local('2026-11-16', '08:00'))).toBeNull();
  });

  it('elige la franja más temprana del día', () => {
    const dosFranjas: Horario = [
      { dias: [2], desde: '15:00', hasta: '18:00' },
      { dias: [2], desde: '08:00', hasta: '10:00' },
    ];
    expect(proximaApertura(dosFranjas, local('2026-11-16', '20:00'))).toBe('Mañana a las 08:00');
  });

  it('escribe los días de forma legible', () => {
    expect(textoDias([1, 2, 3, 4, 5])).toBe('lunes a viernes');
    expect(textoDias([6, 7])).toBe('sábado y domingo');
    expect(textoDias([1, 3, 5])).toBe('lunes, miércoles y viernes');
    expect(textoDias([1, 2, 3, 4, 5, 6, 7])).toBe('todos los días');
    expect(textoDias([4])).toBe('jueves');
  });

  it('escribe el horario completo', () => {
    expect(textoHorario(DESAYUNO)).toBe('Lunes a viernes de 07:00 a 11:00');
    expect(textoHorario(null)).toBe('Disponible a cualquier hora');
  });
});

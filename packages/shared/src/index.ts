// Tipos compartidos entre apps/api y apps/web (spec 001, data-model.md).

export type ComponentStatus = 'ok' | 'error';

export interface HealthResponse {
  /** 'ok' solo si todos los componentes están 'ok'. */
  status: ComponentStatus;
  /** Si la API responde, siempre 'ok'. */
  api: ComponentStatus;
  database: ComponentStatus;
  /** Momento de la comprobación, ISO 8601 en UTC. */
  checkedAt: string;
}

// Modelo del centro de notificaciones (toasts unificados).
// El shell arma una cola con todas las fuentes (logros, bots desbloqueados,
// solicitudes de amistad, invitaciones) y muestra un solo toast a la vez.

export type ToastVariant = 'neutral' | 'primary' | 'danger';

/** Botón de acción dentro de un toast. */
export interface ToastAction {
  label: string;
  variant: ToastVariant;
  run: () => void;
}

/** Vista de un toast, agnóstica de su fuente. */
export interface ToastVM {
  /** Identidad estable para `track` y animaciones (no se repite entre fuentes). */
  key: string;
  title: string;
  body: string;
  /** Botones de la fila inferior. Los informativos traen un único "Cerrar". */
  actions: ToastAction[];
  /** Si está presente, se muestra una "×" para descartar sin accionar. */
  onClose?: () => void;
}

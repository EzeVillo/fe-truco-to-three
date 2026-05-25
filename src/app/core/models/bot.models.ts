// Modelos de bots — feature 003-lobby-bots
// Fuente: specs/003-lobby-bots/data-model.md §Bot

export interface BotPersonality {
  /** 1–100. Tendencia a bluffear (cantar truco/envido con mano débil). */
  mentiroso: number;
  /** 1–100. Espera que el rival cante envido primero. */
  pescador: number;
  /** 1–100. Velocidad para escalar apuestas (retruco, vale cuatro). */
  temerario: number;
  /** 1–100. Agresividad al cantar envido. */
  envidoso: number;
  /** 1–100. Reserva cartas fuertes para manos posteriores. */
  aguantador: number;
}

export interface Bot {
  /** UUID provisto por el BE. Único en el catálogo. */
  botId: string;
  /** Nombre legible para mostrar en la tarjeta. */
  name: string;
  /** Vector de personalidad. Opcional para futuras UI; no se renderiza en esta feature. */
  personality?: BotPersonality;
}

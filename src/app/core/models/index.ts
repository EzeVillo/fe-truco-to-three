// Modelos de dominio del juego de Truco

export interface Player {
  id: string;
  username: string;
  avatarUrl?: string;
}

export interface Room {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: 2 | 4 | 6;
  status: 'waiting' | 'playing' | 'finished';
}

export interface AuthResponse {
  token: string;
  username: string;
}

export interface ApiError {
  message: string;
  status: number;
  timestamp: string;
}

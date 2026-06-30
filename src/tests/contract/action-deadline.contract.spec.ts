/**
 * Contract test — Temporizador de turno (§4.14, §4.18, §9.5, §9.6)
 *
 * Verifica la paridad entre los tipos TS del temporizador y lo documentado en
 * docs/CONTRATOS_API.md: campos del plazo en el snapshot, eventos derivados
 * ACTION_DEADLINE_SET / ACTION_DEADLINE_CLEARED y la forma de sus payloads.
 *
 * Feature 013-turn-timer.
 */
import { describe, it, expect } from 'vitest';
import type {
  MatchDerivedEventType,
  ActionDeadlineSetPayload,
} from '../../app/features/match/models/match-ws-events';
import type { RoundState } from '../../app/core/models/match.models';
import { readContrato } from './_docs';

function getContract(): string {
  return readContrato('02-matches.md');
}

// Compile-time shape check del payload de ACTION_DEADLINE_SET.
const _setCheck = {
  seat: 'PLAYER_ONE' as const,
  actionDeadline: 1_772_768_188_123,
  turnDurationMillis: 30_000,
} satisfies ActionDeadlineSetPayload;
void _setCheck;

// Compile-time: los tipos de evento del temporizador existen en el union derivado.
const _setType: MatchDerivedEventType = 'ACTION_DEADLINE_SET';
const _clearedType: MatchDerivedEventType = 'ACTION_DEADLINE_CLEARED';
void _setType;
void _clearedType;

// Compile-time: RoundState expone los tres campos del plazo.
const _roundDeadlineCheck: Pick<
  RoundState,
  'actionDeadline' | 'turnDurationMillis' | 'actionDeadlineSeat'
> = {
  actionDeadline: null,
  turnDurationMillis: null,
  actionDeadlineSeat: null,
};
void _roundDeadlineCheck;

describe('Contract: temporizador de turno (013-turn-timer)', () => {
  const content = getContract();

  it('§9.5/§9.6 documenta ACTION_DEADLINE_SET y ACTION_DEADLINE_CLEARED', () => {
    expect(content).toContain('ACTION_DEADLINE_SET');
    expect(content).toContain('ACTION_DEADLINE_CLEARED');
  });

  it('§4.14/§4.18 documenta los campos del plazo en el snapshot', () => {
    expect(content).toContain('actionDeadline');
    expect(content).toContain('turnDurationMillis');
    expect(content).toContain('actionDeadlineSeat');
  });

  it('§9.6 ACTION_DEADLINE_SET payload tiene seat, actionDeadline, turnDurationMillis', () => {
    const keys = Object.keys(_setCheck).sort();
    expect(keys).toEqual(['actionDeadline', 'seat', 'turnDurationMillis']);
  });

  it('los eventos del temporizador son derivados (no transaccionales): el doc aclara stateVersion null', () => {
    // La subsección dedicada del contrato indica que viajan por /user/queue/match
    // pero no avanzan stateVersion.
    expect(content).toMatch(/ACTION_DEADLINE_SET[\s\S]*stateVersion/);
  });
});

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import type { MatchState } from '../../../../core/models/match.models';
import type { OnInit } from '@angular/core';
import { deriveMatchView } from '../../utils/derive-match-view';
import type { MatchView } from '../../utils/derive-match-view';
import { getFixture, type FixtureKey } from '../../mocks';
import { GameBoardComponent } from '../../components/game-board/game-board.component';
import { MockActionsStateSwitcherComponent } from '../../components/mock-actions-state-switcher/mock-actions-state-switcher.component';
import { MockEnvidoResultSwitcherComponent, type EnvidoResultMockKey } from '../../components/mock-envido-result-switcher/mock-envido-result-switcher.component';
import { EnvidoResultDialogComponent } from '../../components/envido-result-dialog/envido-result-dialog.component';
import {
  mockEnvidoResultWinAsMano,
  mockEnvidoResultLoseAsPie,
  mockEnvidoResultWinAsPie,
  mockEnvidoResultLoseAsMano,
} from '../../mocks/envido-result.mocks';
import { MockRoundWonSwitcherComponent, type RoundWonMockKey } from '../../components/mock-round-won-switcher/mock-round-won-switcher.component';
import { RoundWonDialogComponent } from '../../components/round-won-dialog/round-won-dialog.component';
import {
  mockRoundWonFirstRound,
  mockRoundWonTieSeries,
  mockRoundWonDecisive,
  mockRoundWonSingleRound,
  mockRoundLostDecisive,
} from '../../mocks/round-won.mocks';

@Component({
  selector: 'app-match-screen',
  standalone: true,
  imports: [CommonModule, GameBoardComponent, MockActionsStateSwitcherComponent, MockEnvidoResultSwitcherComponent, MockRoundWonSwitcherComponent],
  templateUrl: './match-screen.component.html',
  styleUrl: './match-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchScreenComponent implements OnInit {
  readonly matchState = signal<MatchState | null>(null);
  readonly matchView = signal<MatchView | null>(null);
  readonly matchId = signal<string>('');

  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  ngOnInit(): void {
    const matchId = this.route.snapshot.paramMap.get('matchId') ?? '';
    this.matchId.set(matchId);

    const fixtureKey = this.route.snapshot.queryParamMap.get('fixture');
    const state = getFixture(fixtureKey);
    this.setState(state);
  }

  onFixtureSelected(key: FixtureKey): void {
    const state = getFixture(key);
    this.setState(state);
  }

  onEnvidoResultMockSelected(key: EnvidoResultMockKey): void {
    const data = (() => {
      switch (key) {
        case 'envido-win-mano':
          return mockEnvidoResultWinAsMano;
        case 'envido-lose-pie':
          return mockEnvidoResultLoseAsPie;
        case 'envido-win-pie':
          return mockEnvidoResultWinAsPie;
        case 'envido-lose-mano':
          return mockEnvidoResultLoseAsMano;
      }
    })();

    this.dialog.open<EnvidoResultDialogComponent, unknown, void>(EnvidoResultDialogComponent, {
      data,
      panelClass: 't3-envido-result-dialog',
      backdropClass: 't3-envido-result-backdrop',
    });
  }

  onRoundWonMockSelected(key: RoundWonMockKey): void {
    const data = (() => {
      switch (key) {
        case 'round-won-first':
          return mockRoundWonFirstRound;
        case 'round-won-tie':
          return mockRoundWonTieSeries;
        case 'round-won-decisive':
          return mockRoundWonDecisive;
        case 'round-won-single':
          return mockRoundWonSingleRound;
        case 'round-lost-decisive':
          return mockRoundLostDecisive;
      }
    })();

    this.dialog.open<RoundWonDialogComponent, unknown, void>(RoundWonDialogComponent, {
      data,
      panelClass: 't3-round-won-dialog',
      backdropClass: 't3-round-won-backdrop',
    });
  }

  private setState(state: MatchState): void {
    this.matchState.set(state);
    this.matchView.set(deriveMatchView(state));
  }
}

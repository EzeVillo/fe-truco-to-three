import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import type { MatchState } from '../../../../core/models/match.models';
import type { OnInit } from '@angular/core';
import { deriveMatchView } from '../../utils/derive-match-view';
import type { MatchView } from '../../utils/derive-match-view';
import { getFixture, type FixtureKey } from '../../mocks';
import { GameBoardComponent } from '../../components/game-board/game-board.component';
import { MockActionsStateSwitcherComponent } from '../../components/mock-actions-state-switcher/mock-actions-state-switcher.component';

@Component({
  selector: 'app-match-screen',
  standalone: true,
  imports: [CommonModule, GameBoardComponent, MockActionsStateSwitcherComponent],
  templateUrl: './match-screen.component.html',
  styleUrl: './match-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchScreenComponent implements OnInit {
  readonly matchState = signal<MatchState | null>(null);
  readonly matchView = signal<MatchView | null>(null);
  readonly matchId = signal<string>('');

  private readonly route = inject(ActivatedRoute);

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

  private setState(state: MatchState): void {
    this.matchState.set(state);
    this.matchView.set(deriveMatchView(state));
  }
}

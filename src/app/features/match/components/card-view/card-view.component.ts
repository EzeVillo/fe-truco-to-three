import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Card } from '../../../../core/models/match.models';

@Component({
  selector: 'app-card-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (card) {
      <img
        class="card-view__image"
        [src]="cardImageUrl"
        [alt]="cardAltText"
        decoding="sync"
        fetchpriority="high"
      />
    } @else {
      <img
        class="card-view__image card-view__image--hidden"
        src="/cards/dorso.webp"
        alt="Carta boca abajo"
        decoding="sync"
      />
    }
  `,
  styleUrl: './card-view.component.scss',
})
export class CardViewComponent {
  @Input() card: Card | null = null;

  get cardImageUrl(): string {
    if (!this.card) {
      return '/cards/dorso.webp';
    }
    const suitLower = this.card.suit.toLowerCase();
    return `/cards/${this.card.number}_${suitLower}.webp`;
  }

  get cardAltText(): string {
    if (!this.card) {
      return 'Carta boca abajo';
    }
    const suitLabels: Record<string, string> = {
      ESPADA: 'Espada',
      BASTO: 'Basto',
      COPA: 'Copa',
      ORO: 'Oro',
    };
    return `${this.card.number} de ${suitLabels[this.card.suit] ?? this.card.suit}`;
  }
}

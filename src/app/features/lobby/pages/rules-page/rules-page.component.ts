import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { RulesSectionComponent } from '../../components/rules-section/rules-section.component';
import { BackButtonComponent } from '../../../../shared/components/back-button';
import { AuthStore } from '../../../../core/auth/auth.store';

@Component({
  selector: 'app-rules-page',
  standalone: true,
  imports: [RulesSectionComponent, BackButtonComponent, RouterLink],
  templateUrl: './rules-page.component.html',
  styleUrl: './rules-page.component.scss',
})
export class RulesPageComponent {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);

  readonly isAuthenticated = this.auth.isAuthenticated;

  constructor() {
    inject(Title).setTitle('Reglas — Truco a 3');
  }

  goBack(): void {
    const navState = window.history.state as { navigationId?: number } | null;
    if ((navState?.navigationId ?? 0) > 1) {
      this.location.back();
    } else {
      void this.router.navigateByUrl(this.auth.isAuthenticated() ? '/lobby' : '/');
    }
  }
}

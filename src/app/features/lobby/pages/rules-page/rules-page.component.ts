import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
  RouterLink,
} from '@angular/router';
import { Title } from '@angular/platform-browser';
import { RulesSectionComponent } from '../../components/rules-section/rules-section.component';
import { GuestCtaComponent } from '../../../auth/components/guest-cta/guest-cta.component';
import { BackButtonComponent } from '../../../../shared/components/back-button';
import { AuthStore } from '../../../../core/auth/auth.store';
import { NavPendingDirective } from '../../../../shared/directives/nav-pending.directive';
import { NavigationLockService } from '../../../../core/services/navigation-lock.service';

@Component({
  selector: 'app-rules-page',
  standalone: true,
  imports: [
    RulesSectionComponent,
    GuestCtaComponent,
    BackButtonComponent,
    RouterLink,
    NavPendingDirective,
  ],
  templateUrl: './rules-page.component.html',
  styleUrl: './rules-page.component.scss',
})
export class RulesPageComponent {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly navigationLock = inject(NavigationLockService);

  readonly isAuthenticated = this.auth.isAuthenticated;
  /** Hay una navegación en vuelo (link del footer o el propio "Volver"): bloquea el back. */
  readonly navLocked = this.navigationLock.locked;

  constructor() {
    inject(Title).setTitle('Reglas — Truco a 3');

    // Volver dispara una navegación que no pasa por appNavPending, así que el lock
    // compartido se limpia acá en cualquier desenlace (cubre también el caso
    // autenticado, donde el footer con los links appNavPending no se renderiza).
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError ||
        event instanceof NavigationSkipped
      ) {
        this.navigationLock.set(false);
      }
    });
    inject(DestroyRef).onDestroy(() => this.navigationLock.set(false));
  }

  goBack(): void {
    if (this.navLocked()) {
      return;
    }
    this.navigationLock.set(true);
    const navState = window.history.state as { navigationId?: number } | null;
    if ((navState?.navigationId ?? 0) > 1) {
      this.location.back();
    } else {
      void this.router.navigateByUrl(this.auth.isAuthenticated() ? '/lobby' : '/');
    }
  }
}

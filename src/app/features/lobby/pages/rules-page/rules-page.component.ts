import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RulesSectionComponent } from '../../components/rules-section/rules-section.component';
import { BackButtonComponent } from '../../../../shared/components/back-button';

@Component({
  selector: 'app-rules-page',
  standalone: true,
  imports: [RulesSectionComponent, BackButtonComponent],
  templateUrl: './rules-page.component.html',
  styleUrl: './rules-page.component.scss',
})
export class RulesPageComponent {
  private readonly router = inject(Router);

  goBackToLobby(): void {
    void this.router.navigateByUrl('/lobby');
  }
}

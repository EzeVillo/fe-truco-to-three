import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { GuestCtaComponent } from '../../../auth/components/guest-cta/guest-cta.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, GuestCtaComponent],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent {
  constructor() {
    inject(Title).setTitle('Truco a 3 — La variante de punto exacto');
  }
}

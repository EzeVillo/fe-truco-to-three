import { Component } from '@angular/core';
import { VARIANT_RULE_SECTIONS } from '../../models/variant-rules';

@Component({
  selector: 'app-rules-section',
  standalone: true,
  imports: [],
  templateUrl: './rules-section.component.html',
  styleUrl: './rules-section.component.scss',
})
export class RulesSectionComponent {
  protected readonly sections = VARIANT_RULE_SECTIONS;
}

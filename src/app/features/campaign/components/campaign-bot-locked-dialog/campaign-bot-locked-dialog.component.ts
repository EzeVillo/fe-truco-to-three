import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-campaign-bot-locked-dialog',
  standalone: true,
  imports: [MatDialogModule, MatIconModule],
  templateUrl: './campaign-bot-locked-dialog.component.html',
  styleUrl: './campaign-bot-locked-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignBotLockedDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<CampaignBotLockedDialogComponent, void>>(MatDialogRef);

  close(): void {
    this.dialogRef.close();
  }
}

import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { GithubDetailsService } from '../../services/github-details.service';

@Component({
  selector: 'app-item-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatCardModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.type }} #{{ data.identifier }}
      <button mat-icon-button class="close-button" (click)="close()">
        <mat-icon>close</mat-icon>
      </button>
    </h2>

    <mat-dialog-content>
      <div *ngIf="loading" class="loading-container">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <div *ngIf="!loading" class="details-container">
        <mat-card>
          <mat-card-content>
            <div class="detail-row">
              <span class="label">Title:</span>
              <span class="value">{{ details.title }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Status:</span>
              <span class="status-badge" [class]="details.state">
                {{ details.state }}
              </span>
            </div>
            <div class="detail-row">
              <span class="label">Created by:</span>
              <div class="user-info">
                <img
                  [src]="details.user.avatar_url"
                  [alt]="details.user.login"
                  class="avatar"
                />
                <a [href]="details.user.html_url" target="_blank">
                  {{ details.user.login }}
                </a>
              </div>
            </div>
            <mat-divider></mat-divider>
            <div class="description">
              <h3>Description</h3>
              <p>{{ details.body }}</p>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </mat-dialog-content>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 800px;
        max-width: 90vw;
      }

      .loading-container {
        display: flex;
        justify-content: center;
        padding: 2rem;
      }

      .detail-row {
        display: flex;
        align-items: center;
        margin-bottom: 1rem;
      }

      .label {
        font-weight: 500;
        min-width: 120px;
      }

      .status-badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;

        &.open {
          background-color: #28a745;
          color: white;
        }

        &.closed {
          background-color: #cb2431;
          color: white;
        }
      }

      .user-info {
        display: flex;
        align-items: center;
        gap: 8px;

        .avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
        }
      }

      .description {
        margin-top: 1rem;
      }
    `,
  ],
})
export class ItemDetailsDialogComponent {
  loading = true;
  details: any;

  constructor(
    private dialogRef: MatDialogRef<ItemDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private githubDetailsService: GithubDetailsService
  ) {}

  ngOnInit() {
    // Load data based on the item type and ID
    this.loadItemDetails();
  }

  private loadItemDetails() {
    this.loading = true;

    let request$;
    switch (this.data.type) {
      case 'Issue':
        request$ = this.githubDetailsService.getIssueDetails(
          this.data.owner,
          this.data.repo,
          this.data.identifier
        );
        break;
      case 'PR':
        request$ = this.githubDetailsService.getPRDetails(
          this.data.owner,
          this.data.repo,
          this.data.identifier
        );
        break;
      case 'Commit':
        request$ = this.githubDetailsService.getCommitDetails(
          this.data.owner,
          this.data.repo,
          this.data.identifier
        );
        break;
      default:
        this.loading = false;
        return;
    }

    request$.subscribe({
      next: (response: { details: any }) => {
        this.details = response.details;
        this.loading = false;
      },
      error: (error: Error) => {
        console.error('Error loading details:', error);
        this.loading = false;
        // Show error message
      },
    });
  }

  close() {
    this.dialogRef.close();
  }
}

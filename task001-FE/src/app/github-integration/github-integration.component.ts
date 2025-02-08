import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Observable, timer, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface IntegrationStatus {
  isConnected: boolean;
  connectionDate: string | null;
  userData: {
    id: string;
    username: string;
    email: string;
    avatarUrl: string;
    profile: string;
  } | null;
}

@Component({
  selector: 'app-github-integration',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
  ],
  templateUrl: './github-integration.component.html',
  styleUrls: ['./github-integration.component.scss'],
})
export class GithubIntegrationComponent implements OnInit, OnDestroy {
  private apiUrl = 'http://localhost:3000/api';
  status$!: Observable<IntegrationStatus>;
  private statusSubscription?: Subscription;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    // Check status immediately and then every 5 seconds
    this.status$ = timer(0, 5000).pipe(
      switchMap(() =>
        this.http.get<IntegrationStatus>(
          `${this.apiUrl}/auth/status`,
          { withCredentials: true } // Important: This enables sending cookies
        )
      )
    );

    // Subscribe to handle errors
    this.statusSubscription = this.status$.subscribe({
      error: (error) => console.error('Status check error:', error),
    });
  }

  ngOnDestroy() {
    this.statusSubscription?.unsubscribe();
  }

  checkStatus() {
    this.status$ = this.http.get<IntegrationStatus>(
      `${this.apiUrl}/auth/status`,
      { withCredentials: true }
    );
  }

  connectGithub() {
    window.location.href = `${this.apiUrl}/auth/github`;
  }

  removeIntegration() {
    this.http
      .delete(`${this.apiUrl}/auth/integration`, { withCredentials: true })
      .subscribe({
        next: () => {
          this.checkStatus();
        },
        error: (error) => console.error('Error removing integration:', error),
      });
  }
}

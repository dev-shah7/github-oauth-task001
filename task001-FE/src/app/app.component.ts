import { Component, OnInit, OnDestroy } from '@angular/core';
// import { RouterOutlet } from '@angular/router';
// import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ModuleRegistry } from 'ag-grid-community';
import { ClientSideRowModelModule } from 'ag-grid-community';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Observable, timer, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Register AG Grid modules
// ModuleRegistry.registerModules([ClientSideRowModelModule]);

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
  selector: 'app-root',
  standalone: true,
  imports: [
    // RouterOutlet,
    MatButtonModule,
    MatIconModule,
    HttpClientModule,
    MatCardModule,
    CommonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  private apiUrl = 'http://localhost:3000/api';
  status$!: Observable<IntegrationStatus>;
  private statusSubscription?: Subscription;
  title = 'Task 001';

  rowData = [
    { make: 'Tesla', model: 'Model Y', price: 64950, electric: true },
    { make: 'Ford', model: 'F-Series', price: 33850, electric: false },
    { make: 'Toyota', model: 'Corolla', price: 29600, electric: false },
  ];

  // Column Definitions: Defines the columns to be displayed.
  colDefs: ColDef[] = [
    { field: 'make' },
    { field: 'model' },
    { field: 'price' },
    { field: 'electric' },
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    // Check status immediately and then every 5 seconds
    this.status$ = timer(0, 5000).pipe(
      switchMap(() =>
        this.http.get<IntegrationStatus>(`${this.apiUrl}/auth/status`, {
          withCredentials: true,
        })
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

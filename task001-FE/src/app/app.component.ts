import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
// import { RouterOutlet } from '@angular/router';
// import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  ModuleRegistry,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-community';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Observable, timer, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GithubService } from './services/github.service';

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

interface Collection {
  name: string;
  displayName: string;
}

interface Integration {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    HttpClientModule,
    MatCardModule,
    CommonModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    AgGridModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [
    trigger('transitionMessages', [
      state(
        'void',
        style({
          opacity: 0,
          transform: 'translateY(-10px)',
        })
      ),
      state(
        '*',
        style({
          opacity: 1,
          transform: 'translateY(0)',
        })
      ),
      transition(':enter', [animate('300ms ease-in')]),
      transition(':leave', [animate('300ms ease-out')]),
    ]),
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  private apiUrl = 'http://localhost:3000/api';
  status$!: Observable<IntegrationStatus>;
  private statusSubscription?: Subscription;
  title = 'GitHub Integration';

  integrations: Integration[] = [];
  selectedIntegration: string = '';
  collections: Collection[] = [];

  selectedCollection: string = '';
  searchText: string = '';
  private gridApi!: GridApi;
  columnDefs: ColDef[] = [];
  rowData: any[] = [];
  defaultColDef: ColDef = {
    flex: 1,
    minWidth: 100,
    filter: true,
    sortable: true,
    resizable: true,
  };

  isSyncing = false;

  constructor(
    private http: HttpClient,
    private githubService: GithubService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.loadIntegrations();
    this.status$ = timer(0, 5000).pipe(
      switchMap(() =>
        this.http.get<IntegrationStatus>(`${this.apiUrl}/auth/status`, {
          withCredentials: true,
        })
      )
    );

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

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    if (this.selectedCollection) {
      this.loadCollectionData();
    }
  }

  onCollectionChange() {
    this.loadCollectionData();
  }

  onSearchChange() {
    this.gridApi.setGridOption('quickFilterText', this.searchText);
  }

  private loadCollectionData() {
    const endpoint =
      this.selectedCollection === 'organizations'
        ? `${this.apiUrl}/integrations/github/organizations`
        : `${this.apiUrl}/${this.selectedIntegration}/${this.selectedCollection}`;

    this.http.get<any[]>(endpoint).subscribe({
      next: (data) => {
        if (data.length > 0) {
          this.columnDefs = Object.keys(data[0]).map((key) => ({
            field: key,
            headerName: this.formatHeaderName(key),
            filter: true,
            sortable: true,
          }));
          this.rowData = data;
        } else {
          this.columnDefs = [];
          this.rowData = [];
        }
      },
      error: (error) =>
        console.error(`Error loading ${this.selectedCollection}:`, error),
    });
  }

  private formatHeaderName(key: string): string {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private loadIntegrations() {
    this.http.get<Integration[]>(`${this.apiUrl}/integrations`).subscribe({
      next: (integrations) => {
        this.integrations = integrations;
        if (integrations.length > 0) {
          this.selectedIntegration = integrations[0].id;
          this.loadCollections(this.selectedIntegration);
        }
      },
      error: (error) => console.error('Error loading integrations:', error),
    });
  }

  onIntegrationChange() {
    this.loadCollections(this.selectedIntegration);
    this.selectedCollection = '';
    this.rowData = [];
  }

  private loadCollections(integrationId: string) {
    if (integrationId === 'github') {
      this.collections = [
        { name: 'organizations', displayName: 'Organizations' },
        { name: 'repositories', displayName: 'Repositories' },
        { name: 'commits', displayName: 'Commits' },
        { name: 'pulls', displayName: 'Pull Requests' },
        { name: 'issues', displayName: 'Issues' },
        { name: 'changelogs', displayName: 'Changelogs' },
        { name: 'users', displayName: 'Users' },
      ];
    }
  }

  syncData() {
    if (this.isSyncing) return;

    this.isSyncing = true;
    this.snackBar.open('Starting data sync...', 'Close', { duration: 3000 });

    this.githubService.syncAllData().subscribe({
      next: (response) => {
        console.log('Sync response:', response);

        // Create success message
        const successMsg = `Sync completed!\nSynced ${
          response.repositories.personal + response.repositories.organizational
        } repositories\nTotals: ${
          response.syncedData.totals.commits
        } commits, ${response.syncedData.totals.pulls} PRs, ${
          response.syncedData.totals.issues
        } issues`;

        // If there are errors, show them in a separate snackbar
        if (response.errors?.length > 0) {
          setTimeout(() => {
            this.snackBar.open(
              `Warnings:\n${response.errors.join('\n')}`,
              'Close',
              { duration: 10000 }
            );
          }, 1000);
        }

        // Show success message
        this.snackBar.open(successMsg, 'Close', { duration: 5000 });
        this.isSyncing = false;
      },
      error: (error) => {
        console.error('Sync error:', error);
        this.snackBar.open('Error syncing data. Please try again.', 'Close', {
          duration: 5000,
        });
        this.isSyncing = false;
      },
    });
  }
}

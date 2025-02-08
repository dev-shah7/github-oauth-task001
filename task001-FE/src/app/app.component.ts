import { Component, OnInit, OnDestroy } from '@angular/core';
// import { RouterOutlet } from '@angular/router';
// import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  ModuleRegistry,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-community';
import { ClientSideRowModelModule } from 'ag-grid-community';
import { MatButtonModule } from '@angular/material/button';
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
    // RouterOutlet,
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
})
export class AppComponent implements OnInit, OnDestroy {
  private apiUrl = 'http://localhost:3000/api';
  status$!: Observable<IntegrationStatus>;
  private statusSubscription?: Subscription;
  title = 'Task 001';

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

  constructor(private http: HttpClient) {}

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
    this.http
      .get<any[]>(
        `${this.apiUrl}/${this.selectedIntegration}/${this.selectedCollection}`
      )
      .subscribe({
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
    // Add more integration types here
  }
}

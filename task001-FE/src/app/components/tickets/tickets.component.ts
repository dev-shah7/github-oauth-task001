import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AgGridModule } from 'ag-grid-angular';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ClientSideRowModelModule,
  ColDef,
  ModuleRegistry,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule,
  QuickFilterModule,
  ExternalFilterModule,
  GridOptions,
  PaginationModule,
} from 'ag-grid-community';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule,
  QuickFilterModule,
  ExternalFilterModule,
  PaginationModule,
]);

interface Ticket {
  ticketId: string;
  user: {
    name: string;
    id: number | string;
  };
  date: string;
  summary: string;
  description: string;
  message: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  closed_at: string;
  closed_by: {
    login: string;
    id: number;
  };
  state: string;
}

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [
    CommonModule,
    AgGridModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    FormsModule,
  ],
  templateUrl: './tickets.component.html',
  styleUrls: ['./tickets.component.scss']
})
export class TicketsComponent implements OnInit {
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;

  searchText: string = '';
  private searchSubject = new Subject<string>();
  rowData: Ticket[] = [];
  error: string | null = null;
  loading = false;

  columnDefs: ColDef[] = [
    { 
      field: 'ticketId', 
      headerName: 'Ticket ID',
      sortable: true,
      filter: true,
      floatingFilter: true,
    },
    { 
      field: 'user.name', 
      headerName: 'User',
      sortable: true,
      filter: true,
      floatingFilter: true,
    },
    { 
      field: 'date', 
      headerName: 'Date',
      sortable: true,
      filter: true,
      floatingFilter: true,
      valueFormatter: (params) => {
        return params.value ? new Date(params.value).toLocaleDateString() : '';
      }
    },
    { 
      field: 'summary', 
      headerName: 'Summary',
      sortable: true,
      filter: true,
      floatingFilter: true,
    },
    { 
      field: 'description', 
      headerName: 'Description',
      sortable: true,
      filter: true,
      floatingFilter: true,
    },
    { 
      field: 'message', 
      headerName: 'Message',
      sortable: true,
      filter: true,
      floatingFilter: true,
    }
  ];

  defaultColDef: ColDef = {
    flex: 1,
    minWidth: 100,
    resizable: true,
    filterParams: {
      buttons: ['reset', 'apply'],
      closeOnApply: true,
    }
  };

  currentPage = 1;
  pageSize = 10;
  totalRecords = 0;
  canGoNext = true;
  canGoPrevious = false;
  isLoading = false;

  gridOptions: GridOptions = {
    pagination: true,
    paginationPageSize: this.pageSize,
    cacheBlockSize: this.pageSize,
    domLayout: 'autoHeight',
    suppressPaginationPanel: true,
    onGridReady: (params) => {
      this.gridApi = params.api;
    },
  };

  private gridApi: any = null;

  owner: string | null = null;
  repo: string | null = null;
  issueNumber: number | null = null;

  constructor(private http: HttpClient) {

    const urlParams = new URLSearchParams(window.location.search);
    this.owner = urlParams.get('owner');
    this.repo = urlParams.get('repo');
    this.issueNumber = urlParams.get('issueNumber') ? parseInt(urlParams.get('issueNumber')!, 10) : null;
  }

  ngOnInit(): void {
    this.setupSearch();
    
    if (this.owner && this.repo && this.issueNumber) {
      this.loadGitHubIssue();
    } else {
      this.loadTickets();
    }
  }

  private setupSearch(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((searchText) => {
        if (this.gridApi) {
          this.gridApi.setQuickFilterText(searchText);
        }
      });
  }

  onSearchChange(value: string) {
    this.searchText = value;
    this.searchSubject.next(value);
  }

  clearSearch() {
    this.searchText = '';
    this.searchSubject.next('');
  }

  openFindUserGrid() {
    window.open('/find-user', '_blank');
  }

  private loadTickets(): void {
    this.loading = true;
    this.error = null;

    if (this.gridApi) {
      this.gridApi.showLoadingOverlay();
    }

    const payload = {
      page: this.currentPage,
      pageSize: this.pageSize,
    };

    this.http.get<Ticket[]>(`${environment.apiUrl}/tickets`).subscribe({
      next: (data) => {
        this.rowData = data;
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', data);
          if (this.searchText) {
            this.gridApi.setQuickFilterText(this.searchText);
          }
          this.gridApi.hideOverlay();
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading tickets:', err);
        this.error = 'Failed to load tickets';
        this.loading = false;
        if (this.gridApi) {
          this.gridApi.hideOverlay();
        }
      }
    });
  }

  goToNextPage() {
    if (this.isLoading || !this.canGoNext) return;
    this.currentPage++;
    this.loadTickets();
  }

  goToPreviousPage() {
    if (this.isLoading || !this.canGoPrevious) return;
    this.currentPage--;
    this.loadTickets();
  }

  onPageSizeChange(newPageSize: number) {
    this.currentPage = 1;
    this.pageSize = newPageSize;
    this.loadTickets();
  }

  private flattenObject(obj: any, prefix = ''): { [key: string]: any } {
    const flattened: { [key: string]: any } = {};

    Object.keys(obj || {}).forEach((key) => {
      const value = obj[key];
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    });

    return flattened;
  }

  private loadGitHubIssue(): void {
    this.loading = true;
    this.error = null;

    if (this.gridApi) {
      this.gridApi.showLoadingOverlay();
    }

    const endpoint = `https://api.github.com/repos/${this.owner}/${this.repo}/issues/${this.issueNumber}`;

    const headers = {
      'accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    this.http.get<GitHubIssue>(endpoint, { 
      headers: headers,
    }).subscribe({
      next: (issue) => {
        const gridData: Ticket[] = [{
          ticketId: `#${issue.number}`,
          user: {
            name: issue.closed_by?.login || 'Not closed',
            id: issue.closed_by?.id || ''
          },
          date: issue.closed_at || '',
          summary: issue.title,
          description: issue.body,
          message: `State: ${issue.state}`
        }];

        this.rowData = gridData;
        
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', gridData);
          if (this.searchText) {
            this.gridApi.setQuickFilterText(this.searchText);
          }
          this.gridApi.hideOverlay();
        }
        
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching issue:', err);
        this.error = 'Failed to load GitHub issue details';
        this.loading = false;
        if (this.gridApi) {
          this.gridApi.hideOverlay();
        }
      }
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('findUser', (() => {}) as EventListener);
  }
}

import { Component, OnInit } from '@angular/core';
import { ColDef, ModuleRegistry, GridApi } from 'ag-grid-community';
import { HttpClient } from '@angular/common/http';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule, NgClass, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientSideRowModelModule, PaginationModule } from 'ag-grid-community';
import { environment } from '../../../environments/environment';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, finalize } from 'rxjs/operators';
import { throwError } from 'rxjs';

// Register required AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule, PaginationModule]);

interface RelationshipsResponse {
  repository: {
    name: string;
    fullName: string;
    description: string;
    updatedAt: string;
  };
  relationships: {
    commits: {
      data: any[];
      totalCount: number;
    };
    pullRequests: {
      data: any[];
      totalCount: number;
    };
    issues: {
      data: any[];
      totalCount: number;
    };
  };
  pagination: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
  };
}

interface FilterState {
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  status: string[];
  type: string[];
}

@Component({
  selector: 'detail-cell',
  template: `
    <div class="detail-grid">
      <div class="detail-row" *ngFor="let item of detailData">
        <div class="detail-label">{{ item.label }}:</div>
        <div class="detail-value" [ngClass]="{ 'json-value': item.isJson }">
          {{ item.value }}
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .detail-grid {
        padding: 20px;
        display: grid;
        gap: 10px;
      }
      .detail-row {
        display: grid;
        grid-template-columns: 200px 1fr;
        gap: 20px;
      }
      .detail-label {
        font-weight: bold;
        color: #666;
      }
      .detail-value {
        word-break: break-word;
      }
      .json-value {
        font-family: monospace;
        white-space: pre-wrap;
      }
    `,
  ],
  standalone: true,
  imports: [CommonModule, NgClass, NgFor],
})
export class DetailCellRendererComponent {
  detailData: any[] = [];

  agInit(params: any): void {
    const data = params.data;
    this.detailData = this.formatDetailData(data);
  }

  private formatDetailData(data: any): any[] {
    const details = data.details;
    const type = data.type;

    switch (type) {
      case 'Commit':
        return [
          { label: 'Full Hash', value: details.sha },
          { label: 'Author Name', value: details.commit.author.name },
          { label: 'Author Email', value: details.commit.author.email },
          { label: 'Committer Name', value: details.commit.committer.name },
          { label: 'Committer Email', value: details.commit.committer.email },
          { label: 'Full Message', value: details.commit.message },
          { label: 'Tree', value: details.commit.tree.sha },
          {
            label: 'Parents',
            value: JSON.stringify(details.parents),
            isJson: true,
          },
        ];
      case 'PR':
        return [
          { label: 'Number', value: details.number },
          { label: 'State', value: details.state },
          { label: 'Title', value: details.title },
          { label: 'Body', value: details.body },
          {
            label: 'Created At',
            value: new Date(details.createdAt).toLocaleString(),
          },
          {
            label: 'Updated At',
            value: new Date(details.updatedAt).toLocaleString(),
          },
          {
            label: 'Merged At',
            value: details.mergedAt
              ? new Date(details.mergedAt).toLocaleString()
              : 'Not merged',
          },
          {
            label: 'Labels',
            value: JSON.stringify(details.labels),
            isJson: true,
          },
          {
            label: 'Assignees',
            value: JSON.stringify(details.assignees),
            isJson: true,
          },
        ];
      case 'Issue':
        return [
          { label: 'Number', value: details.number },
          { label: 'State', value: details.state },
          { label: 'Title', value: details.title },
          { label: 'Body', value: details.body },
          {
            label: 'Created At',
            value: new Date(details.createdAt).toLocaleString(),
          },
          {
            label: 'Updated At',
            value: new Date(details.updatedAt).toLocaleString(),
          },
          {
            label: 'Closed At',
            value: details.closedAt
              ? new Date(details.closedAt).toLocaleString()
              : 'Not closed',
          },
          {
            label: 'Labels',
            value: JSON.stringify(details.labels),
            isJson: true,
          },
          {
            label: 'Assignees',
            value: JSON.stringify(details.assignees),
            isJson: true,
          },
          { label: 'Comments', value: details.comments },
        ];
      default:
        return [];
    }
  }
}

@Component({
  selector: 'app-repository-relationships',
  standalone: true,
  imports: [
    CommonModule,
    AgGridModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './repository-relationships.component.html',
  styleUrls: ['./repository-relationships.component.scss'],
})
export class RepositoryRelationshipsComponent implements OnInit {
  private gridApi!: GridApi;
  searchText: string = '';
  combinedData: any[] = [];
  repositoryInfo: {
    name: string;
    fullName: string;
    description: string;
    updatedAt: string;
  } | null = null;

  // Grid configurations
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    autoHeight: true,
    getQuickFilterText: (params) => {
      // Handle special cases for cells with custom renderers
      if (params.colDef.field === 'type' || params.colDef.field === 'state') {
        return params.value;
      }
      if (params.colDef.field === 'identifier') {
        return params.data.type === 'Commit'
          ? params.value
          : '#' + params.value;
      }
      if (params.colDef.field === 'title' && params.data.labels) {
        const labelText = params.data.labels
          .map((label: any) => label.name)
          .join(' ');
        return `${params.value} ${labelText}`;
      }
      if (params.colDef.field === 'date') {
        return params.value ? new Date(params.value).toLocaleString() : '';
      }
      return params.value;
    },
  };

  gridOptions = {
    masterDetail: true,
    detailRowHeight: 400,
    detailCellRenderer: DetailCellRendererComponent,
    components: {
      detailCellRenderer: DetailCellRendererComponent,
    },
    quickFilterText: '',
    enableCellTextSelection: true,
    ensureDomOrder: true,
  };

  columnDefs: ColDef[] = [
    {
      headerName: '',
      field: 'expand',
      cellRenderer: 'agGroupCellRenderer',
      width: 50,
    },
    {
      headerName: 'Type',
      field: 'type',
      width: 100,
      filter: 'agSetColumnFilter',
      cellRenderer: (params: any) => {
        const type = params.value;
        return `<span class="badge badge-${type.toLowerCase()}">${type}</span>`;
      },
    },
    {
      headerName: 'ID/Hash',
      field: 'identifier',
      width: 120,
      cellRenderer: (params: any) => {
        const data = params.data;
        return `<a class="link-cell" href="${data.html_url}" target="_blank">${
          data.type === 'Commit'
            ? data.identifier.substring(0, 7)
            : '#' + data.identifier
        }</a>`;
      },
    },
    {
      headerName: 'Title/Message',
      field: 'title',
      flex: 1,
      cellRenderer: (params: any) => {
        const data = params.data;
        if (data.type === 'Issue' || data.type === 'PR') {
          return `
            <div class="title-cell">
              <span>${params.value}</span>
              ${
                data.labels
                  ?.map(
                    (label: any) =>
                      `<span class="badge" style="background-color: #${label.color}">${label.name}</span>`
                  )
                  .join('') || ''
              }
            </div>`;
        }
        return params.value;
      },
    },
    {
      headerName: 'Author',
      field: 'author',
      width: 180,
      cellRenderer: (params: any) => {
        const data = params.data;
        const avatarUrl = data.authorAvatar;
        const authorName = params.value;

        return `
          <div class="author-cell">
            ${
              avatarUrl ? `<img src="${avatarUrl}" alt="" class="avatar"/>` : ''
            }
            <span class="author-name">${authorName || ''}</span>
          </div>
        `;
      },
    },
    {
      headerName: 'State',
      field: 'state',
      width: 120,
      cellRenderer: (params: any) => {
        return params.value
          ? `<span class="badge badge-${params.value.toLowerCase()}">${
              params.value
            }</span>`
          : '';
      },
    },
    {
      headerName: 'Date',
      field: 'date',
      width: 150,
      sort: 'desc',
      valueFormatter: (params) =>
        params.value ? new Date(params.value).toLocaleString() : '',
    },
  ];

  filters: FilterState = {
    dateRange: {
      start: null,
      end: null,
    },
    status: [],
    type: [],
  };

  statusOptions = ['open', 'closed', 'merged'];
  typeOptions = ['Commit', 'PR', 'Issue'];

  // Add loading and error state properties
  isLoading = false;
  error: { title: string; message: string } | null = null;

  constructor(private http: HttpClient, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.loadRelationships();
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onSearchChange(value: string) {
    this.searchText = value;
    if (this.gridApi) {
      this.gridApi.setGridOption('quickFilterText', value);
    }
  }

  loadRelationships() {
    this.isLoading = true;
    this.error = null;

    const owner = 'dev-shahh';
    const repo = 'analytics';

    const queryParams = new URLSearchParams({
      owner,
      repo,
      page: '1',
      pageSize: '100',
    });

    // Add filters to query params
    if (this.filters.dateRange.start) {
      queryParams.append(
        'startDate',
        this.filters.dateRange.start.toISOString()
      );
    }
    if (this.filters.dateRange.end) {
      queryParams.append('endDate', this.filters.dateRange.end.toISOString());
    }
    if (this.filters.status.length > 0) {
      queryParams.append('state', this.filters.status.join(','));
    }

    this.http
      .get<RelationshipsResponse>(
        `${environment.apiUrl}/integrations/repository/relationships?${queryParams}`,
        { withCredentials: true }
      )
      .pipe(
        catchError((error) => {
          console.error('Error loading relationships:', error);
          if (error.status === 401) {
            this.error = {
              title: 'Authentication Error',
              message: 'Please log in to access this data.',
            };
          } else if (error.status === 404) {
            this.error = {
              title: 'Not Found',
              message: 'The requested repository data could not be found.',
            };
          } else {
            this.error = {
              title: 'Error Loading Data',
              message: 'Failed to load repository data. Please try again.',
            };
          }
          return throwError(() => error);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (response) => {
          this.repositoryInfo = response.repository;
          let transformedData = [
            ...response.relationships.commits.data.map((commit) => ({
              type: 'Commit',
              identifier: commit.sha,
              title: commit.commit.message,
              author: commit.commit.author.name,
              authorAvatar: commit.author?.avatar_url,
              date: commit.commit.author.date,
              html_url: commit.html_url,
              details: commit,
            })),
            ...response.relationships.pullRequests.data.map((pr) => ({
              type: 'PR',
              identifier: pr.number,
              title: pr.title,
              author: pr.user.login,
              authorAvatar: pr.user.avatar_url,
              state: pr.state,
              date: pr.createdAt,
              html_url: pr.html_url,
              details: pr,
            })),
            ...response.relationships.issues.data.map((issue) => ({
              type: 'Issue',
              identifier: issue.number,
              title: issue.title,
              author: issue.user.login,
              authorAvatar: issue.user.avatar_url,
              state: issue.state,
              date: issue.createdAt,
              labels: issue.labels,
              html_url: issue.html_url,
              details: issue,
            })),
          ];

          // Apply type filter if selected
          if (this.filters.type.length > 0) {
            transformedData = transformedData.filter((item) =>
              this.filters.type.includes(item.type)
            );
          }

          this.combinedData = transformedData;

          // Show success message
          this.snackBar.open('Data loaded successfully', 'Close', {
            duration: 3000,
          });
        },
      });
  }

  // Add retry method
  retryLoad() {
    this.loadRelationships();
  }

  // Add method to handle grid size changes
  onGridSizeChanged(params: any) {
    if (this.gridApi) {
      // Fit columns on screen size change
      this.gridApi.sizeColumnsToFit();
    }
  }

  // Add new methods for filter handling
  onDateRangeChange() {
    this.loadRelationships();
  }

  onStatusChange() {
    this.loadRelationships();
  }

  onTypeChange() {
    this.loadRelationships();
  }

  clearFilters() {
    this.filters = {
      dateRange: {
        start: null,
        end: null,
      },
      status: [],
      type: [],
    };
    this.loadRelationships();
  }
}

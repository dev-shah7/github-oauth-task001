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
  ],
  templateUrl: './repository-relationships.component.html',
  styleUrls: ['./repository-relationships.component.scss'],
})
export class RepositoryRelationshipsComponent implements OnInit {
  private gridApi!: GridApi;
  searchText: string = '';
  private searchSubject = new Subject<string>();
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
  };

  gridOptions = {
    masterDetail: true,
    detailRowHeight: 400,
    detailCellRenderer: DetailCellRendererComponent,
    components: {
      detailCellRenderer: DetailCellRendererComponent,
    },
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

  constructor(private http: HttpClient) {
    this.setupSearch();
  }

  ngOnInit() {
    this.loadRelationships();
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  private setupSearch(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((searchText) => {
        if (this.gridApi) {
          (this.gridApi as any).setQuickFilter(searchText);
        }
      });
  }

  onSearchChange(value: string) {
    this.searchText = value;
    this.searchSubject.next(value);
  }

  loadRelationships() {
    const owner = 'dev-shahh';
    const repo = 'analytics';

    const queryParams = new URLSearchParams({
      owner,
      repo,
      page: '1',
      pageSize: '100', // This is limiting the data to 100 records
    });

    this.http
      .get<RelationshipsResponse>(
        `${environment.apiUrl}/integrations/repository/relationships?${queryParams}`,
        { withCredentials: true }
      )
      .subscribe({
        next: (response) => {
          this.repositoryInfo = response.repository;
          // Transform and combine the data
          this.combinedData = [
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
        },
        error: (error) => {
          console.error('Error loading relationships:', error);
        },
      });
  }
}

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
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { ItemDetailsDialogComponent } from '../item-details-dialog/item-details-dialog.component';
import { GithubDetailsService } from '../../services/github-details.service';

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

interface Repository {
  _id: string;
  repoId: number;
  name: string;
  full_name?: string;
  owner: {
    login: string;
    id: number;
    avatarUrl: string;
  };
  description: string | null;
  html_url?: string;
  updated_at?: string;
}

@Component({
  selector: 'detail-cell',
  template: `
    <div class="detail-grid">
      <mat-card>
        <mat-card-header>
          <mat-card-title>{{ getDetailTitle() }}</mat-card-title>
          <mat-card-subtitle>{{ getDetailSubtitle() }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <!-- Main Details -->
          <div class="detail-section">
            <div class="detail-row" *ngFor="let item of mainDetails">
              <div class="detail-label">{{ item.label }}:</div>
              <div
                class="detail-value"
                [ngClass]="{ 'json-value': item.isJson }"
              >
                <ng-container [ngSwitch]="item.type">
                  <a
                    *ngSwitchCase="'link'"
                    [href]="item.value"
                    target="_blank"
                    >{{ item.displayValue || item.value }}</a
                  >
                  <span *ngSwitchCase="'date'">{{
                    item.value | date : 'medium'
                  }}</span>
                  <pre *ngSwitchCase="'json'">{{ item.value | json }}</pre>
                  <span *ngSwitchDefault>{{ item.value }}</span>
                </ng-container>
              </div>
            </div>
          </div>

          <!-- Additional Sections -->
          <ng-container *ngIf="additionalSections.length">
            <mat-divider class="section-divider"></mat-divider>
            <div class="additional-sections">
              <div
                *ngFor="let section of additionalSections"
                class="detail-section"
              >
                <h3>{{ section.title }}</h3>
                <div class="detail-row" *ngFor="let item of section.items">
                  <div class="detail-label">{{ item.label }}:</div>
                  <div
                    class="detail-value"
                    [ngClass]="{ 'json-value': item.isJson }"
                  >
                    {{ item.value }}
                  </div>
                </div>
              </div>
            </div>
          </ng-container>

          <!-- Labels Section -->
          <div *ngIf="labels?.length" class="labels-section">
            <mat-divider class="section-divider"></mat-divider>
            <h3>Labels</h3>
            <div class="labels-container">
              <span
                *ngFor="let label of labels"
                class="label-chip"
                [style.background-color]="'#' + label.color"
              >
                {{ label.name }}
              </span>
            </div>
          </div>

          <!-- Comments Section -->
          <div *ngIf="comments?.length" class="comments-section">
            <mat-divider class="section-divider"></mat-divider>
            <h3>Comments ({{ comments.length }})</h3>
            <div class="comment" *ngFor="let comment of comments">
              <div class="comment-header">
                <img
                  [src]="comment.user.avatar_url"
                  class="comment-avatar"
                  [alt]="comment.user.login"
                />
                <a [href]="comment.user.html_url" target="_blank">{{
                  comment.user.login
                }}</a>
                <span class="comment-date"
                  >commented on {{ comment.created_at | date }}</span
                >
              </div>
              <div class="comment-body">{{ comment.body }}</div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .detail-grid {
        padding: 20px;
        background: #fafafa;
      }
      .detail-section {
        margin-bottom: 24px;
      }
      .detail-row {
        display: grid;
        grid-template-columns: 200px 1fr;
        gap: 20px;
        padding: 8px 0;
        border-bottom: 1px solid #eee;
      }
      .detail-label {
        font-weight: 500;
        color: #666;
      }
      .detail-value {
        word-break: break-word;
      }
      .json-value {
        font-family: monospace;
        white-space: pre-wrap;
        background: #f5f5f5;
        padding: 8px;
        border-radius: 4px;
      }
      .section-divider {
        margin: 24px 0;
      }
      .labels-container {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .label-chip {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        color: white;
      }
      .comments-section {
        margin-top: 24px;
      }
      .comment {
        margin-bottom: 16px;
        padding: 16px;
        background: white;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      .comment-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .comment-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
      }
      .comment-date {
        color: #666;
        font-size: 0.9em;
      }
      .comment-body {
        white-space: pre-wrap;
      }
    `,
  ],
  standalone: true,
  imports: [CommonModule, NgClass, NgFor, MatCardModule, MatDividerModule],
})
export class DetailCellRendererComponent {
  params: any;
  mainDetails: any[] = [];
  additionalSections: any[] = [];
  labels: any[] = [];
  comments: any[] = [];

  agInit(params: any): void {
    this.params = params;
    this.processData(params.data);
  }

  private processData(data: any): void {
    const details = data.details;
    const type = data.type;

    switch (type) {
      case 'Commit':
        this.processCommitData(details);
        break;
      case 'PR':
        this.processPRData(details);
        break;
      case 'Issue':
        this.processIssueData(details);
        break;
    }
  }

  private processCommitData(commit: any): void {
    this.mainDetails = [
      { label: 'SHA', value: commit.sha, type: 'text' },
      { label: 'Author', value: commit.commit.author.name, type: 'text' },
      {
        label: 'Author Email',
        value: commit.commit.author.email,
        type: 'text',
      },
      { label: 'Date', value: commit.commit.author.date, type: 'date' },
      { label: 'Message', value: commit.commit.message, type: 'text' },
      { label: 'URL', value: commit.html_url, type: 'link' },
    ];

    if (commit.stats) {
      this.additionalSections.push({
        title: 'Statistics',
        items: [
          { label: 'Additions', value: commit.stats.additions },
          { label: 'Deletions', value: commit.stats.deletions },
          { label: 'Total Changes', value: commit.stats.total },
        ],
      });
    }

    if (commit.files?.length) {
      this.additionalSections.push({
        title: 'Changed Files',
        items: commit.files.map((file: any) => ({
          label: file.filename,
          value: `Changes: +${file.additions} -${file.deletions}`,
        })),
      });
    }
  }

  private processPRData(pr: any): void {
    this.mainDetails = [
      { label: 'Title', value: pr.title, type: 'text' },
      { label: 'Number', value: `#${pr.number}`, type: 'text' },
      { label: 'State', value: pr.state, type: 'text' },
      {
        label: 'Created By',
        value: pr.user.login,
        type: 'link',
        link: pr.user.html_url,
      },
      { label: 'Created At', value: pr.created_at, type: 'date' },
      { label: 'Updated At', value: pr.updated_at, type: 'date' },
      { label: 'URL', value: pr.html_url, type: 'link' },
    ];

    if (pr.merged_at) {
      this.mainDetails.push({
        label: 'Merged At',
        value: pr.merged_at,
        type: 'date',
      });
    }

    this.labels = pr.labels || [];
    this.comments = pr.comments || [];

    if (pr.requested_reviewers?.length) {
      this.additionalSections.push({
        title: 'Requested Reviewers',
        items: pr.requested_reviewers.map((reviewer: any) => ({
          label: reviewer.login,
          value: reviewer.type,
        })),
      });
    }
  }

  private processIssueData(issue: any): void {
    this.mainDetails = [
      { label: 'Title', value: issue.title, type: 'text' },
      { label: 'Number', value: `#${issue.number}`, type: 'text' },
      { label: 'State', value: issue.state, type: 'text' },
      {
        label: 'Created By',
        value: issue.user.login,
        type: 'link',
        link: issue.user.html_url,
      },
      { label: 'Created At', value: issue.created_at, type: 'date' },
      { label: 'Updated At', value: issue.updated_at, type: 'date' },
      { label: 'URL', value: issue.html_url, type: 'link' },
    ];

    if (issue.closed_at) {
      this.mainDetails.push({
        label: 'Closed At',
        value: issue.closed_at,
        type: 'date',
      });
    }

    this.labels = issue.labels || [];
    this.comments = issue.comments || [];

    if (issue.assignees?.length) {
      this.additionalSections.push({
        title: 'Assignees',
        items: issue.assignees.map((assignee: any) => ({
          label: assignee.login,
          value: assignee.type,
        })),
      });
    }
  }

  getDetailTitle(): string {
    const data = this.params.data;
    switch (data.type) {
      case 'Commit':
        return `Commit ${data.identifier.substring(0, 7)}`;
      case 'PR':
        return `Pull Request #${data.identifier}`;
      case 'Issue':
        return `Issue #${data.identifier}`;
      default:
        return 'Details';
    }
  }

  getDetailSubtitle(): string {
    const data = this.params.data;
    return data.title || '';
  }
}

@Component({
  selector: 'tree-cell',
  template: `
    <div class="tree-cell" [class.group-row]="params.node.group">
      <div
        class="tree-content"
        [style.padding-left.px]="params.node.level * 20"
      >
        <img
          *ngIf="showAvatar"
          [src]="avatarUrl"
          class="item-avatar"
          [alt]="params.value"
        />
        <span class="item-icon" *ngIf="icon">
          <i [class]="icon"></i>
        </span>
        <span class="item-title">{{ params.value }}</span>
        <span class="item-count" *ngIf="params.node.group"
          >({{ params.node.allChildrenCount }})</span
        >
      </div>
    </div>
  `,
  styles: [
    `
      .tree-cell {
        display: flex;
        align-items: center;
        height: 100%;
      }
      .tree-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .item-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
      }
      .item-icon {
        width: 16px;
        color: #666;
      }
      .item-count {
        color: #666;
        font-size: 0.9em;
      }
      .group-row {
        font-weight: 500;
        background: #f5f5f5;
      }
    `,
  ],
  standalone: true,
  imports: [CommonModule],
})
export class TreeCellRenderer {
  params: any;
  showAvatar: boolean = false;
  avatarUrl: string = '';
  icon: string = '';

  agInit(params: any): void {
    this.params = params;
    this.setupCell();
  }

  private setupCell() {
    if (this.params.node.group) {
      switch (this.params.value) {
        case 'Commits':
          this.icon = 'fas fa-code-branch';
          break;
        case 'Pull Requests':
          this.icon = 'fas fa-code-pull-request';
          break;
        case 'Issues':
          this.icon = 'fas fa-exclamation-circle';
          break;
        default:
          this.icon = 'fas fa-folder';
      }
    } else {
      // Show avatar for repository or user
      if (this.params.data.authorAvatar) {
        this.showAvatar = true;
        this.avatarUrl = this.params.data.authorAvatar;
      }
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
    treeData: true,
    groupDefaultExpanded: 1,
    masterDetail: true,
    detailRowHeight: 400,
    detailCellRenderer: 'myDetailCellRenderer',
    components: {
      myDetailCellRenderer: DetailCellRendererComponent,
    },
    autoGroupColumnDef: {
      headerName: 'Repository/Item',
      minWidth: 300,
      flex: 2,
      cellRenderer: 'agGroupCellRenderer',
      cellRendererParams: {
        suppressCount: true,
        innerRenderer: TreeCellRenderer,
        checkbox: false,
      },
    },
    isRowMaster: (dataItem: any) => {
      return (
        dataItem && dataItem.details && !dataItem.treePath?.includes('Group')
      );
    },
    getDataPath: (data: any) => {
      return data.treePath;
    },
    enableCellTextSelection: true,
    ensureDomOrder: true,
  };

  columnDefs: ColDef[] = [
    {
      headerName: 'Type',
      field: 'type',
      width: 100,
      filter: 'agSetColumnFilter',
      cellRenderer: (params: any) => {
        if (params.node.group) return '';
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
        if (!data || params.node.group) return '';

        const isExpandable = params.node.master;
        const idDisplay =
          data.type === 'Commit'
            ? data.identifier.substring(0, 7)
            : '#' + data.identifier;

        return `
          <div class="id-cell">
            <a 
              href="${data.html_url}" 
              target="_blank" 
              class="id-link"
              title="Open in GitHub"
            >${idDisplay}</a>
            ${
              isExpandable
                ? `
                  <span class="expand-icon" title="Click to see details">
                    <i class="fas fa-chevron-${
                      params.node.expanded ? 'up' : 'down'
                    }"></i>
                  </span>
                `
                : ''
            }
          </div>
        `;
      },
      onCellClicked: (params: any) => {
        const clickedOnExpand = (params.event.target as HTMLElement).closest(
          '.expand-icon'
        );
        const clickedOnLink = (params.event.target as HTMLElement).closest(
          '.id-link'
        );

        if (clickedOnExpand && params.node.master) {
          params.node.setExpanded(!params.node.expanded);
          params.api.refreshCells({
            rowNodes: [params.node],
            columns: [params.column.getId()],
          });
        } else if (clickedOnLink) {
          // Let the default link behavior handle the navigation
          return;
        }
      },
      cellClass: 'id-cell-wrapper',
    },
    {
      headerName: 'Title/Message',
      field: 'title',
      flex: 1,
      cellRenderer: (params: any) => {
        const data = params.data;
        if (!data || params.node.group) return params.value;

        return `
          <div class="title-cell clickable">
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
      },
      onCellClicked: (params: any) => {
        if (!params.node.group) {
          this.showItemDetails(params.data);
        }
      },
    },
    {
      headerName: 'Author',
      field: 'author',
      width: 180,
      cellRenderer: (params: any) => {
        const data = params.data;
        if (!data || params.node.group) return '';

        // Handle different author data structures for commits vs PRs/issues
        const authorData =
          data.type === 'Commit'
            ? {
                name:
                  data.author ||
                  data.commit?.author?.name ||
                  data.author?.login,
                avatar: data.author_avatar_url || data.author?.avatar_url,
                url: data.author_url || data.author?.html_url,
              }
            : {
                name: data.author || data.user?.login,
                avatar: data.author_avatar_url || data.user?.avatar_url,
                url: data.author_url || data.user?.html_url,
              };

        return `
          <div class="author-cell">
            ${
              authorData.avatar
                ? `<div class="avatar-container">
                     <img 
                       src="${authorData.avatar}" 
                       class="user-avatar" 
                       alt="${authorData.name}"
                       style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;"
                     />
                   </div>`
                : ''
            }
            ${
              authorData.url
                ? `<a href="${
                    authorData.url
                  }" target="_blank" class="author-name">${
                    authorData.name || ''
                  }</a>`
                : `<span class="author-name">${authorData.name || ''}</span>`
            }
          </div>
        `;
      },
      cellClass: 'author-cell-wrapper',
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

  // Add new properties
  repositories: Repository[] = [];
  selectedRepo: Repository | null = null;
  isLoadingRepos = false;

  // Add property for filtered repositories
  filteredRepositories: Repository[] = [];
  searchRepoText: string = '';

  // Add these properties if they don't exist
  private originalData: any[] = [];

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private githubDetailsService: GithubDetailsService
  ) {}

  ngOnInit() {
    this.loadRepositories();
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
    if (!this.selectedRepo) {
      this.snackBar.open('Please select a repository first', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.isLoading = true;
    this.error = null;

    const queryParams = new URLSearchParams({
      owner: this.selectedRepo.owner.login,
      repo: this.selectedRepo.name,
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

          // Transform data to hierarchical structure
          let transformedData = [
            {
              type: 'Repository',
              title: response.repository.fullName,
              treePath: [response.repository.fullName],
            },
            // Commits
            ...response.relationships.commits.data.map((commit) => ({
              type: 'Commit',
              identifier: commit.sha,
              title: commit.commit.message,
              author: commit.commit.author.name,
              authorAvatar: commit.author?.avatar_url,
              author_url: commit.author?.html_url,
              date: commit.commit.author.date,
              html_url: commit.html_url,
              details: commit,
              treePath: [response.repository.fullName, 'Commits', commit.sha],
            })),
            // Pull Requests
            ...response.relationships.pullRequests.data.map((pr) => ({
              type: 'PR',
              identifier: pr.number,
              title: pr.title,
              author: pr.user.login,
              authorAvatar: pr.user.avatar_url,
              author_url: pr.user.html_url,
              state: pr.state,
              date: pr.createdAt,
              html_url: pr.html_url,
              details: pr,
              treePath: [
                response.repository.fullName,
                'Pull Requests',
                `#${pr.number}`,
              ],
            })),
            // Issues
            ...response.relationships.issues.data.map((issue) => ({
              type: 'Issue',
              identifier: issue.number,
              title: issue.title,
              author: issue.user.login,
              authorAvatar: issue.user.avatar_url,
              author_url: issue.user.html_url,
              state: issue.state,
              date: issue.createdAt,
              labels: issue.labels,
              html_url: issue.html_url,
              details: issue,
              treePath: [
                response.repository.fullName,
                'Issues',
                `#${issue.number}`,
              ],
            })),
          ];

          // Apply filters
          if (this.filters.type.length > 0) {
            transformedData = transformedData.filter(
              (item) =>
                item.type === 'Repository' ||
                this.filters.type.includes(item.type)
            );
          }

          this.originalData = transformedData;
          this.combinedData = transformedData;

          // Add virtual root nodes for grouping
          if (this.combinedData.length > 1) {
            this.combinedData.push(
              {
                type: 'Group',
                treePath: [response.repository.fullName, 'Commits'],
                title: 'Commits',
              },
              {
                type: 'Group',
                treePath: [response.repository.fullName, 'Pull Requests'],
                title: 'Pull Requests',
              },
              {
                type: 'Group',
                treePath: [response.repository.fullName, 'Issues'],
                title: 'Issues',
              }
            );
          }

          if (this.gridApi) {
            this.gridApi.setGridOption('rowData', this.combinedData);
          }

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

  // Update the onDateRangeChange method
  onDateRangeChange() {
    this.applyFilters();
  }

  // Update the applyFilters method
  private applyFilters() {
    let filteredData = [...this.originalData];

    // Apply date range filter
    if (this.filters.dateRange.start || this.filters.dateRange.end) {
      filteredData = filteredData.filter((item) => {
        // Skip repository and group items
        if (item.type === 'Repository' || item.type === 'Group') {
          return true;
        }

        const itemDate = new Date(item.date);
        const startDate = this.filters.dateRange.start
          ? new Date(this.filters.dateRange.start)
          : null;
        const endDate = this.filters.dateRange.end
          ? new Date(this.filters.dateRange.end)
          : null;

        // Set time to midnight for accurate date comparison
        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(23, 59, 59, 999);

        if (startDate && endDate) {
          return itemDate >= startDate && itemDate <= endDate;
        } else if (startDate) {
          return itemDate >= startDate;
        } else if (endDate) {
          return itemDate <= endDate;
        }

        return true;
      });

      // Re-add the group nodes
      if (filteredData.length > 1) {
        const repoName =
          this.selectedRepo?.full_name || this.repositoryInfo?.fullName;
        filteredData.push(
          {
            type: 'Group',
            treePath: [repoName, 'Commits'],
            title: 'Commits',
          },
          {
            type: 'Group',
            treePath: [repoName, 'Pull Requests'],
            title: 'Pull Requests',
          },
          {
            type: 'Group',
            treePath: [repoName, 'Issues'],
            title: 'Issues',
          }
        );
      }
    }

    this.combinedData = filteredData;

    // Update the grid data
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.combinedData);
    }
  }

  onStatusChange() {
    this.loadRelationships();
  }

  onTypeChange() {
    this.loadRelationships();
  }

  // Update the clearFilters method
  clearFilters() {
    this.filters = {
      dateRange: {
        start: null,
        end: null,
      },
      status: [],
      type: [],
    };
    this.searchText = '';

    // Reset to original data
    this.combinedData = [...this.originalData];
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.combinedData);
    }
  }

  // Add method to load repositories
  loadRepositories() {
    this.isLoadingRepos = true;
    this.error = null;

    this.http
      .get<Repository[]>(`${environment.apiUrl}/integrations/github/repos`, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          console.error('Error loading repositories:', error);
          this.error = {
            title: 'Error Loading Repositories',
            message:
              error.error?.message ||
              'Failed to load repositories. Please try again.',
          };
          this.isLoadingRepos = false;
          return throwError(() => error);
        }),
        finalize(() => {
          this.isLoadingRepos = false;
        })
      )
      .subscribe({
        next: (repos) => {
          this.repositories = repos.map((repo) => ({
            ...repo,
            full_name: `${repo.owner.login}/${repo.name}`,
            owner: {
              ...repo.owner,
              avatar_url: repo.owner.avatarUrl,
            },
          }));
          this.filteredRepositories = this.repositories; // Initialize filtered list

          if (repos.length === 0) {
            this.error = {
              title: 'No Repositories Found',
              message:
                'No repositories were found. Please ensure you have access to repositories.',
            };
          }
        },
      });
  }

  // Add method to handle repository selection
  onRepoChange() {
    if (this.selectedRepo) {
      // Use repoId instead of name
      this.loadRelationships();
    }
  }

  // Add method to handle retry
  retryLoadRepositories() {
    this.error = null;
    this.loadRepositories();
  }

  // Add method to filter repositories
  filterRepositories(searchText: string) {
    this.searchRepoText = searchText;
    if (!searchText) {
      this.filteredRepositories = this.repositories;
      return;
    }

    searchText = searchText.toLowerCase();
    this.filteredRepositories = this.repositories.filter(
      (repo) =>
        repo.name.toLowerCase().includes(searchText) ||
        repo.owner.login.toLowerCase().includes(searchText) ||
        (repo.description &&
          repo.description.toLowerCase().includes(searchText))
    );
  }

  // Add method to show details
  private showItemDetails(data: any) {
    if (!this.selectedRepo) {
      this.snackBar.open('Please select a repository first', 'Close', {
        duration: 3000,
      });
      return;
    }

    const dialogRef = this.dialog.open(ItemDetailsDialogComponent, {
      data: {
        type: data.type,
        identifier: data.identifier,
        owner: this.selectedRepo.owner.login,
        repo: this.selectedRepo.name,
        item: data,
      },
      width: '800px',
      maxWidth: '90vw',
      maxHeight: '90vh',
    });

    dialogRef.afterClosed().subscribe((result) => {
      // Handle any actions after dialog is closed
    });
  }
}

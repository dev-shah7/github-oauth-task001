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
  PaginationChangedEvent,
  GridOptions,
  PaginationModule,
} from 'ag-grid-community';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
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

interface DataTypeOption {
  value: string;
  label: string;
  subTypes?: { value: string; label: string }[];
}

interface Repository {
  name: string;
  owner: {
    login: string;
  };
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    totalRecords: number;
    currentPage: number;
    pageSize: number;
  };
}

interface GithubIssue {
  number: number;
  title: string;
  state: string;
  user: {
    login: string;
    avatarUrl: string;
  };
  body: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  labels: Array<{
    name: string;
    color: string;
    description: string;
  }>;
  assignees: Array<{
    login: string;
    avatarUrl: string;
  }>;
  milestone?: {
    title: string;
    state: string;
    dueOn: Date;
  };
  comments: number;
  isPullRequest: boolean;
}

@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [
    CommonModule,
    AgGridModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    FormsModule,
  ],
  templateUrl: './organizations.component.html',
  styleUrls: ['./organizations.component.scss'],
})
export class OrganizationsComponent implements OnInit {
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;

  organizations: any[] = [];
  selectedOrg: string = '';
  selectedDataType: string = '';
  loading = false;
  error: string | null = null;
  rowData: any[] = [];
  columnDefs: ColDef[] = [];
  selectedRepo: Repository | null = null;
  repositories: Repository[] = [];
  selectedSubType: string = '';
  repoSource: 'user' | 'organization' = 'organization';

  dataTypeOptions: DataTypeOption[] = [
    { value: 'members', label: 'Members' },
    { value: 'repos', label: 'List Repositories' },
    {
      value: 'repo-data',
      label: 'Repository Data',
      subTypes: [
        { value: 'commits', label: 'Repository Commits' },
        { value: 'pulls', label: 'Pull Requests' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ];

  searchText: string = '';
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    floatingFilter: true,
    resizable: true,
    filterParams: {
      buttons: ['reset', 'apply'],
      closeOnApply: true,
    },
  };

  private searchSubject = new Subject<string>();

  // Add pagination properties
  currentPage = 1;
  pageSize = 10;
  totalRecords = 0;

  // Update pagination properties
  pagination = true;
  paginationPageSize = 10;
  paginationPageSizeSelector = [10, 20];

  // Add properties for pagination buttons
  canGoNext = true;
  canGoPrevious = false;

  // Update gridOptions
  gridOptions: GridOptions = {
    pagination: true,
    paginationPageSize: this.paginationPageSize,
    paginationPageSizeSelector: this.paginationPageSizeSelector,
    cacheBlockSize: this.paginationPageSize,
    domLayout: 'autoHeight',
    suppressPaginationPanel: true,
    onGridReady: (params) => {
      this.gridApi = params.api;
    },
  };

  public isLoading = false;
  private gridApi: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchOrganizations();
    this.setupSearch();
  }

  private fetchOrganizations(): void {
    this.loading = true;
    this.error = null;

    this.http
      .get<any[]>(`${environment.apiUrl}/integrations/github/organizations`, {
        withCredentials: true,
      })
      .subscribe({
        next: (data) => {
          this.organizations = data;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error fetching organizations:', err);
          this.error = 'Failed to load organizations';
          this.loading = false;
        },
      });
  }

  onOrgChange(): void {
    this.selectedDataType = '';
    this.selectedRepo = null;
    this.selectedSubType = '';
    this.repositories = [];
    this.rowData = [];
    this.columnDefs = [];

    if (this.repoSource === 'user') {
      this.selectedOrg = '';
    }
  }

  onDataTypeChange() {
    this.selectedRepo = null;
    this.selectedSubType = '';
    this.repositories = [];
    this.rowData = [];
    this.columnDefs = [];

    if (this.selectedDataType === 'repos') {
      this.loadOrgData();
    } else if (this.selectedDataType === 'repo-data') {
      this.loadRepositories();
    } else {
      this.loadOrgData();
    }
  }

  onRepoChange(): void {
    this.selectedSubType = '';
    this.rowData = [];
    this.columnDefs = [];
  }

  loadOrgData(): void {
    if (
      (!this.selectedOrg && this.repoSource === 'organization') ||
      !this.selectedDataType
    )
      return;

    this.loading = true;
    this.error = null;

    const endpoint = this.getEndpoint(this.selectedDataType);

    this.http.get<any[]>(endpoint, { withCredentials: true }).subscribe({
      next: (data) => {
        this.rowData = data;
        if (data.length > 0) {
          // Flatten the first object to get all possible fields
          const flattenedObject = this.flattenObject(data[0]);
          this.columnDefs = Object.entries(flattenedObject).map(
            ([key, value]) => ({
              field: key,
              headerName: this.formatColumnHeader(key),
              sortable: true,
              filter: true,
              resizable: true,
              flex: 1,
              minWidth: 120,
              valueFormatter: (params: any) => {
                if (params.value instanceof Date) {
                  return params.value.toLocaleString();
                }
                if (Array.isArray(params.value)) {
                  return params.value
                    .map((v: { name?: string; login?: string } | string) => {
                      if (typeof v === 'object' && v !== null) {
                        return v.name || v.login || '';
                      }
                      return v;
                    })
                    .join(', ');
                }
                return params.value;
              },
            })
          );

          // Flatten all data objects
          this.rowData = data.map((item) => this.flattenObject(item));
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching data:', err);
        this.error = 'Failed to load data';
        this.loading = false;
      },
    });
  }

  private getEndpoint(dataType: string): string {
    const baseUrl =
      this.repoSource === 'user'
        ? `${environment.apiUrl}/integrations/github/user`
        : `${environment.apiUrl}/integrations/github/organizations/${this.selectedOrg}`;

    if (dataType === 'repos') {
      return `${baseUrl}/repos`;
    }

    return `${baseUrl}/${dataType}`;
  }

  private formatColumnHeader(key: string): string {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  loadRepositories() {
    this.loading = true;
    this.error = null;

    const endpoint =
      this.repoSource === 'user'
        ? `${environment.apiUrl}/integrations/github/user/repos`
        : `${environment.apiUrl}/integrations/github/organizations/${this.selectedOrg}/repos`;

    this.http.get<Repository[]>(endpoint, { withCredentials: true }).subscribe({
      next: (data) => {
        this.repositories = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching repositories:', err);
        this.error = 'Failed to load repositories';
        this.loading = false;
      },
    });
  }

  // Add methods for next/previous navigation
  goToNextPage() {
    if (this.isLoading || !this.canGoNext) return;
    this.currentPage++;
    this.loadRepoData();
  }

  goToPreviousPage() {
    if (this.isLoading || !this.canGoPrevious) return;
    this.currentPage--;
    this.loadRepoData();
  }

  // Add this new method to handle page size changes
  onPageSizeChange(newPageSize: number) {
    // Reset to page 1 when page size changes
    this.currentPage = 1;
    this.pageSize = newPageSize;
    this.loadRepoData();
  }

  // Add a new method to safely update the grid
  private updateGrid(data: any[]) {
    if (!this.gridApi) {
      console.warn('Grid API not available');
      return;
    }

    try {
      // Flatten the data
      const flattenedData = data.map((item) => this.flattenObject(item));

      // Update or create column definitions if needed
      if (this.columnDefs.length === 0 && flattenedData.length > 0) {
        const firstRow = flattenedData[0];
        this.columnDefs = Object.entries(firstRow).map(([key, value]) =>
          this.getColumnDef(key, value)
        );
        // Use setGridOption for column definitions
        this.gridApi.setGridOption('columnDefs', this.columnDefs);
      }

      // Use setGridOption for row data
      this.gridApi.setGridOption('rowData', flattenedData);

      // Use setGridOption for pagination page size
      this.gridApi.setGridOption('paginationPageSize', Number(this.pageSize));

      // Apply quick filter if there's search text
      if (this.searchText) {
        this.gridApi.setQuickFilter(this.searchText);
      }
    } catch (error) {
      console.error('Error updating grid:', error);
      this.error = 'Error updating grid display';
    }
  }

  // Update loadRepoData method with correct grid API calls
  loadRepoData() {
    if (!this.selectedRepo || !this.selectedSubType || this.isLoading) return;

    this.isLoading = true;
    this.error = null;
    this.columnDefs = [];

    const endpoint =
      this.repoSource === 'user'
        ? `${environment.apiUrl}/integrations/github/user/repo/${this.selectedSubType}`
        : `${environment.apiUrl}/integrations/github/organizations/${this.selectedOrg}/repo/${this.selectedSubType}`;

    const payload = {
      owner: this.selectedRepo.owner.login,
      repo: this.selectedRepo.name,
      page: this.currentPage,
      pageSize: this.pageSize,
    };

    // Show loading overlay if grid is ready
    if (this.gridApi) {
      this.gridApi.showLoadingOverlay();
    }

    this.http
      .post<PaginatedResponse<any>>(endpoint, payload, {
        withCredentials: true,
      })
      .subscribe({
        next: (response) => {
          try {
            // Store the raw data
            this.rowData = response.data;
            this.totalRecords = response?.pagination?.totalRecords || 0;

            // Update pagination state
            this.canGoPrevious = this.currentPage > 1;
            this.canGoNext = this.rowData.length === this.pageSize;

            // Wait for grid API to be available
            const updateGrid = () => {
              if (this.gridApi) {
                // Force regenerate column definitions
                if (this.rowData.length > 0) {
                  const flattenedFirstRow = this.flattenObject(this.rowData[0]);
                  this.columnDefs = Object.entries(flattenedFirstRow).map(
                    ([key, value]) => this.getColumnDef(key, value)
                  );
                  this.gridApi.setGridOption('columnDefs', this.columnDefs);
                }

                // Update the grid with new data
                const flattenedData = this.rowData.map((item) =>
                  this.flattenObject(item)
                );
                this.gridApi.setGridOption('rowData', flattenedData);

                // Update pagination settings
                this.gridApi.setGridOption(
                  'paginationPageSize',
                  Number(this.pageSize)
                );

                // Apply quick filter if there's search text
                if (this.searchText) {
                  this.gridApi.setQuickFilter(this.searchText);
                }

                // Hide loading overlay
                this.gridApi.hideOverlay();
              } else {
                // Retry after a short delay if grid API is not ready
                setTimeout(updateGrid, 100);
              }
            };

            updateGrid();

            // Clear loading state
            this.isLoading = false;
          } catch (error) {
            console.error('Error processing response:', error);
            this.error = 'Error processing data';
            this.isLoading = false;
            if (this.gridApi) {
              this.gridApi.hideOverlay();
            }
          }
        },
        error: (err) => {
          console.error('Error fetching repo data:', err);
          this.error = 'Failed to load repository data';
          this.isLoading = false;
          if (this.gridApi) {
            this.gridApi.hideOverlay();
          }
        },
      });
  }

  // Update search methods
  private setupSearch(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((searchText) => {
        if (this.agGrid?.api) {
          this.agGrid?.api?.setGridOption('quickFilterText', searchText);
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

  private getColumnDef(key: string, value: any): ColDef {
    const baseConfig: ColDef = {
      field: key,
      headerName: this.formatColumnHeader(key),
      sortable: true,
      filter: true,
      floatingFilter: true,
      resizable: true,
      minWidth: 120,
      autoHeight: true,
      wrapText: true,
      cellStyle: { 'white-space': 'normal' },
    };

    // GitHub-specific column configurations
    const githubColumns: { [key: string]: ColDef } = {
      name: {
        ...baseConfig,
        headerName: 'Repository',
        minWidth: 250,
        cellRenderer: (params: any) => {
          const repo = params.data;
          const visibility =
            repo.visibility || (repo.private ? 'private' : 'public');
          const visibilityIcon = visibility === 'private' ? 'lock' : 'public';
          const visibilityColor =
            visibility === 'private' ? '#cb2431' : '#28a745';
          const archived = repo.archived
            ? '<span class="material-icons" style="font-size: 14px; color: #666;" title="Archived">archive</span>'
            : '';
          const fork = repo.fork
            ? '<span class="material-icons" style="font-size: 14px; color: #666;" title="Fork">fork_right</span>'
            : '';

          return `
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="material-icons" style="font-size: 16px; color: #57606a;">code</span>
                  <a href="${
                    repo.html_url
                  }" target="_blank" style="font-weight: 500; color: #0969da;">
                    ${params.value}
                  </a>
                  <span class="material-icons" style="font-size: 14px; color: ${visibilityColor};" title="${visibility}">
                    ${visibilityIcon}
                  </span>
                  ${archived}
                  ${fork}
                </div>
                ${
                  repo.description
                    ? `<div style="color: #57606a; font-size: 12px; margin-left: 24px;">
                    ${repo.description}
                  </div>`
                    : ''
                }
              </div>
            </div>
          `;
        },
      },
      'owner.login': {
        ...baseConfig,
        headerName: 'Owner',
        width: 200,
        cellRenderer: (params: any) => {
          const owner = params.data.owner;
          if (!owner) return '';

          return `
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="
                width: 24px; 
                height: 24px; 
                border-radius: 50%;
                overflow: hidden;
                flex-shrink: 0;
              ">
                <img 
                  src="${owner.avatar_url}" 
                  style="width: 100%; height: 100%; object-fit: cover;"
                  alt="${owner.login}"
                  onerror="this.src='assets/default-avatar.png';"
                >
              </div>
              <div style="
                display: flex;
                flex-direction: column;
                min-width: 0;
              ">
                <a 
                  href="${owner.html_url}" 
                  target="_blank" 
                  style="
                    color: #0969da;
                    text-decoration: none;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  "
                  title="${owner.login}"
                >
                  ${owner.login}
                </a>
                <span style="
                  color: #57606a;
                  font-size: 12px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                ">
                  ${owner.type}
                </span>
              </div>
            </div>
          `;
        },
        autoHeight: true,
        cellStyle: {
          display: 'flex',
          alignItems: 'center',
          padding: '8px 15px',
        },
      },
      language: {
        ...baseConfig,
        width: 130,
        cellRenderer: (params: any) => {
          if (!params.value) return '<span style="color: #666;">-</span>';

          // Language colors (you can add more)
          const colors: { [key: string]: string } = {
            JavaScript: '#f1e05a',
            TypeScript: '#3178c6',
            Python: '#3572A5',
            Java: '#b07219',
            'C#': '#178600',
            PHP: '#4F5D95',
            Ruby: '#701516',
            Go: '#00ADD8',
            Rust: '#dea584',
            HTML: '#e34c26',
            CSS: '#563d7c',
          };

          const color = colors[params.value] || '#666';

          return `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background-color: ${color};
              "></span>
              ${params.value}
            </div>
          `;
        },
      },
      topics: {
        ...baseConfig,
        headerName: 'Topics',
        minWidth: 200,
        cellRenderer: (params: any) => {
          return (
            params.value
              ?.map(
                (topic: string) => `
                <span style="
                  background-color: #ddf4ff;
                  color: #0969da;
                  padding: 2px 8px;
                  border-radius: 12px;
                  font-size: 12px;
                  margin: 2px 4px 2px 0;
                  display: inline-block;
                ">${topic}</span>
              `
              )
              .join('') || ''
          );
        },
      },
      stargazers_count: {
        ...baseConfig,
        headerName: 'Stars',
        width: 100,
        cellRenderer: (params: any) => {
          return `
            <div style="display: flex; align-items: center; gap: 4px;" title="Stars">
              <span class="material-icons" style="font-size: 14px; color: #666;">star</span>
              ${params.value.toLocaleString()}
            </div>
          `;
        },
      },
      forks_count: {
        ...baseConfig,
        headerName: 'Forks',
        width: 100,
        cellRenderer: (params: any) => {
          return `
            <div style="display: flex; align-items: center; gap: 4px;" title="Forks">
              <span class="material-icons" style="font-size: 14px; color: #666;">fork_right</span>
              ${params.value.toLocaleString()}
            </div>
          `;
        },
      },
      updated_at: {
        ...baseConfig,
        headerName: 'Last Updated',
        width: 150,
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          const date = new Date(params.value);
          const now = new Date();
          const diff = now.getTime() - date.getTime();
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));

          if (days === 0) return 'today';
          if (days === 1) return 'yesterday';
          if (days < 30) return `${days} days ago`;
          if (days < 365) return `${Math.floor(days / 30)} months ago`;
          return `${Math.floor(days / 365)} years ago`;
        },
      },
      visibility: {
        ...baseConfig,
        width: 120,
        cellRenderer: (params: any) => {
          const colors = {
            public: '#28a745',
            private: '#cb2431',
          };
          const color = colors[params.value as keyof typeof colors] || '#666';
          return `
            <span style="
              color: ${color};
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <span class="material-icons" style="font-size: 14px;">
                ${params.value === 'private' ? 'lock' : 'public'}
              </span>
              ${params.value}
            </span>
          `;
        },
      },
      description: {
        ...baseConfig,
        minWidth: 300,
        flex: 1,
        cellRenderer: (params: any) => {
          return (
            params.value || '<span style="color: #666;">No description</span>'
          );
        },
      },
      size: {
        ...baseConfig,
        headerName: 'Size',
        width: 120,
        valueFormatter: (params: any) => {
          return this.formatFileSize(params.value);
        },
      },
      open_issues_count: {
        ...baseConfig,
        headerName: 'Open Issues',
        width: 120,
        cellRenderer: (params: any) => {
          return `
            <div style="display: flex; align-items: center; gap: 4px;">
              <span class="material-icons" style="font-size: 14px; color: #666;">error_outline</span>
              ${params.value.toLocaleString()}
            </div>
          `;
        },
      },
      'security.advanced_security': {
        ...baseConfig,
        headerName: 'Security',
        width: 120,
        cellRenderer: (params: any) => {
          const status = params.value === 'enabled';
          return `
            <div style="display: flex; align-items: center; gap: 4px;">
              <span class="material-icons" style="font-size: 14px; color: ${
                status ? '#28a745' : '#cb2431'
              }">
                ${status ? 'security' : 'security_off'}
              </span>
              ${status ? 'Enabled' : 'Disabled'}
            </div>
          `;
        },
      },
      created_at: {
        ...baseConfig,
        headerName: 'Created',
        width: 160,
        valueFormatter: (params: any) => {
          return params.value ? new Date(params.value).toLocaleString() : '';
        },
      },
    };

    // Special column configurations
    const specialColumns: { [key: string]: ColDef } = {
      number: {
        ...baseConfig,
        width: 100,
        minWidth: 80,
        cellRenderer: (params: any) => {
          return `#${params.value}`;
        },
      },
      state: {
        ...baseConfig,
        width: 120,
        cellRenderer: (params: any) => {
          const color = params.value === 'open' ? '#28a745' : '#cb2431';
          return `<span style="color: ${color}; font-weight: 500;">${params.value}</span>`;
        },
      },
      title: {
        ...baseConfig,
        minWidth: 300,
        cellRenderer: (params: any) => {
          const issue = params.data;
          return `
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>${params.value}</span>
              ${
                issue.labels
                  ?.map(
                    (label: any) => `
                <span style="
                  background-color: #${label.color};
                  color: ${this.getContrastColor(label.color)};
                  padding: 2px 6px;
                  border-radius: 12px;
                  font-size: 12px;
                ">${label.name}</span>
              `
                  )
                  .join('') || ''
              }
            </div>
          `;
        },
      },
      'user.login': {
        ...baseConfig,
        headerName: 'Author',
        width: 150,
        cellRenderer: (params: any) => {
          const user = params.data.user;
          return user
            ? `
            <div style="display: flex; align-items: center; gap: 8px;">
              <img src="${user.avatarUrl}" style="width: 20px; height: 20px; border-radius: 50%;">
              <span>${user.login}</span>
            </div>
          `
            : '';
        },
      },
      assignees: {
        ...baseConfig,
        width: 200,
        cellRenderer: (params: any) => {
          return (
            params.value
              ?.map(
                (assignee: any) => `
            <img src="${assignee.avatarUrl}" 
                 title="${assignee.login}"
                 style="width: 20px; height: 20px; border-radius: 50%; margin-right: 4px;">
          `
              )
              .join('') || ''
          );
        },
      },
      comments: {
        ...baseConfig,
        width: 120,
        cellRenderer: (params: any) => {
          return params.value
            ? `
            <div style="display: flex; align-items: center; gap: 4px;">
              <span class="material-icons" style="font-size: 16px;">comment</span>
              <span>${params.value}</span>
            </div>
          `
            : '';
        },
      },
    };

    // Return special column config if exists
    if (specialColumns[key]) {
      return specialColumns[key];
    }

    // Handle dates
    if (key.endsWith('At') || key.includes('date') || key.includes('dueOn')) {
      return {
        ...baseConfig,
        width: 160,
        valueFormatter: (params: any) => {
          return params.value ? new Date(params.value).toLocaleString() : '';
        },
      };
    }

    // Return GitHub-specific column config if exists
    if (githubColumns[key]) {
      return githubColumns[key];
    }

    // Default column config based on value type
    return this.getDefaultColumnConfig(baseConfig, value);
  }

  // Helper method to get contrast color for labels
  private getContrastColor(hexcolor: string): string {
    const r = parseInt(hexcolor.slice(0, 2), 16);
    const g = parseInt(hexcolor.slice(2, 4), 16);
    const b = parseInt(hexcolor.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000' : '#fff';
  }

  getDataTypeOptions(): DataTypeOption[] {
    if (this.repoSource === 'user') {
      return this.dataTypeOptions.filter(
        (option) => option.value !== 'members'
      );
    }
    return this.dataTypeOptions;
  }

  // Add this helper function to flatten nested objects
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

  private getDefaultColumnConfig(baseConfig: ColDef, value: any): ColDef {
    if (value === null || value === undefined) {
      return { ...baseConfig, filter: 'agTextColumnFilter' };
    }

    switch (typeof value) {
      case 'number':
        return {
          ...baseConfig,
          filter: 'agNumberColumnFilter',
          filterParams: {
            buttons: ['apply', 'reset'],
            closeOnApply: true,
          },
        };
      case 'boolean':
        return {
          ...baseConfig,
          filter: 'agSetColumnFilter',
          filterParams: {
            values: ['true', 'false'],
          },
        };
      default:
        return {
          ...baseConfig,
          filter: 'agTextColumnFilter',
          filterParams: {
            buttons: ['apply', 'reset'],
            closeOnApply: true,
          },
        };
    }
  }

  // Add back the getRepoDataTypes method
  getRepoDataTypes() {
    return (
      this.dataTypeOptions.find((opt) => opt.value === 'repo-data')?.subTypes ||
      []
    );
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

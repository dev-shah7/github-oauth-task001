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
          this.columnDefs = Object.entries(data[0]).map(([key, value]) =>
            this.getColumnDef(key, value)
          );
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

  private formatHeaderName(key: string): string {
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
      headerName: this.formatHeaderName(key),
      sortable: true,
      filter: true,
      floatingFilter: true,
      resizable: true,
      minWidth: 120,
      autoHeight: true,
      wrapText: true,
      cellStyle: { 'white-space': 'normal' },
    };

    // Special column configurations for commits
    const commitColumns: { [key: string]: ColDef } = {
      sha: {
        ...baseConfig,
        width: 100,
        cellRenderer: (params: any) => {
          return `<a href="${
            params.data.html_url
          }" target="_blank">${params.value.substring(0, 7)}</a>`;
        },
      },
      'commit.message': {
        ...baseConfig,
        headerName: 'Message',
        minWidth: 300,
      },
      'commit.author.name': {
        ...baseConfig,
        headerName: 'Author',
        width: 150,
      },
      'commit.author.date': {
        ...baseConfig,
        headerName: 'Date',
        width: 160,
        valueFormatter: (params: any) => {
          return params.value ? new Date(params.value).toLocaleString() : '';
        },
      },
      'author.login': {
        ...baseConfig,
        headerName: 'GitHub User',
        width: 150,
        cellRenderer: (params: any) => {
          const author = params.data.author;
          return author
            ? `
            <div style="display: flex; align-items: center; gap: 8px;">
              <img src="${author.avatar_url}" style="width: 20px; height: 20px; border-radius: 50%;">
              <a href="${author.html_url}" target="_blank">${author.login}</a>
            </div>
          `
            : '';
        },
      },
      'commit.verification.verified': {
        ...baseConfig,
        headerName: 'Verified',
        width: 100,
        cellRenderer: (params: any) => {
          const verified = params.value;
          return verified
            ? '<span style="color: #28a745;">✓ Verified</span>'
            : '<span style="color: #cb2431;">✗ Unverified</span>';
        },
      },
    };

    // Return commit-specific column config if exists
    if (commitColumns[key]) {
      return commitColumns[key];
    }

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

    const processValue = (value: any, key: string) => {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          // Keep arrays as is
          flattened[newKey] = value;
        } else if (value instanceof Date) {
          flattened[newKey] = value;
        } else {
          Object.assign(flattened, this.flattenObject(value, newKey));
        }
      } else {
        flattened[newKey] = value;
      }
    };

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        processValue(obj[key], key);
      }
    }

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
}

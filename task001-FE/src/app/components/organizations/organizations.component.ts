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
import { MatChipsModule } from '@angular/material/chips';
import { ReactiveFormsModule, FormGroup, FormBuilder } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { startOfDay, endOfDay } from 'date-fns';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, finalize } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { MatCardModule } from '@angular/material/card';

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
    MatChipsModule,
    ReactiveFormsModule,
    MatExpansionModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatCardModule,
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
  error: { title: string; message: string } | null = null;
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

  // Add these for faceted search
  facets = {
    status: new Set<string>(),
    users: new Set<string>(),
    labels: new Set<string>(),
    types: new Set<string>(),
  };

  // Add this property to expose Array to template
  protected readonly Array = Array;

  // Add Math to component
  protected readonly Math = Math;

  constructor(private http: HttpClient, private snackBar: MatSnackBar) {
    this.setupSearch();
  }

  ngOnInit(): void {
    this.fetchOrganizations();
  }

  // Make fetchOrganizations public
  public fetchOrganizations(): void {
    this.isLoading = true;
    this.error = null;

    this.http
      .get<any[]>(`${environment.apiUrl}/integrations/github/organizations`, {
        withCredentials: true,
      })
      .pipe(
        catchError((error) => {
          if (error.status === 401) {
            this.error = {
              title: 'Authentication Error',
              message: 'Please log in to access organization data.',
            };
          } else {
            this.error = {
              title: 'Error Loading Organizations',
              message: 'Failed to load organizations. Please try again.',
            };
          }
          return throwError(() => error);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (data) => {
          this.organizations = data;
          this.snackBar.open('Organizations loaded successfully', 'Close', {
            duration: 3000,
          });
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

    this.isLoading = true;
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
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching data:', err);
        this.error = {
          title: 'Error Loading Data',
          message: 'Failed to load data. Please try again.',
        };
        this.isLoading = false;
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
    this.isLoading = true;
    this.error = null;

    const endpoint =
      this.repoSource === 'user'
        ? `${environment.apiUrl}/integrations/github/user/repos`
        : `${environment.apiUrl}/integrations/github/organizations/${this.selectedOrg}/repos`;

    this.http.get<Repository[]>(endpoint, { withCredentials: true }).subscribe({
      next: (data) => {
        this.repositories = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching repositories:', err);
        this.error = {
          title: 'Error Loading Repositories',
          message: 'Failed to load repositories. Please try again.',
        };
        this.isLoading = false;
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
        this.gridApi.setQuickFilterText(this.searchText);
      }
    } catch (error) {
      console.error('Error updating grid:', error);
      this.error = {
        title: 'Error Updating Grid',
        message: 'Failed to update grid display. Please try again.',
      };
    }
  }

  // Update loadRepoData method to properly handle facets
  loadRepoData() {
    if (!this.selectedRepo || !this.selectedSubType || this.isLoading) return;

    this.isLoading = true;
    this.error = null;

    // Clear existing facets before loading new data
    this.clearFacets();

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
            // Transform the data based on the selected subtype
            const transformedData = response.data.map((item) => {
              return this.flattenObject(item);
            });

            this.rowData = transformedData;

            if (transformedData.length > 0) {
              // Create columns based on the first item
              this.columnDefs = Object.keys(transformedData[0]).map((key) =>
                this.getColumnDef(key, transformedData[0][key])
              );

              // Update grid
              if (this.gridApi) {
                this.gridApi.setGridOption('columnDefs', this.columnDefs);
                this.gridApi.setGridOption('rowData', transformedData);
              }
            }

            this.totalRecords = response?.pagination?.totalRecords || 0;

            this.canGoPrevious = this.currentPage > 1;
            this.canGoNext = this.rowData.length === this.pageSize;

            this.isLoading = false;
          } catch (error) {
            console.error('Error processing data:', error);
            this.error = {
              title: 'Error Processing Data',
              message: 'Failed to process data. Please try again.',
            };
            this.isLoading = false;
            if (this.gridApi) {
              this.gridApi.hideOverlay();
            }
          }
        },
        error: (err) => {
          console.error('Error fetching repo data:', err);
          this.error = {
            title: 'Error Loading Repository Data',
            message: 'Failed to load repository data. Please try again.',
          };
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
      resizable: true,
      flex: 1,
      minWidth: 120,
    };

    // Special column configurations
    const specialColumns: { [key: string]: ColDef } = {
      number: {
        ...baseConfig,
        width: 100,
        flex: 0,
        cellRenderer: (params: any) => {
          return params.value
            ? `<a href="${params.data.html_url}" target="_blank">#${params.value}</a>`
            : '';
        },
      },
      title: {
        ...baseConfig,
        flex: 2,
        cellRenderer: (params: any) => {
          const labels = params.data.labels || [];
          const labelHtml = labels
            .map(
              (label: any) =>
                `<span class="badge" style="background-color: #${label.color}; margin-left: 8px;">${label.name}</span>`
            )
            .join('');
          return `<div>${params.value}${labelHtml}</div>`;
        },
      },
      state: {
        ...baseConfig,
        width: 120,
        cellRenderer: (params: any) => {
          return `<span class="badge badge-${params.value?.toLowerCase()}">${
            params.value
          }</span>`;
        },
      },
      user_login: {
        ...baseConfig,
        headerName: 'Author',
        cellRenderer: (params: any) => {
          const avatarUrl = params.data.user_avatar;
          return `
            <div style="display: flex; align-items: center; gap: 8px;">
              ${
                avatarUrl
                  ? `<img src="${avatarUrl}" style="width: 24px; height: 24px; border-radius: 50%;">`
                  : ''
              }
              <span>${params.value || ''}</span>
            </div>
          `;
        },
      },
      created_at: {
        ...baseConfig,
        valueFormatter: (params) => {
          return params.value ? new Date(params.value).toLocaleString() : '';
        },
      },
      updated_at: {
        ...baseConfig,
        valueFormatter: (params) => {
          return params.value ? new Date(params.value).toLocaleString() : '';
        },
      },
      closed_at: {
        ...baseConfig,
        valueFormatter: (params) => {
          return params.value ? new Date(params.value).toLocaleString() : '';
        },
      },
    };

    if (specialColumns[key]) {
      return specialColumns[key];
    }

    return baseConfig;
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

  getDataTypeOptions(): DataTypeOption[] {
    if (this.repoSource === 'user') {
      return this.dataTypeOptions.filter(
        (option) => option.value !== 'members'
      );
    }
    return this.dataTypeOptions;
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

  // Add method to clear facets
  private clearFacets() {
    Object.values(this.facets).forEach((set) => set.clear());
  }

  // Update updateFacets method to handle different data types
  private updateFacets(data: any[]) {
    this.clearFacets();

    data.forEach((item) => {
      // Handle status
      if (item.state) {
        this.facets.status.add(item.state.toLowerCase());
      }

      // Handle type based on the selected subtype
      if (this.selectedSubType) {
        this.facets.types.add(this.selectedSubType);
      }

      // Handle users
      if (item.user?.login) {
        this.facets.users.add(item.user.login);
      } else if (item.author?.login) {
        this.facets.users.add(item.author.login);
      }

      // Handle labels
      if (Array.isArray(item.labels)) {
        item.labels.forEach((label: any) => {
          if (label.name) {
            this.facets.labels.add(label.name);
          }
        });
      }
    });

    // Log facets for debugging
    console.log('Updated facets:', {
      status: Array.from(this.facets.status),
      users: Array.from(this.facets.users),
      labels: Array.from(this.facets.labels),
      types: Array.from(this.facets.types),
    });
  }

  // Add onGridSizeChanged method
  public onGridSizeChanged(params: any): void {
    if (this.gridApi) {
      this.gridApi.sizeColumnsToFit();
    }
  }
}

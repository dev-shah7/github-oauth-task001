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

  loadRepoData() {
    if (!this.selectedRepo || !this.selectedSubType) return;

    this.loading = true;
    this.error = null;

    const endpoint =
      this.repoSource === 'user'
        ? `${environment.apiUrl}/integrations/github/user/repo/${this.selectedSubType}`
        : `${environment.apiUrl}/integrations/github/organizations/${this.selectedOrg}/repo/${this.selectedSubType}`;

    const payload = {
      owner: this.selectedRepo.owner.login,
      repo: this.selectedRepo.name,
    };

    this.http
      .post<any[]>(endpoint, payload, { withCredentials: true })
      .subscribe({
        next: (data) => {
          this.rowData = data;
          if (data.length > 0) {
            this.columnDefs = Object.entries(data[0]).map(([key, value]) =>
              this.getColumnDef(key, value)
            );
          }
          if (this.searchText) {
            setTimeout(() => {
              this.agGrid.api.setGridOption('quickFilterText', this.searchText);
            });
          }
          this.loading = false;
        },
        error: (err) => {
          console.error('Error fetching repo data:', err);
          this.error = 'Failed to load repository data';
          this.loading = false;
        },
      });
  }

  getRepoDataTypes() {
    return (
      this.dataTypeOptions.find((opt) => opt.value === 'repo-data')?.subTypes ||
      []
    );
  }

  private setupSearch(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((searchText) => {
        if (this.agGrid?.api) {
          this.agGrid.api.paginationGoToPage(0);
          this.agGrid.api.onFilterChanged();
          this.agGrid.api.setGridOption('quickFilterText', searchText);
        }
      });
  }

  onSearchChange(value: string) {
    this.searchText = value;
    if (this.agGrid?.api) {
      this.agGrid.api.setGridOption('quickFilterText', value);
    }
  }

  clearSearch() {
    this.searchText = '';
    this.searchSubject.next('');
  }

  private getColumnDef(key: string, value: any): ColDef {
    const baseConfig = {
      field: key,
      headerName: this.formatHeaderName(key),
      sortable: true,
      filter: true,
      floatingFilter: true,
      resizable: true,
    };

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
            allowedCharPattern: '\\d\\-\\.',
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
      case 'object':
        if (value instanceof Date) {
          return {
            ...baseConfig,
            filter: 'agDateColumnFilter',
            filterParams: {
              buttons: ['apply', 'reset'],
              closeOnApply: true,
              comparator: (
                filterLocalDateAtMidnight: Date,
                cellValue: string
              ) => {
                const dateAsString = cellValue;
                const dateParts = dateAsString.split('-');
                const cellDate = new Date(
                  Number(dateParts[0]),
                  Number(dateParts[1]) - 1,
                  Number(dateParts[2])
                );
                if (
                  filterLocalDateAtMidnight.getTime() === cellDate.getTime()
                ) {
                  return 0;
                }
                if (cellDate < filterLocalDateAtMidnight) {
                  return -1;
                }
                if (cellDate > filterLocalDateAtMidnight) {
                  return 1;
                }
                return 0;
              },
            },
          };
        }
        return {
          ...baseConfig,
          filter: 'agTextColumnFilter',
          valueGetter: (params) => {
            return JSON.stringify(params.data[key]);
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

  getDataTypeOptions(): DataTypeOption[] {
    if (this.repoSource === 'user') {
      return this.dataTypeOptions.filter(
        (option) => option.value !== 'members'
      );
    }
    return this.dataTypeOptions;
  }
}

import { Component, OnInit } from '@angular/core';
import {
  ColDef,
  ModuleRegistry,
  GridOptions,
  ColGroupDef,
} from 'ag-grid-community';
import { HttpClient } from '@angular/common/http';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { ClientSideRowModelModule, PaginationModule } from 'ag-grid-community';

// Register required AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule, PaginationModule]);

@Component({
  selector: 'app-repository-relationships',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <ag-grid-angular
      class="ag-theme-material relationships-grid"
      [rowData]="rowData"
      [columnDefs]="columnDefs"
      [defaultColDef]="defaultColDef"
      [pagination]="true"
      [paginationPageSize]="pageSize"
      (gridReady)="onGridReady($event)"
    >
    </ag-grid-angular>
  `,
  styles: [
    `
      .relationships-grid {
        height: 700px;
        width: 100%;
      }
      :host ::ng-deep {
        .link-cell {
          color: #1a73e8;
          text-decoration: underline;
          cursor: pointer;
        }
        .nested-grid {
          height: 100%;
          width: 100%;
        }
        .badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-weight: 500;
          font-size: 12px;
        }
        .badge-pr {
          background-color: #0366d6;
          color: white;
        }
        .badge-issue {
          background-color: #28a745;
          color: white;
        }
      }
    `,
  ],
})
export class RepositoryRelationshipsComponent implements OnInit {
  rowData: any[] = [];
  columnDefs: (ColDef | ColGroupDef)[] = [];
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };
  pageSize = 20;

  // Mock data with more detailed information
  mockData = [
    {
      repoName: 'example-repo-1',
      commits: [
        {
          sha: 'abc123',
          message: 'Add authentication feature',
          author: 'dev1',
          date: '2024-01-15',
          relatedPRs: ['#123', '#124'],
          relatedIssues: ['#45', '#46'],
        },
        {
          sha: 'def456',
          message: 'Fix login bug',
          author: 'dev2',
          date: '2024-01-14',
          relatedPRs: ['#125'],
          relatedIssues: ['#47'],
        },
      ],
      pullRequests: [
        {
          number: 123,
          title: 'Implement user authentication',
          state: 'open',
          author: 'dev1',
          createdAt: '2024-01-10',
          relatedCommits: ['abc123'],
          relatedIssues: ['#45'],
        },
      ],
      issues: [
        {
          number: 45,
          title: 'Add user authentication system',
          state: 'open',
          author: 'dev1',
          createdAt: '2024-01-08',
          relatedPRs: ['#123'],
          relatedCommits: ['abc123'],
        },
      ],
    },
    {
      repoName: 'example-repo-2',
      commits: [
        {
          sha: 'xyz789',
          message: 'Implement dashboard UI',
          author: 'dev3',
          date: '2024-01-16',
          relatedPRs: ['#45'],
          relatedIssues: ['#22', '#23'],
        },
      ],
      pullRequests: [
        {
          number: 45,
          title: 'Feature: Dashboard Implementation',
          state: 'closed',
          author: 'dev3',
          createdAt: '2024-01-12',
          relatedCommits: ['xyz789'],
          relatedIssues: ['#22'],
        },
      ],
      issues: [
        {
          number: 22,
          title: 'Dashboard design requirements',
          state: 'closed',
          author: 'dev4',
          createdAt: '2024-01-05',
          relatedPRs: ['#45'],
          relatedCommits: ['xyz789'],
        },
      ],
    },
    {
      repoName: 'example-repo-3',
      commits: [
        {
          sha: 'def123',
          message: 'Add API documentation',
          author: 'dev2',
          date: '2024-01-17',
          relatedPRs: ['#67'],
          relatedIssues: ['#33'],
        },
      ],
      pullRequests: [
        {
          number: 67,
          title: 'Documentation: API endpoints',
          state: 'open',
          author: 'dev2',
          createdAt: '2024-01-16',
          relatedCommits: ['def123'],
          relatedIssues: ['#33'],
        },
      ],
      issues: [
        {
          number: 33,
          title: 'Missing API documentation',
          state: 'open',
          author: 'dev5',
          createdAt: '2024-01-14',
          relatedPRs: ['#67'],
          relatedCommits: ['def123'],
        },
      ],
    },
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.setupGrid();
    this.loadMockData();
  }

  setupGrid() {
    this.columnDefs = [
      {
        field: 'repoName',
        headerName: 'Repository',
        width: 150,
        cellRenderer: (params: any) => {
          return `<a class="link-cell" href="https://github.com/your-org/${params.value}" target="_blank">${params.value}</a>`;
        },
      },
      {
        headerName: 'Commits',
        children: [
          {
            field: 'commits',
            headerName: 'Hash',
            width: 100,
            cellRenderer: (params: any) => {
              const commit = params.value[0];
              return commit
                ? `<a class="link-cell" title="${
                    commit.message
                  }">${commit.sha.substring(0, 7)}</a>`
                : '';
            },
          },
          {
            field: 'commits',
            headerName: 'Message',
            width: 200,
            cellRenderer: (params: any) => {
              const commit = params.value[0];
              return commit ? commit.message : '';
            },
          },
        ],
      },
      {
        headerName: 'Pull Requests',
        children: [
          {
            field: 'pullRequests',
            headerName: '#',
            width: 80,
            cellRenderer: (params: any) => {
              const pr = params.value[0];
              return pr ? `<a class="link-cell">#${pr.number}</a>` : '';
            },
          },
          {
            field: 'pullRequests',
            headerName: 'Title',
            width: 200,
            cellRenderer: (params: any) => {
              const pr = params.value[0];
              return pr ? `<span class="pr-title">${pr.title}</span>` : '';
            },
          },
          {
            field: 'pullRequests',
            headerName: 'State',
            width: 100,
            cellRenderer: (params: any) => {
              const pr = params.value[0];
              if (!pr) return '';
              const color = pr.state === 'open' ? '#28a745' : '#cb2431';
              return `<span style="color: ${color}; font-weight: bold;">${pr.state}</span>`;
            },
          },
        ],
      },
      {
        headerName: 'Issues',
        children: [
          {
            field: 'issues',
            headerName: '#',
            width: 80,
            cellRenderer: (params: any) => {
              const issue = params.value[0];
              return issue ? `<a class="link-cell">#${issue.number}</a>` : '';
            },
          },
          {
            field: 'issues',
            headerName: 'Title',
            width: 200,
            cellRenderer: (params: any) => {
              const issue = params.value[0];
              return issue
                ? `<span class="issue-title">${issue.title}</span>`
                : '';
            },
          },
          {
            field: 'issues',
            headerName: 'State',
            width: 100,
            cellRenderer: (params: any) => {
              const issue = params.value[0];
              if (!issue) return '';
              const color = issue.state === 'open' ? '#28a745' : '#cb2431';
              return `<span style="color: ${color}; font-weight: bold;">${issue.state}</span>`;
            },
          },
        ],
      },
    ];
  }

  onGridReady(params: any) {
    params.api.sizeColumnsToFit();
  }

  loadMockData() {
    this.rowData = this.mockData;
  }
}

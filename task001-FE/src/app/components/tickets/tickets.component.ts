import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AgGridModule } from 'ag-grid-angular';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridOptions,
} from 'ag-grid-community';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';

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
    FormsModule,
  ],
  templateUrl: './tickets.component.html',
  styleUrls: ['./tickets.component.scss']
})
export class TicketsComponent implements OnInit {
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  private gridApi: any;

  rowData: Ticket[] = [];
  error: string | null = null;
  loading = false;

  owner: string | null = null;
  repo: string | null = null;
  issueNumber: number | null = null;

  columnDefs: ColDef[] = [
    { 
      field: 'ticketId', 
      headerName: 'Ticket ID',
      sortable: true,
      filter: true,
    },
    { 
      field: 'user.name', 
      headerName: 'User',
      sortable: true,
      filter: true,
    },
    { 
      field: 'date', 
      headerName: 'Date',
      sortable: true,
      filter: true,
      valueFormatter: (params) => {
        return params.value ? new Date(params.value).toLocaleDateString() : '';
      }
    },
    { 
      field: 'summary', 
      headerName: 'Summary',
      sortable: true,
      filter: true,
    },
    { 
      field: 'description', 
      headerName: 'Description',
      sortable: true,
      filter: true,
    },
    { 
      field: 'message', 
      headerName: 'Message',
      sortable: true,
      filter: true,
    }
  ];

  defaultColDef: ColDef = {
    flex: 1,
    minWidth: 100,
    resizable: true,
  };

  gridOptions: GridOptions = {
    domLayout: 'autoHeight',
  };

  constructor(private http: HttpClient) {
    const urlParams = new URLSearchParams(window.location.search);
    this.owner = urlParams.get('owner');
    this.repo = urlParams.get('repo');
    this.issueNumber = urlParams.get('issueNumber') ? parseInt(urlParams.get('issueNumber')!, 10) : null;
  }

  ngOnInit(): void {
    if (this.owner && this.repo && this.issueNumber) {
      this.loadGitHubIssue();
    }
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

    this.http.get<GitHubIssue>(endpoint, { headers }).subscribe({
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
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching issue:', err);
        this.error = 'Failed to load GitHub issue details';
        this.loading = false;
      }
    });
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
  }
}

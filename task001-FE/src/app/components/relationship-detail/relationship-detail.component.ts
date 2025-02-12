import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';

interface RelationshipParams {
  data: {
    relatedPRs: Array<{
      number: number;
      title: string;
      htmlUrl: string;
      state: string;
    }>;
    relatedIssues: Array<{
      number: number;
      title: string;
      htmlUrl: string;
      state: string;
    }>;
  };
}

@Component({
  selector: 'app-relationship-detail',
  template: `
    <div class="relationship-detail">
      <div *ngIf="params.data.relatedPRs?.length" class="related-section">
        <h4>Related Pull Requests</h4>
        <div *ngFor="let pr of params.data.relatedPRs">
          <a [href]="pr.htmlUrl" target="_blank"
            >#{{ pr.number }} {{ pr.title }}</a
          >
          <span [class]="'status ' + pr.state">{{ pr.state }}</span>
        </div>
      </div>
      <div *ngIf="params.data.relatedIssues?.length" class="related-section">
        <h4>Related Issues</h4>
        <div *ngFor="let issue of params.data.relatedIssues">
          <a [href]="issue.htmlUrl" target="_blank"
            >#{{ issue.number }} {{ issue.title }}</a
          >
          <span [class]="'status ' + issue.state">{{ issue.state }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .relationship-detail {
        padding: 1rem;
      }
      .related-section {
        margin-bottom: 1rem;
      }
      .status {
        margin-left: 0.5rem;
        padding: 0.2rem 0.5rem;
        border-radius: 3px;
      }
      .status.open {
        background-color: #28a745;
        color: white;
      }
      .status.closed {
        background-color: #cb2431;
        color: white;
      }
    `,
  ],
})
export class RelationshipDetailComponent implements ICellRendererAngularComp {
  params!: RelationshipParams;

  agInit(params: RelationshipParams): void {
    this.params = params;
  }

  refresh(): boolean {
    return false;
  }
}

import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ModuleRegistry } from 'ag-grid-community';
import { ClientSideRowModelModule } from 'ag-grid-community';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

// Register AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    AgGridAngular,
    MatButtonModule,
    MatIconModule,
  ],

  template: `
    <div class="header">
      <button
        mat-raised-button
        color="primary"
        [routerLink]="['/github-integration']"
      >
        <mat-icon>integration_instructions</mat-icon>
        GitHub Integration
      </button>
    </div>

    <!-- The AG Grid component -->
    <ag-grid-angular
      [rowData]="rowData"
      [columnDefs]="colDefs"
      rowModelType="clientSide"
      class="ag-theme-alpine"
      style="width: 600px; height: 400px;"
    ></ag-grid-angular>
    <br />
    <router-outlet></router-outlet>
  `,
  styles: [
    `
      .header {
        padding: 16px;
        margin-bottom: 16px;
        display: flex;
        justify-content: flex-end;
      }
      .header button mat-icon {
        margin-right: 8px;
      }
    `,
  ],
})
export class AppComponent {
  title = 'Task 001';

  rowData = [
    { make: 'Tesla', model: 'Model Y', price: 64950, electric: true },
    { make: 'Ford', model: 'F-Series', price: 33850, electric: false },
    { make: 'Toyota', model: 'Corolla', price: 29600, electric: false },
  ];

  // Column Definitions: Defines the columns to be displayed.
  colDefs: ColDef[] = [
    { field: 'make' },
    { field: 'model' },
    { field: 'price' },
    { field: 'electric' },
  ];
}

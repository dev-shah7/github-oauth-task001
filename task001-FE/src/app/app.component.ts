import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular'; // Import AG Grid Component
import { ColDef, ModuleRegistry } from 'ag-grid-community'; // Import ModuleRegistry
import { ClientSideRowModelModule } from 'ag-grid-community'; // Import required module

// Register AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AgGridAngular],

  template: `
    <!-- The AG Grid component -->
    <ag-grid-angular
      [rowData]="rowData"
      [columnDefs]="colDefs"
      rowModelType="clientSide"
      class="ag-theme-alpine"
      style="width: 600px; height: 400px;"
    ></ag-grid-angular>
    <router-outlet />
  `,
  styles: [],
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

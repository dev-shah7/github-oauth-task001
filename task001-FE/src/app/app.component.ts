import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <h2>Task 001</h2>
    <router-outlet />
  `,
  styles: [],
})
export class AppComponent {
  title = 'Task 001';
}

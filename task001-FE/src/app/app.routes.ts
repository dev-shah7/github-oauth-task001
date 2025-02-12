import { Routes } from '@angular/router';
import { RepositoryRelationshipsComponent } from './components/repository-relationships/repository-relationships.component';
import { AppComponent } from './app.component';
import { OrganizationsComponent } from './components/organizations/organizations.component';
export const routes: Routes = [
  {
    path: '',
    component: OrganizationsComponent,
  },
  {
    path: 'relationships',
    component: RepositoryRelationshipsComponent,
  },
];

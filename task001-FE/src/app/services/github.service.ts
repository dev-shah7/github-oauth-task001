import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class GithubService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  syncAllData(): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/sync`, {}, { withCredentials: true })
      .pipe(
        catchError((error) => {
          console.error('Error syncing data:', error);
          return throwError(() => error);
        })
      );
  }
}

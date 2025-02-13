import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class GithubDetailsService {
  constructor(private http: HttpClient) {}

  getIssueDetails(
    owner: string,
    repo: string,
    issueNumber: number
  ): Observable<any> {
    return this.http.get(
      `${environment.apiUrl}/integrations/github/repos/${owner}/${repo}/issues/${issueNumber}/details`,
      { withCredentials: true }
    );
  }

  getCommitDetails(owner: string, repo: string, sha: string): Observable<any> {
    return this.http.get(
      `${environment.apiUrl}/integrations/github/repos/${owner}/${repo}/commits/${sha}/details`,
      { withCredentials: true }
    );
  }

  getPRDetails(owner: string, repo: string, prNumber: number): Observable<any> {
    return this.http.get(
      `${environment.apiUrl}/integrations/github/repos/${owner}/${repo}/pulls/${prNumber}/details`,
      { withCredentials: true }
    );
  }
}

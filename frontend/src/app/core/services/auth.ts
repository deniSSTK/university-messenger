import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment.development';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private http = inject(HttpClient);

  private apiUrl = environment.apiUrl;

  register(data: any) {
    return this.http
      .post(`${this.apiUrl}/auth/register`, data)
      .pipe(tap((response: any) => this.saveTokens(response)));
  }

  login(data: any) {
    return this.http
      .post(`${this.apiUrl}/auth/login`, data)
      .pipe(tap((response: any) => this.saveTokens(response)));
  }

  private saveTokens(response: any) {
    if (response && response.accessToken) {
      localStorage.setItem('accessToken', response.accessToken);
    }
    if (response && response.refreshToken) {
      localStorage.setItem('refreshToken', response.refreshToken);
    }
  }
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }
  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }
}

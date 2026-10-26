import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Chats } from './pages/chats/chats';

export const routes: Routes = [
  { path: '', redirectTo: 'chats', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  {
    path: 'chats',
    component: Chats,
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'login' },
];

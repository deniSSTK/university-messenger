import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { Login } from './domain/auth/ui/login/login';
import { Register } from './domain/auth/ui/register/register';
import { Chats } from './domain/chats/ui/chats/chats';

const routes: Routes = [
  { path: '', redirectTo: 'chats', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  {
    path: 'chats',
    component: Chats,
    canActivate: [authGuard],
  },
  { path: 'chats/:chatId', component: Chats, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' },
];

export { routes };

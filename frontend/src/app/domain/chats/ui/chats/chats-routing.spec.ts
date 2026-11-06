import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from '../../../../app.routes';
import { Chats } from './chats';
import { ChatService } from '../../service/chats';
import { Users } from '../../../users/service/users';
import { Auth } from '../../../auth/service/auth';

describe('direct chat URLs', () => {
  it('restores the session before loading a deep link and navigates back to the list', async () => {
    const restoreSession = vi.fn().mockResolvedValue(true);
    const get = vi.fn().mockImplementation(async (id: string) => ({
      id,
      person: { id: 'peer', username: 'alex', displayName: 'Alex' },
      lastMessage: null,
      activityAt: '2026-11-03T00:00:00Z',
    }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: Auth, useValue: { restoreSession, logout: vi.fn() } },
        { provide: Users, useValue: { search: () => of({ users: [], page: 1, totalPages: 0 }) } },
        {
          provide: ChatService,
          useValue: {
            list: async () => ({ chats: [], hasMore: false }),
            viewer: async () => ({ id: 'me', username: 'viewer', displayName: 'Me' }),
            get,
            history: async () => ({ messages: [], nextBefore: null }),
          },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/chats/saved-chat', Chats);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    harness.detectChanges();
    expect(restoreSession).toHaveBeenCalled();
    expect(get).toHaveBeenCalledWith('saved-chat');
    expect(component.selectedId()).toBe('saved-chat');
    expect(component.active()?.person.username).toBe('alex');
    const list = await harness.navigateByUrl('/chats', Chats);
    expect(list.selectedId()).toBeNull();
  });
});

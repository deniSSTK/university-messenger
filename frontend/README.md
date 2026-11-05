# University Messenger frontend

Angular application with `/login`, `/register`, protected `/chats`, and `/chats/:chatId`.
User search uses the real backend. Direct conversations and messages currently use a temporary demo repository.

## Run locally

Use Node.js **24.20.0** (also specified in `.nvmrc`). From this directory:

```bash
npm ci
npm start
```

Open http://localhost:4200. Start the backend using the instructions in the repository README.
Its `FRONTEND_ORIGIN` must match the frontend origin exactly; the default is
`http://localhost:4200`. Use the same hostname for frontend and API during local development
(`localhost` for both), so SameSite refresh cookies work. If testing from a phone, configure
the API URL and `FRONTEND_ORIGIN` with the development machine's reachable hostname/IP,
and serve Angular on that interface.

## API configuration

Set `apiUrl` in `src/environments/environment.development.ts` for `npm start` and in
`src/environments/environment.ts` for production builds. A same-origin path such as `/api`
is also supported when the web server proxies it to the backend. Production deployments
must provide the actual HTTPS API URL or proxy path. The checked-in default targets the
local backend at `http://localhost:3000`.

## Authentication

- Reactive Forms enforce backend limits: email up to 254 characters, username 3–32
  letters/numbers/underscores, display name 1–80 characters, password 8–128 characters.
- Email and display name are trimmed; email casing is preserved. Usernames are trimmed
  and lowercased. Passwords are passed unchanged; confirmation stays in the UI.
- API errors appear in the form. Submission is blocked while a request is running.
- Access tokens stay in memory. Refresh tokens are managed exclusively by the backend's
  HttpOnly cookie; auth requests include credentials.
- Startup restores the session through `POST /auth/refresh`. The `/chats` guard waits for
  restoration and redirects anonymous visitors to `/login`.
- Private API requests include the access token. A `401` triggers one shared refresh,
  followed by a retry, with at most three retries of the original request. New private
  requests wait for an ongoing refresh; late `401` responses reuse the newer token.
- A refresh `401` clears the session and redirects to login. Temporary network/server
  errors preserve session state. Public and foreign-origin requests never auto-refresh.
- Logout calls `POST /auth/logout` with bearer authentication and cookies, then clears
  local state and navigates to login. Temporary logout failures leave the session available
  and show an error so the user can retry.

## Structure

Features use `src/app/domain/<feature>/{ui,service,repository}`. UI owns forms and navigation;
services map use-case inputs and business errors; HTTP repository adapters own API DTOs,
requests, and transport-error translation. Repository interfaces are injected through tokens.
`src/app/core/http` supplies the shared HTTP client and session/refresh coordinator.

## Checks

```bash
npm run build
npm test -- --watch=false
```

Unit tests use Angular's HTTP testing backend and do not need a database. They cover forms,
payloads, errors, session restoration, guard decisions, logout, and concurrent refresh/retries.
For manual integration testing with a running backend: register or log in, verify `/chats`,
reload, wait for access-token expiry and make a private request, log out, and verify `/chats`
redirects to `/login`. Also test duplicate accounts, wrong passwords, revoked sessions,
server unavailability, and short mobile screens with validation errors visible.

## Search and temporary messaging

Search calls the existing `GET /users` through the shared authenticated HTTP client.
It trims whitespace, accepts an optional leading `@`, waits 300 ms after typing,
cancels obsolete searches, and supports pages of 20 results. Empty input returns to
the chat list without a search request. Loading, empty, error, and retry states are available.

The `CHATS_REPOSITORY` provider in `src/app/app.config.ts` currently uses
`ChatsMockAdapter`. This is a temporary browser mock, not a messaging backend. The UI does not show demo labels.
It uses the real `/auth/me` endpoint for the current account and stores only demo
participants and messages under `university-messenger.demo-chats.v1` in localStorage.
Tokens remain in memory/HttpOnly cookies. No initial sample conversations are seeded.
Demo data survives reloads and account changes within the same browser profile;
it is not shared between devices, and is not a secure server-side access boundary.
Remove that single storage key in browser developer tools to reset demo conversations.
Drafts remain in UI memory and are separate for each account and conversation.

Click a search result to open or reuse its dialog. The chat list loads in pages of 20,
message history in pages of 30, with older-history loading preserving the scroll position.
Use the refresh buttons to retrieve changes. Enter sends a message, Shift+Enter adds
a newline; whitespace-only input and text longer than 4000 characters are rejected.
Failures preserve drafts. Desktop shows list and dialog together; mobile uses the chat
URL and a back button. Messages are rendered as plain text, including line breaks.

Run `npm run build` and `npm test -- --watch=false` from `frontend/`.
Search HTTP tests use `HttpTestingController`; messaging tests cover the temporary
adapter, membership checks, pagination, stale responses, switching, drafts, sends,
rendering, and error/retry behavior. Existing auth/session tests remain in place.

To try the demo, run the existing backend and frontend, create two accounts, find
one by username, and send a message. Log in as the other account in the same browser
profile, then open or refresh the list and dialog to reply. Reload the chat URL to
check restoration. Check desktop and narrow mobile widths, long text, history loading,
and offline errors. Real backend messaging integration and a two-device conversation
check remain pending until the messaging API and its contracts are available.

When the backend is ready, implement an HTTP adapter for `ChatsRepository`, keep its
HTTP DTOs inside that adapter, and replace the provider binding. Do not reuse the mock
storage format as a backend API contract. No chat/message HTTP endpoints are assumed
or called by this temporary adapter.

The chat layout follows Telegram's desktop/mobile arrangement while keeping the
existing white, blue, and slate palette. The account menu contains logout and the
demo explanation. The dialog has grouped bubbles, day separators, an expanding
composer, and a jump-to-latest button. Refresh controls load data explicitly;
no online or delivery states are simulated.

Refresh fills intermediate history pages until it reaches the newest already-known
message, so large incoming batches do not leave gaps. Older-history retries reuse
the failed cursor, and scroll anchoring is captured after a response to preserve
any scrolling performed while the request was pending. Repeated chat-list requests
retry the same page. Regression tests cover these cases.

Manual local UI check (2026-11-04): searched for an existing second local account
using `@` and mixed case, opened the same demo chat, sent a multiline message,
verified its list preview, tested mobile back/list/dialog navigation and account
menu, and reloaded the deep link with cookie-based session restoration. The demo
message persisted. This check used the real authentication/search backend and the
temporary messaging repository; real server-side messaging and two-device delivery
are still pending. Desktop and mobile layouts were inspected with browser viewport
sizes of 1440×900 and 390×844.

Typography uses the self-hosted Open Sans variable font in `public/fonts`, with its
SIL Open Font License alongside it. No third-party font requests are made at runtime.
The conversation background uses the shared `$chat-bg` palette variable.

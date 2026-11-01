# University Messenger frontend

Angular application with `/login`, `/register` and the protected `/chats` placeholder.

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

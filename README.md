# University Messenger

A full stack web messenger for direct communication. Users will be able to find each other, exchange messages in real time, and access their conversation history from a computer or phone.

The messenger is being developed as a university semester project. The team's goal is to complete the full development cycle: interface and API design, implementation, testing, automated builds, and server deployment.

## Current Status

The backend foundation, authentication API, user search API, and Angular authentication client are implemented in `main`. Direct conversations and messaging are still planned.

Completed:

- NestJS backend with typed environment validation, request validation, and Swagger documentation.
- PostgreSQL configuration through Docker Compose, Prisma models for users, sessions, chats, and messages, and database migrations, including a username prefix search index.
- Registration, login, refresh token rotation, logout, and current-user endpoints, with password hashing, session checks, and HttpOnly refresh cookies.
- Protected user search by username prefix, with pagination and exclusion of the current user and deleted accounts.
- Auth unit tests, HTTP and Swagger tests, and PostgreSQL integration scenarios. Database tests require `TEST_DATABASE_URL`.
- Angular registration and login forms connected to the API, validation and error messages, logout, in-memory access tokens, cookie-based session restoration, shared token refresh/retries, and a protected `/chats` route.
- Responsive auth forms and a chat layout prototype, plus unit tests for forms, auth API adapters, route protection, session restoration, logout, and concurrent refresh handling. The chat list is static sample data and the search field is not connected to the API.

Still planned: connecting frontend user search, working chat/message screens, profile editing and avatars, direct conversation and message APIs, real-time delivery, message editing and deletion, read receipts, unread counts, typing indicators, CI/CD, and deployment. Backend user search test coverage also remains to be added.

The next implementation areas are the backend API for direct conversations and messages, including a chat membership guard, and the frontend user search and messaging interface connected to that API.

## Core Features

The following sections describe the target scope; see Current Status and Development Roadmap for implementation progress.

### Account and Profile

- Registration with an email address and password.
- Sign in and sign out.
- A unique username for finding users and starting conversations.
- Editable display name and avatar.

### User Search

- Search by username.
- Start a direct conversation from search results.
- Open the existing conversation when contacting the same user again.

### Direct Messages

- Exchange text messages in real time.
- Store conversation history in the database.
- Load older messages while scrolling.
- Edit and delete your own messages.
- Display message timestamps and an edited indicator.

### Conversation Activity

- A conversation list with the latest message in each chat.
- Conversations sorted by recent activity.
- Unread message counts.
- Read receipts.
- A typing indicator.

### User Interface

- Responsive layouts for computers and phones.
- Registration, sign-in, profile, and conversation screens.
- Loading, empty conversation list, and error states.
- Connection loss notifications and automatic reconnection.

## Stretch Goal

After completing the core version, add image and file sharing with file size limits. This will require attachment uploads, storage, and access control.

The core version includes direct conversations only. Group chats, channels, calls, bots, reactions, push notifications, and end-to-end encryption are outside the project scope.

## Technology and Architecture

| Component         | Technologies and Purpose                                   | Status                       |
| ----------------- | ---------------------------------------------------------- | ---------------------------- |
| Backend           | TypeScript, Node.js, NestJS - API and server logic         | Auth, user search, and Swagger implemented |
| Database          | PostgreSQL, Prisma - data storage and migrations           | Models, migrations, and user search index implemented |
| Local Environment | Docker Compose - local PostgreSQL                          | Prepared                     |
| Frontend          | Angular, TypeScript - responsive web interface             | Auth API integration and responsive chat layout prototype implemented |
| Messaging         | WebSocket - real-time messages and conversation events     | Planned                      |
| Testing           | Jest, Supertest - unit and end-to-end tests                | Auth unit, HTTP, and database scenarios |
| Frontend Testing  | Vitest, Angular HTTP testing utilities                    | Auth, forms, guards, and refresh tests implemented |
| CI/CD             | GitHub Actions - checks, builds, and deployment automation | Planned                      |

The Angular frontend will use the backend HTTP API for accounts, profiles, conversation lists, and message history. A WebSocket connection will deliver new messages, read receipts, and typing events. PostgreSQL will store users, conversations, and messages.

Authentication and conversation membership checks must be enforced on the server for both HTTP requests and WebSocket events. Passwords must be stored as hashes. Only the author of a message will be able to edit or delete it.

## Repository Structure

```text
.
├── backend/              # NestJS, Prisma, and local database configuration
│   ├── prisma/           # Database schema and migrations
│   ├── src/              # Backend source code
│   │   ├── common/       # Shared utilities
│   │   ├── core/         # Typed configuration and shared pagination DTOs
│   │   ├── modules/      # Auth and users feature modules
│   │   └── prisma/       # Prisma client lifecycle and dependency injection
│   ├── test/             # End-to-end tests
│   ├── .env.example      # Example environment variables
│   └── docker-compose.yml
├── frontend/             # Angular client with auth and a chat layout prototype
│   ├── src/app/core/     # Shared HTTP client, session handling, and route guards
│   ├── src/app/domain/   # Auth feature and chat UI prototype
│   ├── src/environments/ # Development and production API configuration
│   └── README.md         # Frontend setup and authentication details
├── AGENTS.md             # Repository-wide development rules
├── LICENSE
└── README.md
```

The backend and frontend share a single repository and are both available in `main`. Install dependencies and run commands from each application's directory. See [frontend/README.md](frontend/README.md) for additional client setup and authentication details.

## Backend Module Structure

Features live under `backend/src/modules/<feature>/`:

```text
auth/
├── domain/         # Models, domain errors, repository interfaces, and ports
├── repository/     # Prisma implementation of repository contracts
├── service/        # Use cases, service inputs/results, and auth service adapters
├── delivery/http/  # Controllers, guards, HTTP DTOs, Swagger, and error mapping
└── auth.module.ts  # Dependency wiring
```

HTTP DTOs are mapped to service inputs. Services depend on ORM-independent repository
interfaces and return application results; delivery maps those results to HTTP responses.
Domain contracts do not import Prisma or NestJS. Prisma-specific queries and transaction
clients stay inside the repository implementation. Transaction callbacks expose repository
operations rather than the underlying client. Unit tests for services mock the domain ports.

HTTP controllers read input according to where the client sends it:

| Decorator | Source | Example |
| --- | --- | --- |
| `@Body()` | JSON request body | Registration, login, or a future message payload |
| `@Param()` | URL path parameters | A future `/messages/:id` route |
| `@Query()` | URL query parameters | A future `/users?search=alice` request |
| `@Req()` | Request context | Refresh cookie or the session attached by a guard |

These decorators can be combined in one endpoint. Request objects, cookies, and Express
response objects stay in delivery; services receive explicit application inputs.
For auth, `setAuthCookieAndBuildResponse` writes the refresh token to an HttpOnly cookie
and maps the service result to a JSON response containing the user and access token.
It is a private helper shared by register, login, and refresh.

## Running the Backend Locally

These instructions cover the backend. Frontend startup instructions follow below.

### Requirements

- Node.js `24.20.0`.
- npm `>=10.2.4`.
- Docker with Docker Compose support and a running Docker Engine.

From the repository root, open the backend directory. Run all subsequent commands there:

```bash
cd backend
```

### Installation and Startup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

   The `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT` variables configure the PostgreSQL connection. The example values are intended for local development.

   Replace the `JWT_SECRET=secret` placeholder with a random secret of at least 32 bytes.
   Generate a value with `openssl rand -hex 32` and copy it into `.env` before starting the server.

3. Start the database and wait until it is ready:

   ```bash
   docker compose up -d --wait db
   ```

4. Generate Prisma Client and apply existing migrations:

   ```bash
   npm run prisma:generate
   npm run migrate:apply
   ```

5. Start the backend in development mode:

   ```bash
   npm run start:dev
   ```

By default, the server listens at `http://localhost:3000`, and PostgreSQL is available at `localhost:6012`.
Authentication endpoints are available under `/auth`, and user search is available at `GET /users`; the messaging API is planned. The root `/` has no endpoint.

### Environment Configuration

Runtime settings are loaded and validated in `backend/src/core/config` and injected through `AppConfig`.
Prisma CLI reuses the database config reader without requiring JWT settings.

| Variable | Purpose | Default or example |
| --- | --- | --- |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Required PostgreSQL credentials and database name | Local values in `.env.example` |
| `DB_HOST` | PostgreSQL host | Defaults to `localhost` |
| `DB_PORT` | PostgreSQL port | Defaults to `5432`; local Compose example uses `6012` |
| `PORT` | HTTP server port | Defaults to `3000` |
| `NODE_ENV` | Environment; `production` enables Secure refresh cookies | Example: `development` |
| `FRONTEND_ORIGIN` | Allowed frontend origin; HTTPS required in production | Defaults to `http://localhost:4200` |
| `JWT_SECRET` | Required signing secret, at least 32 bytes | Generate your own value |
| `JWT_ACCESS_TOKEN_TTL` | Required access token lifetime in seconds | `900` (15 minutes) |
| `JWT_SESSION_TTL` | Required session lifetime in milliseconds | `604800000` (7 days) |

Both TTL values must be positive safe integers. Email casing is preserved; email lookup and uniqueness are case-insensitive.
Usernames are trimmed and converted to lowercase. Passwords are not trimmed or lowercased.

### API Documentation

Swagger UI is available at [http://localhost:3000/docs](http://localhost:3000/docs),
and the OpenAPI JSON specification is available at [http://localhost:3000/docs-json](http://localhost:3000/docs-json).

Register or log in through the API, then paste the returned `accessToken` into Swagger's **Authorize** dialog for protected endpoints.
The API sets an HttpOnly `refreshToken` cookie automatically. Swagger UI sends that cookie when refreshing the session; it cannot be entered manually.
Frontend requests must include credentials (`credentials: 'include'` with fetch or `withCredentials: true` with Angular HttpClient).
Refreshing rotates the refresh token without extending the configured session lifetime. Logging out revokes the current session.

### Authentication API

| Endpoint | Input | Successful response |
| --- | --- | --- |
| `POST /auth/register` | JSON: `email`, `username`, `displayName`, `password` | `201`: user and access token; refresh cookie |
| `POST /auth/login` | JSON: `email`, `password` | `200`: user and access token; refresh cookie |
| `POST /auth/refresh` | `refreshToken` cookie; no JSON body required | `200`: user and new access token; rotated refresh cookie |
| `POST /auth/logout` | `Authorization: Bearer <accessToken>` | `204`: current session revoked and refresh cookie cleared |
| `GET /auth/me` | `Authorization: Bearer <accessToken>` | `200`: current public user |

Register, login, and refresh return `{ user, accessToken, tokenType, expiresIn }`.
`expiresIn` is measured in seconds. The public user contains `id`, `email`, `username`,
`displayName`, `createdAt`, and `updatedAt`. Refresh tokens are sent in an HttpOnly cookie,
not in the JSON body. Password hashes and token hashes are never returned.

Access tokens require an active, unexpired session. Logging out invalidates both token types
for that session; other sessions remain active. Deleted users cannot log in, refresh, or use protected endpoints.
Validation errors return `400`, invalid credentials or tokens return `401`, untrusted browser
origins return `403` for auth POST requests, and duplicate email or username returns `409`.
Field restrictions and schemas are available in Swagger.

### User Search API

`GET /users?search=alice&page=1&limit=20` requires `Authorization: Bearer <accessToken>`.
It searches by username prefix, ignoring case. The required `search` value is trimmed,
lowercased, and may start with one optional `@`; after normalization it must contain
1–32 letters, digits, or underscores.

Pagination defaults to `page=1` and `limit=20`. Page numbers range from 1 to 1,000,000,
and limits range from 1 to 100. Results exclude the current user and deleted accounts
and are sorted by username, then id, ascending.

The response is `{ items, meta: { page, limit, total, totalPages } }`, where each item
contains only `id`, `username`, and `displayName`. Empty results and out-of-range pages
return `200` with an empty `items` array. Invalid or unexpected query parameters return
`400`; missing or invalid authentication returns `401`.

### Testing

Generate Prisma Client before running checks. Service unit tests mock domain ports;
repository unit tests verify query restrictions and transaction routing, and HTTP tests verify transport mapping and Swagger.

```bash
npm test -- --runInBand
npm run build
npx eslint "{src,apps,libs,test}/**/*.ts"
```

To include the PostgreSQL auth scenarios, start the local database and provide a connection URL:

```bash
TEST_DATABASE_URL='postgresql://messenger-user:secret@localhost:6012/messenger-db' npm run test:e2e -- --runInBand
```

Use credentials matching your local database. The database user needs permission to create schemas.
Tests apply migrations inside a fresh schema and remove that schema afterward.
Without `TEST_DATABASE_URL`, the PostgreSQL auth suite is skipped; the remaining HTTP tests still run.

### Stopping the Database

To stop the local database:

```bash
docker compose down
```

Database data persists in a Docker volume between runs.

### Common Commands

| Command                                | Purpose                                                           |
| -------------------------------------- | ----------------------------------------------------------------- |
| `npm run start:dev`                    | Start the backend in watch mode                                   |
| `npm run build`                        | Build the backend                                                 |
| `npm test`                             | Run unit tests                                                    |
| `npm run test:e2e`                     | Run end-to-end tests                                              |
| `npm run test:cov`                     | Generate a test coverage report                                   |
| `npm run lint`                         | Check code with ESLint and apply automatic fixes                  |
| `npm run format`                       | Format source code and tests                                      |
| `npm run prisma:generate`              | Format the schema and generate Prisma Client                      |
| `npm run migrate:new -- --name <name>` | Create a migration without applying it; starts the local database |
| `npm run migrate:apply`                | Apply existing migrations                                         |

## Running the Frontend Locally

The Angular application is available in `frontend/` on `main`.

From the repository root, using Node.js `24.20.0`:

```bash
cd frontend
npm ci
npm start
```

Open [http://localhost:4200](http://localhost:4200) with the backend running at `http://localhost:3000`.
The app provides `/login`, `/register`, and a protected `/chats` layout prototype.
Registration and login call the backend; the chat entries are static examples, and the search input has no API integration yet.

Configure `apiUrl` in `frontend/src/environments/environment.development.ts` for local development
and `frontend/src/environments/environment.ts` for production. The backend's `FRONTEND_ORIGIN`
must match the frontend origin. Use `localhost` for both services locally so refresh cookies work.
Access tokens stay in memory; session restoration uses the backend's HttpOnly cookie.

Frontend checks, from `frontend/`:

```bash
npm run build
npm test -- --watch=false
```

Frontend tests mock HTTP requests and do not require PostgreSQL. Use the documented Node.js version:
Node.js `22.19.0` is below the Angular CLI minimum and cannot run the frontend build or test commands.

## Deployment and Quality

By the end of the project, the frontend, backend, and PostgreSQL will be deployed on a server, with the application accessible over HTTPS. Data must persist across restarts and application updates. Secrets must be supplied through environment variables.

GitHub Actions will run checks and builds when code changes. The deployment process must include database migrations. A link to the running messenger and deployment instructions will be added once the environment is ready.

Key testing scenarios include registration and sign-in, access restricted to a user's own conversations, sending and receiving messages, and message editing and deletion restricted to the author.

## Development Roadmap

- [x] Prepare the NestJS backend foundation.
- [x] Configure Prisma and local PostgreSQL through Docker Compose.
- [x] Design user, session, conversation, and message models.
- [x] Implement registration, login, refresh, logout, and current-user endpoints.
- [x] Document auth and user search endpoints in Swagger.
- [x] Implement user search by username prefix with pagination.
- [x] Add auth unit tests, HTTP/Swagger tests, and PostgreSQL integration scenarios.
- [x] Implement Angular registration, login, logout, session restoration, and protected routing.
- [x] Add a responsive chat layout prototype and frontend auth/session tests.
- [x] Merge the Angular authentication client into `main`.
- [ ] Connect frontend user search to the existing API.
- [ ] Implement profile editing.
- [ ] Implement direct conversations.
- [ ] Add real-time messaging and conversation history.
- [ ] Add message editing, deletion, and read receipts.
- [ ] Add typing indicators and unread message counts.
- [ ] Replace sample chats with real data and implement responsive conversation/history/message screens connected to the backend.
- [ ] Add user search tests and cover conversation and messaging scenarios as they are implemented.
- [ ] Configure CI/CD and deploy the application over HTTPS.
- [ ] Add image and file attachments if time permits.

## Team

| Member                                        | Role                             |
| --------------------------------------------- | -------------------------------- |
| [deniSSTK](https://github.com/deniSSTK)       | Team Lead / Full Stack Developer |
| [Maksimk9245](https://github.com/Maksimk9245) | Developer                        |
| [Syd-Ma](https://github.com/Syd-Ma)           | Developer                        |

The Team Lead coordinates the team, aligns architecture and tasks, reviews code, and contributes to development. Feature implementation, testing, and release preparation are shared across the team.

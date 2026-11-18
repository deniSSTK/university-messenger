# University Messenger

A full stack web messenger for direct communication. Users can find each other, exchange messages in real time, and access their conversation history from a computer or phone.

The messenger is being developed as a university semester project. The team's goal is to complete the full development cycle: interface and API design, implementation, testing, automated builds, and server deployment.

## Current Status

The backend and Angular client implement authentication, profiles with avatars, user search, private conversations, real-time updates, message history, message editing/deletion, unread counts, read receipts, typing indicators, and image/file sharing. CI checks and production deployment configuration are included. A public server has not yet been configured.

Completed:

- NestJS backend with typed environment validation, request validation, and Swagger documentation.
- PostgreSQL configuration through Docker Compose, Prisma models for users, sessions, chats, and messages, and database migrations, including a username prefix search index.
- Registration, login, refresh token rotation, logout, and current-user endpoints, with password hashing, session checks, and HttpOnly refresh cookies.
- Protected user search by username prefix, with pagination and exclusion of the current user and deleted accounts.
- Auth unit tests, HTTP and Swagger tests, and PostgreSQL integration scenarios. Database tests require `TEST_DATABASE_URL`.
- Angular registration and login forms connected to the API, validation and error messages, logout, in-memory access tokens, cookie-based session restoration, shared token refresh/retries, and a protected `/chats` route.
- Responsive auth forms and messaging screens, with user search, chat lists, conversation details, history, and sending connected to the HTTP API. Frontend tests cover auth, session handling, and chat interactions.

Also completed:

- Editable display names and PNG/JPEG/WebP avatars up to 256 KiB; avatar objects are stored in private S3.
- Authenticated WebSocket notifications, automatic reconnection with session refresh, history synchronization after reconnect, and connection-loss notifications.
- Author-only message editing/deletion, edited timestamps, unread counts, read receipts, and expiring typing indicators.
- Automatic older-history loading while scrolling, with a manual pagination fallback.
- Image and file uploads up to 5 MiB and authenticated downloads restricted to chat members.
- Unit, HTTP, PostgreSQL and WebSocket tests for new functionality, including user search exclusions and literal underscore prefixes.
- GitHub Actions checks, container builds, and an optional manual SSH deployment job; Docker Compose applies migrations before starting the API, and Caddy serves the client over HTTPS.

Pending infrastructure: configure the production server/domain and GitHub deployment secrets, then run the first deployment.

Private conversations are restricted to their members by the backend. WebSocket notifications synchronize active history and conversation lists after sends, edits, deletions, and read updates. A message is marked read only through the newest displayed message while the page is visible and the conversation is at the bottom. Typing indicators expire after four seconds without another event.

## Core Features

The following sections describe the implemented application scope; see Deployment and Quality for remaining infrastructure setup.

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

Image and file sharing is implemented with a 5 MiB limit per file. Binary content is stored in a private S3 bucket. PostgreSQL stores object keys, names, MIME types and sizes; back up both the database and the bucket. Downloads require an active session and chat membership; deleted messages cannot be downloaded. Files download as attachments rather than executing or rendering active content in the app.

Voice messages reuse private chat attachments and support recordings up to 5 MiB and five minutes. Hold the microphone in the empty composer, release to preview, then send. Drag left while holding to cancel. Open the chat in a second account to verify real-time delivery, then reload it to verify playback from history. The browser needs microphone permission and HTTPS or localhost.

The backend needs `ffmpeg` and `ffprobe` on PATH for voice uploads and the related end-to-end tests. The backend Docker image includes both. They validate WebM/Opus, MP4/AAC and Ogg/Opus, derive duration and waveform from decoded audio, and remux the original compressed audio for seeking. Apply Prisma migrations before starting the updated API. Voice files use the same private S3 configuration as other attachments.

A private chat’s profile opens from the participant’s name. Its shared media counts and cursor-paginated lists include available photos, videos, files, audio, voice messages, and GIFs across the full conversation. The Delete user action hides the conversation and clears the signed-in member’s view of its current history, attachments, and unread messages. The other participant retains their history. Sending or receiving a new message shows the conversation again with only messages after the clear.

The core version includes direct conversations only. Group chats, channels, calls, bots, reactions, push notifications, and end-to-end encryption are outside the project scope.

## Technology and Architecture

| Component         | Technologies and Purpose                                   | Status                                                         |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| Backend           | TypeScript, Node.js, NestJS - API and server logic         | Auth, user search, and private chat APIs documented in Swagger |
| Database          | PostgreSQL, Prisma - data storage and migrations           | Models, migrations, and user search index implemented          |
| Local Environment | Docker Compose - local PostgreSQL                          | Prepared                                                       |
| Frontend          | Angular, TypeScript - responsive web interface             | Auth, user search, and direct messaging connected to the API   |
| Messaging         | WebSocket - real-time messages and conversation events     | Implemented                                                    |
| Testing           | Jest, Supertest - unit and end-to-end tests                | Auth unit, HTTP, and database scenarios                        |
| Frontend Testing  | Vitest, Angular HTTP testing utilities                     | Auth, search, and chat tests                                   |
| CI/CD             | GitHub Actions - checks, builds, and deployment automation | Implemented                                                    |

The Angular frontend uses HTTP for authentication, user search, and direct messaging. PostgreSQL stores users, conversations, and messages. WebSocket notifications synchronize new messages, edits/deletions, unread counts and read receipts; typing events are transient.

Authentication and conversation membership checks must be enforced on the server for both HTTP requests and WebSocket events. Passwords must be stored as hashes. Only the author of a message can edit or delete it.

## Repository Structure

```text
.
├── backend/              # NestJS, Prisma, and local database configuration
│   ├── prisma/           # Database schema and migrations
│   ├── src/              # Backend source code
│   │   ├── common/       # Shared utilities
│   │   ├── core/         # Typed configuration and shared pagination DTOs
│   │   ├── modules/      # Auth, users, and chats feature modules
│   │   └── prisma/       # Prisma client lifecycle and dependency injection
│   ├── test/             # End-to-end tests
│   ├── .env.example      # Example environment variables
│   └── docker-compose.yml
├── frontend/             # Angular client with auth, user search, and direct messaging
│   ├── src/app/core/     # Shared HTTP client, session handling, and route guards
│   ├── src/app/domain/   # Auth, users, and chats features
│   └── src/environments/ # Development and production API configuration
├── pkg/events/           # Shared WebSocket event enum (ESM/CommonJS)
├── AGENTS.md             # Repository-wide development rules
├── LICENSE
└── README.md
```

Shared WebSocket event names live in `pkg/events/src/websocket-event-type.ts`, exported by the local `@university-messenger/events` package. Backend and frontend import the same enum; installation/build/test scripts compile the shared package automatically. See [shared package instructions](pkg/README.md). Docker builds use the repository root as their context (`docker build -f backend/Dockerfile .` or `docker build -f frontend/Dockerfile .`).

The backend and frontend share a single repository. Install dependencies and run commands from each application's directory.

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

| Decorator  | Source               | Example                                           |
| ---------- | -------------------- | ------------------------------------------------- |
| `@Body()`  | JSON request body    | Registration, login, or a message payload         |
| `@Param()` | URL path parameters  | `chatId` in `/chats/:chatId`                      |
| `@Query()` | URL query parameters | `/users?search=alice`                             |
| `@Req()`   | Request context      | Refresh cookie or the session attached by a guard |

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
Authentication endpoints are available under `/auth`, user search at `GET /users`, and private conversations and messages under `/chats`.

### Environment Configuration

Runtime settings are loaded and validated in `backend/src/core/config` and injected through `AppConfig`.
Prisma CLI reuses the database config reader without requiring JWT settings.

| Variable                            | Purpose                                                          | Default or example                                    |
| ----------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Required PostgreSQL credentials and database name                | Local values in `.env.example`                        |
| `DB_HOST`                           | PostgreSQL host                                                  | Defaults to `localhost`                               |
| `DB_PORT`                           | PostgreSQL port                                                  | Defaults to `5432`; local Compose example uses `6012` |
| `PORT`                              | HTTP server port                                                 | Defaults to `3000`                                    |
| `NODE_ENV`                          | Environment; `production` enables Secure refresh cookies         | Example: `development`                                |
| `AUTH_COOKIE_PATH`                  | Refresh cookie path; use `/api/auth` behind the production proxy | Defaults to `/auth` locally                           |
| `FRONTEND_ORIGIN`                   | Allowed frontend origin; HTTPS required in production            | Defaults to `http://localhost:4200`                   |
| `JWT_SECRET`                        | Required signing secret, at least 32 bytes                       | Generate your own value                               |
| `JWT_ACCESS_TOKEN_TTL`              | Required access token lifetime in seconds                        | `900` (15 minutes)                                    |
| `JWT_SESSION_TTL`                   | Required session lifetime in milliseconds                        | `604800000` (7 days)                                  |

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

| Endpoint              | Input                                                | Successful response                                       |
| --------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| `POST /auth/register` | JSON: `email`, `username`, `displayName`, `password` | `201`: user and access token; refresh cookie              |
| `POST /auth/login`    | JSON: `email`, `password`                            | `200`: user and access token; refresh cookie              |
| `POST /auth/refresh`  | `refreshToken` cookie; no JSON body required         | `200`: user and new access token; rotated refresh cookie  |
| `POST /auth/logout`   | `Authorization: Bearer <accessToken>`                | `204`: current session revoked and refresh cookie cleared |
| `GET /auth/me`        | `Authorization: Bearer <accessToken>`                | `200`: current public user                                |

Register, login, and refresh return `{ user, accessToken, tokenType, expiresIn }`.
`expiresIn` is measured in seconds. The public user contains `id`, `email`, `username`,
`displayName`, `avatarUrl`, `createdAt`, and `updatedAt`. Refresh tokens are sent in an HttpOnly cookie,
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

To include the PostgreSQL auth and chat scenarios, start the local database and provide a connection URL:

```bash
TEST_DATABASE_URL='postgresql://messenger-user:secret@localhost:6012/messenger-db' npm run test:e2e -- --runInBand
```

Use credentials matching your local database. The database user needs permission to create schemas.
Tests apply migrations inside a fresh schema and remove that schema afterward.
Without `TEST_DATABASE_URL`, Jest skips the PostgreSQL suites and runs the remaining HTTP tests.

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
The app provides `/login`, `/register`, protected `/chats`, and direct conversation URLs at `/chats/:chatId`. Conversation and message data is loaded from PostgreSQL through the backend API.

Configure `apiUrl` in `frontend/src/environments/environment.development.ts` for local development.
The production build uses `/api` on the same HTTPS origin; Caddy forwards it to the backend. The backend's `FRONTEND_ORIGIN`
must match the frontend origin. Use `localhost` for both services locally so refresh cookies work.
Access tokens stay in memory; session restoration uses the backend's HttpOnly cookie.

Frontend checks, from `frontend/`:

```bash
npm run build
npm test -- --watch=false
```

Frontend tests mock HTTP requests and do not require PostgreSQL. Use the documented Node.js version:
Node.js `22.19.0` is below the Angular CLI minimum and cannot run the frontend build or test commands.

A double click toggles the saved default message reaction. Right-click or touch and hold a message to choose from seven reactions. New users default to HEART and can change it in their profile. Each user has one reaction per message. Updating a reaction uses `PUT /chats/:chatId/messages/:messageId/reaction`, with `type: null` to remove it. Connected participants receive `message:reaction:update` with their own selection and a version for ordering. History includes reaction state.

Message replies accept an optional `replyToId` on the text, attachment, and voice send endpoints. The target must be visible to the sender and belong to the same chat. Send responses and message history return a `reply` preview. A deleted or cleared original has a null author and an empty preview. The existing `changed` WebSocket event can include `messageId` and a recipient-filtered `reply`; clients continue to synchronize history through the authorized API.

Private nicknames appear beside incoming authors’ display names and can be edited from the chat header menu. `GET /users/me/aliases` lists them, `PUT /users/me/aliases/:targetUserId` saves a `nickname` and palette `color`, and `DELETE` on that path removes the nickname. The authenticated user owns every alias returned or modified by these endpoints.

## API rate limits

`@RateLimit(count, RateLimitPeriod.MINUTE)` sets a fixed window per endpoint and authenticated user. Public auth endpoints use the client IP, grouping IPv6 clients by /64. A rejected request returns HTTP 429 and `Retry-After` in seconds.

| Endpoint | Requests per minute |
| --- | ---: |
| Register / log in / refresh | 10 / 15 / 60 |
| Update profile / search users | 12 / 90 |
| List / save / delete private nicknames | 60 / 30 / 30 |
| Open chat / count shared media | 30 / 60 |
| Send text / upload file / send voice / react | 90 / 20 / 12 / 90 |
| Download attachment / read message history | 180 / 240 |

The in-memory store applies per backend process and resets on a restart. `RATE_LIMIT_MAX_CLIENTS` defaults to 2048 identities per endpoint. At capacity, new identities receive 429 until entries expire. Use a shared store before running multiple replicas if a deployment-wide quota is required.

`TRUST_PROXY_HOPS` defaults to 0 for direct access. The production Compose configurations default to 1 because the API is reachable externally only through Caddy. Keep the API port unpublished with this setting. WebSocket clients send authentication and typing events. Message creation uses the HTTP routes above.

## S3 Object Storage

Messages reference an optional `Attachment`, with `AttachmentVoice` holding duration and waveform for recordings. The migration copies and checks the old columns in one transaction before removing them. It keeps `Message.voiceRequestId`, stored S3 keys and any remaining legacy bytes. The authenticated HTTP response remains unchanged.

Before upgrading an existing deployment, stop the old backend, apply the migrations with the new image, run the legacy media migration if needed, and start the new backend. The AWS workflow already follows this order. For manual Compose upgrades, use the same sequence. Rolling back to a backend that reads the old columns requires restoring a compatible database backup.

New attachments and avatars are uploaded to private S3. PostgreSQL holds `Attachment.fileKey` and `User.avatarKey`, plus metadata. Failed database writes trigger object cleanup. Attachments download through the existing authenticated API, which verifies chat membership before reading S3. Avatar responses contain temporary signed GET URLs; internal object keys are not exposed as response fields. Signed avatar links expire after `S3_SIGNED_URL_TTL_SECONDS` (default 900 seconds); they are refreshed when profile/chat data is loaded again.

Configure `S3_BUCKET`, `S3_REGION`, and optionally `S3_SIGNED_URL_TTL_SECONDS` in the backend environment. A bucket must be explicitly supplied in production. The backend uses the [AWS SDK default credential chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html): locally use an AWS profile or standard AWS credential environment variables; on EC2 assign an instance IAM role. No AWS credentials are sent to Angular or committed. A private bucket needs no browser upload CORS policy because uploads/downloads pass through the backend.

Create an S3 bucket in your chosen region, keep Block Public Access enabled, and use the default SSE-S3 encryption. Adapt `deploy/s3-policy.example.json` to the bucket name and attach it to the application's IAM role; it limits Get/Put/Delete to `attachments/*` and `avatars/*`. See [S3 default encryption](https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-encryption-faq.html). When using an EC2 role from Docker with IMDSv2, configure the instance metadata response hop limit to 2 as described in [AWS container metadata guidance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html). Bucket creation and IAM setup are intentionally left for deployment.

For local S3-compatible storage, set `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE=true`, plus the provider's credentials through the same AWS environment variables. Custom production endpoints must use HTTPS. Development without an S3 connection still supports text messaging; file operations return `503` on storage failure and preserve the form for retry.

### Moving existing database files

The additive database migration preserves existing `fileData` and data-URL avatars. New writes never use those payload columns. To move existing content:

```bash
cd backend
npm run migrate:apply
npm run build
npm run media:migrate
```

The migration uses only database/storage configuration, without requiring JWT secrets. It uploads in small batches, stores each key and clears that row's old binary/base64 payload only after a successful upload. Failed rows retain their original data; rerunning skips rows already migrated. Run it during a maintenance window with application writers stopped, and take a database backup first. Legacy reads remain supported until migration is complete. Soft-deleted message objects remain retained; downloading them is blocked by the API. Object retention/lifecycle cleanup can be configured separately when a retention policy is chosen.

For Docker, after database migrations and before starting application writers:

```bash
docker compose --env-file .env.production -f compose.aws.yml run --rm --no-deps backend npm run media:migrate
```

### Shared frontend controls and SVGs

Buttons, text inputs/textareas, form fields, file pickers, avatars, modal dialogs, auth cards and spinners live in `frontend/src/app/shared/ui/`. Auth and chat screens consume these components; native button/input components preserve existing form validation and keyboard behavior. SVGs each have their own Angular component under `shared/ui/icons/`. See the [UI component guide and requested SVG list](frontend/src/app/shared/ui/README.md).

## Profile, Messages and Activity API

All endpoints below require `Authorization: Bearer <accessToken>`. Missing sessions return `401`, invalid input returns `400`, and inaccessible chats/messages return `404` without revealing another user's resources. Request and response schemas are in Swagger.

| Endpoint                                            | Behavior                                                                                                                                                                                                                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PATCH /users/me`                                   | JSON `{ displayName, avatarUrl? }`; omit avatarUrl to preserve the current avatar, send null to remove it; name is trimmed and limited to 1–64 characters. Avatar is null or a PNG/JPEG/WebP base64 data URL, at most 256 KiB decoded. Returns the updated public profile. |
| `POST /chats`                                       | JSON `{ recipientId }`; creates or returns the existing direct conversation.                                                                                                                                                                                               |
| `GET /chats`                                        | Paginated conversations sorted by latest visible message, including `unreadCount`.                                                                                                                                                                                         |
| `GET /chats/:chatId`                                | Conversation details and recipient profile, including avatar.                                                                                                                                                                                                              |
| `GET /chats/:chatId/messages`                       | Newest-first messages; `limit` and opaque `cursor` load older history. Each message includes `editedAt`, `readAt`, and optional attachment metadata.                                                                                                                       |
| `POST /chats/:chatId/messages`                      | JSON `{ text }`; nonblank text, at most 4000 Unicode code points.                                                                                                                                                                                                          |
| `PATCH /chats/:chatId/messages/:messageId`          | JSON `{ text }`; only the author can edit an active message.                                                                                                                                                                                                               |
| `DELETE /chats/:chatId/messages/:messageId`         | Author-only soft deletion, returns `204`. Removes the message from history and latest-message previews.                                                                                                                                                                    |
| `POST /chats/:chatId/read`                          | JSON `{ throughMessageId }`; marks incoming messages through this displayed message read, returns `204`. Newer messages stay unread.                                                                                                                                       |
| `POST /chats/:chatId/attachments`                   | JSON `{ name, mediaType, content }`; base64 content, 1 byte–5 MiB, filename up to 255 characters without path separators/control characters. Creates an attachment message.                                                                                                |
| `GET /chats/:chatId/messages/:messageId/attachment` | Returns `{ name, mediaType, content }` with base64 content after membership checks.                                                                                                                                                                                        |

WebSocket endpoint: `/events` locally, `/api/events` behind the production proxy. Browser `Origin` must match `FRONTEND_ORIGIN`. Send `{ "type": "auth", "token": "<access token>" }` within five seconds; credentials never enter the URL. The server responds `{ "type": "ready" }`. It checks active sessions and token expiry throughout the connection and checks membership before delivering each event.

- Server `{ type: "changed", chatId }` automatically synchronizes authoritative HTTP data. The client refreshes every loaded conversation-list page and the loaded active history, including edits/deletions and unread counts. Reconnection and returning to a visible tab also reconcile missed changes. Transient synchronization failures retry automatically with backoff. There are no manual reload buttons in the chat list, conversation header or menu.
- Client `{ type: "typing", chatId, typing: true|false }` broadcasts `{ type: "typing", chatId, userId, typing }` only to members. Events are rate limited per connection and indicators expire in the UI.
- Heartbeats detect broken connections; the client reconnects with bounded exponential backoff and refreshes expired access tokens through the existing session mechanism.

This deployment uses one API process for WebSocket fan-out. Multiple API replicas would require a shared event broker before scaling horizontally.

## Deployment and Quality

For a step-by-step Russian guide covering a new DuckDNS address, AWS EC2/S3, first startup, backups and updates, see [DEPLOY.md](DEPLOY.md).

`.github/workflows/ci.yml` runs backend build/ESLint/unit tests, PostgreSQL HTTP/WebSocket scenarios, frontend build/tests, and both container builds on pushes and pull requests. The optional manual deployment job runs only for `main`, after all checks pass.

Production startup on a Linux server with Docker Compose:

1. Point a domain's DNS to the server and open ports 80/443. Clone this repository on the server.
2. Copy `.env.production.example` to `.env.production`. Set `DOMAIN`, database credentials and a random signing secret (`openssl rand -hex 32`). Keep this file private and outside version control.
3. Run `docker compose --env-file .env.production -f compose.production.yml up -d --build --wait`.
4. Open `https://<DOMAIN>`. Caddy obtains TLS certificates, serves Angular routes and proxies `/api/*`, including WebSocket upgrades. Swagger is available at `https://<DOMAIN>/api/docs/`.

The `migrate` service waits for healthy PostgreSQL and applies migrations before the API starts. PostgreSQL metadata persists in the database volume, file/avatar objects persist in S3, and TLS certificates persist separately. Back up PostgreSQL before deployments and schema changes. Do not remove named volumes when updating the application. Application rollback requires deploying the previous compatible revision; database migration rollback is a separate manual operation.

For GitHub deployment, configure environment `production` and repository/environment secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS` (verified SSH host-key entries). The server checkout must have read access to the repository and the deployment user must have Docker access. Pushes to `main`, including merges, deploy automatically after the checks pass and the commit-tagged images are published. The **Checks and deployment** workflow can also run manually on `main` with `deploy=true`. The job checks out the exact tested revision on the server and pulls the prebuilt images for that revision and starts `compose.aws.yml`, including migrations. Configure environment review rules in GitHub if deployment approval is desired.

### AWS Free Tier without buying a domain

Use `compose.aws.yml` to pull prebuilt images instead of compiling on a small EC2 instance. The CI publishes commit-tagged `linux/amd64` and `linux/arm64` images to GHCR on `main`; ARM instances such as t4g need the ARM image, which Docker selects automatically. The same workflow validates both image architectures. This Compose file sets memory limits, limits the Node heap and reduces PostgreSQL buffers/connections for a small single-host demonstration. Capacity for a busy public service has not been load tested.

1. Select an EC2 Linux instance marked **Free tier eligible** for your account and architecture. AWS eligibility depends on account creation date, remaining credits and elapsed time; it is not a permanent free server. Accounts created from July 15, 2025 use credits and a free-plan period of up to six months. Check the [current AWS Free Tier rules](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html) and your Billing dashboard, including EBS and public IPv4 usage.
2. Install Docker Engine and the Compose plugin. Allow inbound TCP 80/443; restrict SSH 22 to your own address. PostgreSQL and the backend have no public host ports. Keep a persistent database volume and regular backups.
3. Obtain a free hostname. [DuckDNS](https://www.duckdns.org/about.jsp) maps `your-project.duckdns.org` to the instance IP. Alternatively, set `DOMAIN=<PUBLIC_IP>.sslip.io`: [sslip.io/nip.io](https://sslip.io/) resolves the embedded address without registration and supports TLS issuance. Caddy obtains the certificate once ports 80/443 are reachable. Shared DNS providers can have certificate rate limits; use DuckDNS if issuance is blocked. A hostname that points to a changed EC2 address must be updated after stop/start.
4. Copy `.env.production.example` to `.env.production` and set `DOMAIN`, secrets, and `BACKEND_IMAGE`/`FRONTEND_IMAGE` to the lowercase GHCR paths and commit SHA from a successful `main` workflow. Example image suffixes: `university-messenger-backend:<sha>` and `university-messenger-web:<sha>`. If packages are private, authenticate on the server with `docker login ghcr.io` using a read-packages token; public packages can be pulled anonymously. Never put a registry token in the repository.
5. Run:

   ```bash
   docker compose --env-file .env.production -f compose.aws.yml pull
   docker compose --env-file .env.production -f compose.aws.yml up -d --wait
   ```

   On subsequent updates, back up the database, change the image tags and run:

   ```bash
   docker compose --env-file .env.production -f compose.aws.yml pull
   docker compose --env-file .env.production -f compose.aws.yml stop backend
   docker compose --env-file .env.production -f compose.aws.yml run --rm migrate
   docker compose --env-file .env.production -f compose.aws.yml run --rm --no-deps backend npm run media:migrate
   docker compose --env-file .env.production -f compose.aws.yml up -d --wait
   ```

Open `https://<DOMAIN>`; buying a domain, Route 53, an ALB and RDS are unnecessary for this single-instance setup. Raw-IP HTTP is not the production configuration because session cookies require HTTPS. For a friendly free subdomain through GitHub, [is-a-dev/register](https://github.com/is-a-dev/register) is active, but its [terms](https://github.com/is-a-dev/register/blob/main/TERMS_OF_SERVICE.md) prohibit root sites behind login pages, so this messenger should use DuckDNS or sslip.io unless the provider explicitly approves the use case. [open-domains/register](https://github.com/open-domains/register) is archived as of July 2026.

No server credentials or public deployment URL are committed. Deployment is intentionally deferred; the application and deployment files can be tested locally first.

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
- [x] Connect frontend user search to the existing API.
- [x] Implement profile editing.
- [x] Implement direct conversations.
- [x] Add real-time message delivery.
- [x] Add message editing, deletion, and read receipts.
- [x] Add typing indicators and unread message counts.
- [x] Replace sample chats with real data and implement responsive conversation/history/message screens connected to the backend.
- [x] Add user search tests and cover conversation and messaging scenarios as they are implemented.
- [x] Configure CI/CD, container images and HTTPS deployment instructions.
- [ ] Deploy to a public server (deferred until infrastructure is available).
- [x] Add image and file attachments if time permits.

## Team

| Member                                        | Role                             |
| --------------------------------------------- | -------------------------------- |
| [deniSSTK](https://github.com/deniSSTK)       | Team Lead / Full Stack Developer |
| [Maksimk9245](https://github.com/Maksimk9245) | Developer                        |
| [Syd-Ma](https://github.com/Syd-Ma)           | Developer                        |

The Team Lead coordinates the team, aligns architecture and tasks, reviews code, and contributes to development. Feature implementation, testing, and release preparation are shared across the team.

## Direct messaging HTTP integration

The Angular application binds `CHATS_REPOSITORY` to `ChatsHttpAdapter` in
`frontend/src/app/app.config.ts`. Requests reuse the existing bearer/refresh client;
HTTP DTOs remain inside the repository adapter. The browser mock adapter remains
available for its isolated tests and is not used by application providers. Existing
mock conversations in browser storage are not read, migrated, or uploaded. Their
old `demo-*` URLs show the unavailable-chat state; open a recipient from search to
create or find their real conversation.

| Client operation     | Backend request                                   | Response used by the client                   |
| -------------------- | ------------------------------------------------- | --------------------------------------------- |
| Current account      | `GET /auth/me`                                    | `id`, `username`, `displayName`               |
| Open or reuse dialog | `POST /chats` with `{ recipientId }`              | `id`, `recipient`, `createdAt`                |
| List chats           | `GET /chats?page=1&limit=20`                      | `items` in server order and `meta.totalPages` |
| Open chat URL        | `GET /chats/:chatId`                              | `recipient` and chat details                  |
| Latest/older history | `GET /chats/:chatId/messages?limit=30&cursor=...` | `items`, `nextCursor`                         |
| Send                 | `POST /chats/:chatId/messages` with `{ text }`    | The saved server message                      |

History responses are newest-first; the adapter reverses each page for chronological
rendering. Cursors are opaque and are passed back unchanged. `403`/`404` responses
become unavailable-chat errors, validation errors remain validation errors, and
network/server failures preserve drafts and session state. The shared HTTP client
continues to coordinate refresh requests.

Search waits 300 ms after typing, accepts a leading `@`, and cancels obsolete requests.
Chat lists load in pages of 20 and history in pages of 30. Older-history loading keeps
the viewing position. Refresh fills intermediate pages back to the latest message fetched
from history and merges the results with messages already on screen. Enter sends,
Shift+Enter adds a line, and messages may contain up to 4000 Unicode code points.
Drafts are kept separately per account/chat. The sender sees the saved message; the
recipient sees changes on open or refresh. Mobile shows either the list or the dialog
with a back action. No messages or tokens are persisted by the frontend in localStorage.

From `frontend/`, run `npm run build` and `npm test -- --watch=false`.
HTTP integration tests use Angular `HttpTestingController` and cover real endpoint
paths, request bodies, response mapping/order, cursor paging, errors, shared refresh,
and the production provider binding. UI regression tests cover races, draft isolation,
scrolling, retries, and obsolete mock URLs. Existing authentication and session tests
remain enabled. Backend unit/e2e checks are run from `backend/` as documented above.

Manual integration check, 2026-11-05: the browser restored an existing session,
searched a temporary backend account with whitespace/`@`/mixed case, created a real
UUID conversation, and sent a multiline message from Angular. The recipient read
it through the real API and sent 32 replies. Angular refresh displayed all 33
messages without gaps; reloading the chat URL restored a 30-message page, and older
history returned all 33 unique messages. A further reply from the UI was saved.
Mobile width 390px showed no horizontal overflow, kept the composer visible, and
returned to the server-backed list using the back button. The independent API
scenario also checked reusing the same dialog from both participants, outsider
404 responses, invalid text, refresh, and logout. Only temporary test accounts,
their conversations/messages, and the separate verification database were removed
after the checks; existing local accounts were preserved.

The 2026-11-05 verification run passed the frontend build, TypeScript test checking,
82 frontend tests, 87 backend unit tests, and 37 backend e2e tests. Angular reported
a component-style size warning. The PostgreSQL connections used UTC
(`PGOPTIONS=-c timezone=UTC`).

Verification, 2026-11-08 (S3/shared UI update): backend build, ESLint and 114 unit tests passed; 42 HTTP/PostgreSQL/WebSocket/S3-transport e2e tests and 93 frontend tests passed. The AWS SDK was exercised against a local HTTP S3 fixture, including exact-byte upload/download, SigV4 request headers, signed avatar URL expiry and object deletion. Database tests verify old payload migration, idempotency, access controls, name-only avatar preservation and avatar removal. Browser checks used a separate temporary database and the local S3 fixture: native shared form controls, profile dialog, avatar upload, name-only save, message actions and attachment upload/download worked. At 390px the document had no horizontal overflow and the composer remained visible. A real AWS bucket/account was not accessed. The earlier verification above describes the pre-S3 implementation.

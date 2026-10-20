# University Messenger

A full stack web messenger for direct communication. Users will be able to find each other, exchange messages in real time, and access their conversation history from a computer or phone.

The messenger is being developed as a university semester project. The team's goal is to complete the full development cycle: interface and API design, implementation, testing, automated builds, and server deployment.

## Core Features

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
| Backend           | TypeScript, Node.js, NestJS - API and server logic         | Foundation prepared          |
| Database          | PostgreSQL, Prisma - data storage and migrations           | Configuration prepared       |
| Local Environment | Docker Compose - local PostgreSQL                          | Prepared                     |
| Frontend          | Angular, TypeScript - responsive web interface             | Planned                      |
| Messaging         | WebSocket - real-time messages and conversation events     | Planned                      |
| Testing           | Jest, Supertest - unit and end-to-end tests                | Basic configuration prepared |
| CI/CD             | GitHub Actions - checks, builds, and deployment automation | Planned                      |

The Angular frontend will use the backend HTTP API for accounts, profiles, conversation lists, and message history. A WebSocket connection will deliver new messages, read receipts, and typing events. PostgreSQL will store users, conversations, and messages.

Authentication and conversation membership checks must be enforced on the server for both HTTP requests and WebSocket events. Passwords must be stored as hashes. Only the author of a message will be able to edit or delete it.

## Repository Structure

```text
.
├── backend/              # NestJS, Prisma, and local database configuration
│   ├── prisma/           # Database schema and migrations
│   ├── src/              # Backend source code
│   ├── test/             # End-to-end tests
│   ├── .env.example      # Example environment variables
│   └── docker-compose.yml
├── frontend/             # Angular client application (planned)
├── LICENSE
└── README.md
```

The backend and frontend share a single repository. Install dependencies and run commands from each application's directory. The `frontend/` directory currently contains only a placeholder file; the client application will be added separately.

## Running the Backend Locally

These instructions cover the current repository contents. Frontend setup instructions will be added once the client application is available.

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

By default, the server is available at [http://localhost:3000](http://localhost:3000), and PostgreSQL is available at `localhost:6012`. The server currently runs the base NestJS application; the messaging API will be added during development.

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

## Deployment and Quality

By the end of the project, the frontend, backend, and PostgreSQL will be deployed on a server, with the application accessible over HTTPS. Data must persist across restarts and application updates. Secrets must be supplied through environment variables.

GitHub Actions will run checks and builds when code changes. The deployment process must include database migrations. A link to the running messenger and deployment instructions will be added once the environment is ready.

Key testing scenarios include registration and sign-in, access restricted to a user's own conversations, sending and receiving messages, and message editing and deletion restricted to the author.

## Development Roadmap

- [x] Prepare the NestJS backend foundation.
- [x] Configure Prisma and local PostgreSQL through Docker Compose.
- [x] Design user, session, conversation, and message models.
- [ ] Implement registration, authentication, and profiles.
- [ ] Implement user search and direct conversations.
- [ ] Add real-time messaging and conversation history.
- [ ] Add message editing, deletion, and read receipts.
- [ ] Add typing indicators and unread message counts.
- [ ] Build a responsive Angular frontend and connect it to the backend.
- [ ] Cover key scenarios with tests.
- [ ] Configure CI/CD and deploy the application over HTTPS.
- [ ] Add image and file attachments if time permits.

## Team

| Member                                        | Role                             |
| --------------------------------------------- | -------------------------------- |
| [deniSSTK](https://github.com/deniSSTK)       | Team Lead / Full Stack Developer |
| [Maksimk9245](https://github.com/Maksimk9245) | Developer                        |
| [Syd-Ma](https://github.com/Syd-Ma)           | Developer                        |

The Team Lead coordinates the team, aligns architecture and tasks, reviews code, and contributes to development. Feature implementation, testing, and release preparation are shared across the team.

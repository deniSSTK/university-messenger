# Shared packages

`events` is the framework-independent `@university-messenger/events` package used by the NestJS backend and Angular frontend. It exports `WebSocketEventType` from one TypeScript source. Wire values remain `auth`, `ready`, `changed`, and `typing`; `Offline` is a local client connection notification and is never a server frame. UI connection states such as `connecting` are separate from protocol events.

Both applications depend on `file:../pkg/events`. Their install, build, start and test scripts build this package using the application's existing TypeScript compiler. For a manual rebuild from either application directory:

```bash
npm run build:pkg
```

ESM and CommonJS outputs and declarations are generated in `events/dist` (ignored by Git); package exports select the appropriate format for Angular/Node or Jest. The package can also be installed and built independently with `npm install` and `npm run build` inside `pkg/events`.

Event payload DTOs remain owned by their respective application layers. Only the common event enum is shared. Docker and CI build from the repository root so the local package is available.

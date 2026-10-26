# Project Rules

These rules apply across the entire repository, including the backend, frontend, and tests.

## Exports

- Declare classes, functions, constants, and types without an inline `export` keyword.
- Group named exports at the end of each file: `export { ... };`.
- Export types separately using `export type { ... };`.
- Keep default exports where required by a tool or configuration format.

## Readability

- Always use braces for conditionals and loops, even for a single statement.
- Separate logical steps with blank lines: fetching data, validating it, changing state, and returning a result.
- Do not pack multiple actions or long type declarations onto a single line.
- Use clear named types for complex structures and named functions or variables for lengthy validation conditions.
- Break large methods into clear steps without introducing unnecessary abstractions for simple operations.
- Preserve input validation and program behavior when changing code style.
- Extract reusable transformations and other generic helpers into shared utility files instead of declaring them inside DTOs or feature classes. Use names that describe the operation rather than a specific field.

## Types and Verification

- Do not use `any`; use `unknown` for unvalidated data and narrow its type through checks.
- Do not manually edit generated code or build output.
- Run the relevant project checks after making changes. For the backend, run the build, ESLint, and existing unit tests.

# Backend

- Centralize environment variable loading and validation in `src/core/config`. Inject the typed application config into runtime consumers instead of reading `process.env` in feature code. CLI configuration should reuse the appropriate config readers without requiring unrelated application secrets.
- Configure token and session lifetimes through environment variables, validate them in the shared config, and document their units in `.env.example`.
- Preserve the user's email casing when storing and returning it; trim surrounding whitespace only. Compare emails case-insensitively in repository queries and enforce case-insensitive uniqueness in the database.
- Follow the dependency flow: controllers and guards call services; services call repositories; repositories access Prisma.
- Keep Prisma queries, transactions, and Prisma-specific error handling inside repositories. Do not expose Prisma clients or transaction clients to services, controllers, or guards.
- Organize features under `src/modules/<feature>/{domain,repository,service,delivery/http}` and wire dependencies in the feature module.
- Keep domain models, errors, repository interfaces, and port contracts independent of NestJS, HTTP, Prisma, and other infrastructure libraries.
- Keep separate contracts for each boundary: HTTP request/response DTOs in delivery, use-case inputs/results in service, and ORM-independent repository inputs/results in domain contracts. Map explicitly at boundaries instead of reusing HTTP or ORM DTOs in business logic.
- Services depend on repository interfaces and domain ports, not concrete adapters. Bind implementations in the module's composition root.
- Keep business decisions and domain errors in services; translate domain errors into HTTP responses in delivery. Repository methods should expose application-level operations and results.
- Keep Prisma types, selections, and errors inside the repository implementation. Transaction callbacks must receive a repository interface, never an ORM client.
- Document HTTP endpoints in Swagger, including request and response DTOs, authentication requirements, and error responses.
- Provide realistic examples for DTO properties using Swagger decorators.
- Store example values in separate constants files next to the relevant feature (for example, `auth.examples.ts`). Import these constants into DTOs instead of embedding example literals in decorators.
- Keep Swagger schemas consistent with runtime validation and actual API responses. Never include real secrets in examples.
- Read JSON payloads with `@Body()`, path parameters with `@Param()`, and query parameters with `@Query()`. Use `@Req()` for request context such as cookies or guard-populated authentication data; combine decorators when an endpoint needs multiple sources.
- Keep Express request/response objects and cookie handling in `delivery/http`. Map HTTP DTOs and request context to explicit service inputs, and map service results to public HTTP responses.
- Keep auth token response handling local to the auth controller while only its register, login, and refresh endpoints need it. Use descriptive helper names such as `setAuthCookieAndBuildResponse`; send refresh tokens only through HttpOnly cookies.
- Keep `README.md` aligned with the module layout, environment variable names and units, API behavior, startup steps, and test prerequisites when changing these areas.

# NestJS Architecture & Best Practices: Tests and Domain

## Top 5 Principles for Tests & Domain

1. **Separation of Concerns**
   - **Domain Layer**: Contains business logic and entities (e.g., `User` in `domain/entities`).
   - **Infrastructure Layer**: Handles controllers, services, and data access.
   - **Testing**: Should only test the public API of each layer, not internal implementation details.

2. **Dependency Injection**
   - Use NestJS’s DI to inject services and repositories.
   - In tests, mock dependencies (e.g., repositories) to isolate the unit under test.

3. **Single Responsibility Principle (SRP)**
   - Each class/module should have one responsibility.
   - Example: `UserService` handles user-related business logic, `UserController` handles HTTP requests.

4. **Test Isolation**
   - Unit tests should mock external dependencies (e.g., database, other services).
   - Integration tests can use in-memory databases or test containers.

5. **Explicit Boundaries**
   - Use DTOs for data transfer between layers.
   - Tests should verify boundaries: controller → service → repository.

---

## Layered Architecture & Test Boundaries

```
+-------------------+      +-------------------+      +-------------------+
|   Controller      | ---> |    Service        | ---> |   Repository      |
+-------------------+      +-------------------+      +-------------------+
        ^                        ^                          ^
        |                        |                          |
        |                        |                          |
        |                        |                          |
   Controller Test         Service Test                Repository Test
```

- **Controller Test**: Mocks service, tests HTTP logic.
- **Service Test**: Mocks repository, tests business logic.
- **Repository Test**: (Optional) Tests data access, can use in-memory DB.

---

## Summary Table

| Principle                  | Domain Layer         | Test Layer                |
|----------------------------|---------------------|---------------------------|
| Separation of Concerns     | Entities, Logic     | Isolated, Layered         |
| Dependency Injection       | Services, Repos     | Mocking, Providers        |
| Single Responsibility      | Each class/module   | Each test targets one unit|
| Test Isolation             | No external calls   | Mocks, Fakes              |
| Explicit Boundaries        | DTOs, Interfaces    | Test boundaries           |

---

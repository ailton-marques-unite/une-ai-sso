<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Local project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Run local tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

### 1. Configure environment variables
```bash
# To copy environment variables to .env
cp ENV_VARIABLES.md .env
# Customize .env file 
```

### 2. Initialize services
```bash
# Run PostgreSQL and Redis
docker-compose up -d

# Run migrations commands
yarn migration:run
```

### 3. Run app
```bash
# watch mode
yarn start:dev

# production mode
yarn build
yarn start:prod
```

### 4. Domain Context in Routes
```typescript
// Example middleware use in controller 
@Controller('users')
@UseGuards(DomainContextMiddleware) // Apply middleware
export class UsersController {
  @Get()
  findAll(@Req() req: Request) {
    // req.domainContext is enable
    const domainId = req.domainContext.domainId;
    // ...
  }
}
```
### 5. Swagger documentation
```text
  http://localhost:3000/api/
```

### 6. How to use

There are two documents that contain instructions on how to use SaaS services with functional examples.

- API_EXAMPLES
- API_EXAMPLES_AUTH



## Technologies Involved

- **Runtime**: Node.js 18+, TypeScript
- **Framework**: Express.js / Fastify
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Auth**: JWT (RS256)
- **Password**: bcrypt / Argon2
- **MFA**: TOTP (speakeasy/otplib)
- **Email**: SendGrid / AWS SES
- **SMS**: Twilio / AWS SNS
- **OAuth**: Passport.js + estratégias (Google, Microsoft, GitHub)
- **Rate Limiting**: express-rate-limit + Redis
- **Validation**: zod / joi
- **Testing**: Jest + Supertest

---

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

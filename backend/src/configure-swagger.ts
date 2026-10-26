import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { REFRESH_COOKIE } from './modules/auth/delivery/http/auth.constants.js';

function configureSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('University Messenger API')
    .setDescription(
      'Register or log in to receive an access token and an HttpOnly refresh cookie. ' +
        'Use the access token with Bearer authorization. Refresh rotates the cookie; ' +
        'the session lifetime is configured through JWT_SESSION_TTL (milliseconds). Browser clients must include credentials. ' +
        'Swagger UI uses cookies set by the API automatically; HttpOnly cookies cannot be entered manually.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE)
    .build();

  SwaggerModule.setup(
    'docs',
    app,
    () => SwaggerModule.createDocument(app, config),
    {
      swaggerOptions: { withCredentials: true },
    },
  );
}

export { configureSwagger };

import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app.config.js';
import { AppConfigModule } from '../config/config.module.js';
import { MemoryRateLimitStore } from './memory-rate-limit.store.js';
import { RATE_LIMIT_STORE } from './rate-limit.store.js';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: RATE_LIMIT_STORE,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        new MemoryRateLimitStore(config.rateLimitMaxClients),
    },
  ],
  exports: [RATE_LIMIT_STORE],
})
class RateLimitModule {}

export { RateLimitModule };

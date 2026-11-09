import { Module } from '@nestjs/common';
import { AppConfig } from '../../core/config/app.config.js';
import { AppConfigModule } from '../../core/config/config.module.js';
import { OBJECT_STORAGE } from './domain/object-storage.port.js';
import { S3ObjectStorage } from './repository/s3-object-storage.js';
@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => new S3ObjectStorage(config.storage),
    },
  ],
  exports: [OBJECT_STORAGE],
})
class MediaModule {}
export { MediaModule };

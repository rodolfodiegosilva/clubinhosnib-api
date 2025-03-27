import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseLoggerService } from './database-logger.service';
import { GalleryPage } from 'src/gallery/gallery-page.entity';
import { GalleryImage } from 'src/gallery/gallery-image.entity';
import { GallerySection } from 'src/gallery/gallery-section.entity';
import { Route } from 'src/route/route-page.entity';
import { User } from 'src/user/user.entity';
import { VideosPage } from 'src/video-page/entities/video-page.entity/video-page.entity';
import { VideoItem } from 'src/video-page/entities/video-item.entity/video-item.entity';
;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const dbConfig = {
          type: 'mysql' as const,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 3306),
          username: configService.get<string>('DB_USERNAME', 'root'),
          password: configService.get<string>('DB_PASSWORD', ''),
          database: configService.get<string>('DB_NAME', 'test'),
          entities: [GalleryPage, GalleryImage, GallerySection, Route, User, VideosPage, VideoItem],
          synchronize: true,
        };

        logger.debug(`Tentando conectar ao banco de dados MySQL:
           → Host: ${dbConfig.host}
           → Porta: ${dbConfig.port}
           → DB: ${dbConfig.database}
           → Usuário: ${dbConfig.username}`);

        return dbConfig;
      },
    }),
  ],
  providers: [DatabaseLoggerService],
})
export class DatabaseModule { }

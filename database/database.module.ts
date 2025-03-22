import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GallerySection } from 'src/gallery/gallery-section.entity';
import { GalleryImage } from 'src/gallery/gallery-image.entity';
import { GalleryPage } from 'src/gallery/gallery-page.entity';
import { Route } from 'src/route/route-page.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME', 'test'),
        entities: [ GalleryPage, GalleryImage, GallerySection, Route],
        synchronize: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
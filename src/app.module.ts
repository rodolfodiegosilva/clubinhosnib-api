import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from 'database/database.module';
import { GalleryModule } from './gallery/gallery.module';
import { RouteModule } from './route/route.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    GalleryModule,
    RouteModule
  ],
})
export class AppModule {}

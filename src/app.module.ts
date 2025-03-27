import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GalleryModule } from './gallery/gallery.module';
import { RouteModule } from './route/route.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { AwsModule } from './aws/aws.module';
import { DatabaseModule } from '../database/database.module';
import { VideosPageModule } from './video-page/video-page.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AwsModule,
    GalleryModule,
    RouteModule,
    UserModule,
    AuthModule,
    RouteModule,
    VideosPageModule,    
  ],
})
export class AppModule { }

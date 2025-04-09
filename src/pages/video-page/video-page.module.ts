import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VideosPage } from './entities/video-page.entity';
import { VideosPageController } from './video-page.controller';
import { VideosPageService } from './video-page.service';
import { VideosPageRepository } from './video-page.repository';
import { RouteModule } from 'src/route/route.module';
import { MediaModule } from 'src/share/media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VideosPage]),
    RouteModule,
    MediaModule  
  ],
  controllers: [VideosPageController],
  providers: [
    VideosPageService,
    VideosPageRepository,
  ],
  exports: [VideosPageService],
})
export class VideosPageModule {}

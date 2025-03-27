import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VideosPage } from './entities/video-page.entity/video-page.entity';
import { VideosPageController } from './video-page.controller';
import { VideosPageService } from './video-page.service';
import { VideosPageRepository } from './video-page.repository';
import { RouteModule } from 'src/route/route.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VideosPage]),
    RouteModule
  ],
  controllers: [VideosPageController],
  providers: [
    VideosPageService,
    // Registramos o repositório customizado diretamente
    VideosPageRepository,
  ],
  exports: [VideosPageService],
})
export class VideosPageModule {}

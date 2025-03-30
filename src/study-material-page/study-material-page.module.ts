import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StudyMaterialsPageController } from './study-material-page.controller';
import { StudyMaterialsPageService } from './study-material-page.service';
import { StudyMaterialsPageRepository } from './study-material.repository';
import { StudyMaterialsPage } from './entities/study-material-page.entity/study-material-page.entity';
import { StudyMediaItem } from './entities/study-media-item/StudyMediaItem';
import { RouteModule } from 'src/route/route.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StudyMaterialsPage, StudyMediaItem]),
    RouteModule,
  ],
  controllers: [StudyMaterialsPageController],
  providers: [
    StudyMaterialsPageService,
    StudyMaterialsPageRepository,
  ],
  exports: [StudyMaterialsPageService],
})
export class StudyMaterialsPageModule {}

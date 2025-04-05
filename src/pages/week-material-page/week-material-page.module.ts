import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';


import { WeekMaterialsPageRepository } from './week-material.repository';
import { WeekMaterialsPageEntity } from './entities/week-material-page.entity/week-material-page.entity';
import { RouteModule } from 'src/route/route.module';
import { WeekMaterialsPageController } from './week-material-page.controller';
import { WeekMaterialsPageService } from './week-material-page.service';
import { MediaModule } from 'src/share/media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeekMaterialsPageEntity]),
    RouteModule,
    MediaModule
  ],
  controllers: [WeekMaterialsPageController],
  providers: [
    WeekMaterialsPageEntity,
    WeekMaterialsPageRepository,
    WeekMaterialsPageService
  ],
  exports: [WeekMaterialsPageEntity],
})
export class WeekMaterialsPageModule {}

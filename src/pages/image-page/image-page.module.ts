import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';


import { RouteModule } from 'src/route/route.module';
import { ImagePageEntity } from './entity/Image-page.entity';
import { ImageSectionEntity } from './entity/Image-section.entity';
import { ImageController } from './image-page.controller';
import { ImageService } from './image-page.service';
import { ImagePageRepository } from './repository/image-page.repository';
import { ImageSectionRepository } from './repository/image-section.repository';
import { MediaModule } from 'src/share/media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImagePageEntity, ImageSectionEntity, ImagePageEntity]),
    RouteModule,
    MediaModule
  ],
  controllers: [ImageController],
  providers: [
    ImageService,
    {
      provide: ImagePageRepository,
      useFactory: (dataSource: DataSource) => new ImagePageRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: ImageSectionRepository,
      useFactory: (dataSource: DataSource) => new ImageSectionRepository(dataSource),
      inject: [DataSource],
    },
  ],
  exports: [ImageService],
})
export class ImageModule {}

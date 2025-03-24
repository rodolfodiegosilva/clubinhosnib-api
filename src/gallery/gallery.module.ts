import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

import { GalleryPage } from './gallery-page.entity';
import { GallerySection } from './gallery-section.entity';
import { GalleryImage } from './gallery-image.entity';

import { GalleryPageRepository } from './gallery-page.repository';
import { GallerySectionRepository } from './gallery-section.repository';
import { GalleryImageRepository } from './gallery-image.repository';
import { RouteModule } from 'route/route.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GalleryPage, GallerySection, GalleryImage]),
    RouteModule,
  ],
  controllers: [GalleryController],
  providers: [
    GalleryService,
    {
      provide: GalleryPageRepository,
      useFactory: (dataSource: DataSource) => new GalleryPageRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: GallerySectionRepository,
      useFactory: (dataSource: DataSource) => new GallerySectionRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: GalleryImageRepository,
      useFactory: (dataSource: DataSource) => new GalleryImageRepository(dataSource),
      inject: [DataSource],
    },
  ],
  exports: [GalleryService],
})
export class GalleryModule {}

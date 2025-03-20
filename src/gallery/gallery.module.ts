import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { GalleryPage } from './gallery-page.entity';
import { GallerySection } from './gallery-section.entity';
import { GalleryImage } from './gallery-image.entity';
import { GalleryPageRepository } from './gallery-page.repository';
import { GallerySectionRepository } from './gallery-section.repository';
import { GalleryImageRepository } from './gallery-image.repository';
import { RouteRepository } from './route-page.repository';

@Module({
  imports: [TypeOrmModule.forFeature([GalleryPage, GallerySection, GalleryImage])],
  controllers: [GalleryController],
  providers: [GalleryService, GalleryPageRepository, GallerySectionRepository, GalleryImageRepository,RouteRepository],
  exports: [GalleryService, GalleryPageRepository, GallerySectionRepository, GalleryImageRepository,RouteRepository],
})
export class GalleryModule {}

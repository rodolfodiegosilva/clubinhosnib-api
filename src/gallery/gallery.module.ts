import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GallerySection } from './gallery-section.entity';
import { GalleryImage } from './gallery-image.entity';
import { GalleryService } from './gallery.service';
import { GalleryController } from './gallery.controller';
import { GalleryPage } from './gallery-page.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GalleryPage, GallerySection, GalleryImage])],
  providers: [GalleryService],
  controllers: [GalleryController],
  exports: [GalleryService],
})
export class GalleryModule {}
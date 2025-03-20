import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { GallerySection } from './gallery-section.entity';

@Injectable()
export class GallerySectionRepository extends Repository<GallerySection> {
  constructor(private readonly dataSource: DataSource) {
    super(GallerySection, dataSource.createEntityManager());
  }

  async findByPageId(pageId: string): Promise<GallerySection[]> {
    return this.find({ where: { page: { id: pageId } }, relations: ['images'] });
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { GalleryImage } from './gallery-image.entity';

@Injectable()
export class GalleryImageRepository extends Repository<GalleryImage> {
  constructor(private readonly dataSource: DataSource) {
    super(GalleryImage, dataSource.createEntityManager());
  }

  async findBySectionId(sectionId: string): Promise<GalleryImage[]> {
    return this.find({ where: { section: { id: sectionId } } });
  }
}

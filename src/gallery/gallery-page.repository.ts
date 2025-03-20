import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { GalleryPage } from './gallery-page.entity';

@Injectable()
export class GalleryPageRepository extends Repository<GalleryPage> {
  constructor(private readonly dataSource: DataSource) {
    super(GalleryPage, dataSource.createEntityManager());
  }

  async findOneWithRelations(id: string): Promise<GalleryPage | null> {
    return this.findOne({ where: { id }, relations: ['sections', 'sections.images'] });
  }

  async findAllWithRelations(): Promise<GalleryPage[]> {
    return this.find({ relations: ['sections', 'sections.images'], order: { id: 'ASC' } });
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { StudyMaterialsPage } from './entities/study-material-page.entity/study-material-page.entity';
import { StudyMediaItem } from './entities/study-media-item/StudyMediaItem';

@Injectable()
export class StudyMaterialsPageRepository extends Repository<StudyMaterialsPage> {
  constructor(private dataSource: DataSource) {
    super(StudyMaterialsPage, dataSource.createEntityManager());
  }

  async findAllPages(): Promise<StudyMaterialsPage[]> {
    return this.find({ relations: ['mediaItems', 'route'] });
  }

  async findOnePageById(id: string): Promise<StudyMaterialsPage | null> {
    return this.findOne({
      where: { id },
      relations: ['mediaItems', 'route'],
      order: {
        mediaItems: {
          createdAt: 'DESC',
        },
      },
    });
  }

  async savePage(page: StudyMaterialsPage): Promise<StudyMaterialsPage> {
    return this.save(page);
  }

  async removePage(page: StudyMaterialsPage): Promise<StudyMaterialsPage> {
    return this.remove(page);
  }

  async removeItems(items: StudyMediaItem[]): Promise<StudyMediaItem[]> {
    const itemRepo = this.dataSource.getRepository(StudyMediaItem);
    return itemRepo.remove(items);
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { VideosPage } from './entities/video-page.entity/video-page.entity';
import { VideoItem } from './entities/video-item.entity/video-item.entity';

@Injectable()
export class VideosPageRepository extends Repository<VideosPage> {
  constructor(private dataSource: DataSource) {
    super(VideosPage, dataSource.createEntityManager());
  }

  async findAllPages(): Promise<VideosPage[]> {
    return this.find({ relations: ['videos'] });
  }

  async findOnePageById(id: string): Promise<VideosPage | null> {
    return this.findOne({
      where: { id },
      relations: ['videos'],
      order: {
        videos: {
          createdAt: 'DESC',
        },
      },
    });
  }
  
  async savePage(page: VideosPage): Promise<VideosPage> {
    return this.save(page);
  }

  async removePage(page: VideosPage): Promise<VideosPage> {
    return this.remove(page);
  }

  async removeItems(items: VideoItem[]): Promise<VideoItem[]> {
    const itemRepo = this.dataSource.getRepository(VideoItem);
    return itemRepo.remove(items);
  }
}

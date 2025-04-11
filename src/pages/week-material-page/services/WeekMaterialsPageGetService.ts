import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WeekMaterialsPageRepository } from '../week-material.repository';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { WeekMaterialsPageResponseDTO } from '../dto/week-material-response.dto';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';

@Injectable()
export class WeekMaterialsPageGetService {
  private readonly logger = new Logger(WeekMaterialsPageGetService.name);

  constructor(
    private readonly repo: WeekMaterialsPageRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async findAllPages(): Promise<WeekMaterialsPageEntity[]> {
    this.logger.debug('📥 Buscando todas as páginas');
    return this.repo.findAllPages();
  }

  async findOnePage(id: string): Promise<WeekMaterialsPageEntity> {
    this.logger.debug(`📄 Buscando página ID=${id}`);
    const page = await this.repo.findOnePageById(id);
    if (!page) throw new NotFoundException('Página não encontrada');
    return page;
  }

  async findPageWithMedia(id: string): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`🔍 Buscando página com mídias ID=${id}`);
    const page = await this.findOnePage(id);
    const mediaItems = await this.mediaItemProcessor.findMediaItemsByTarget(
      page.id,
      MediaTargetType.WeekMaterialsPage,
    );
    return WeekMaterialsPageResponseDTO.fromEntity(page, mediaItems);
  }

  async findAllPagesWithMedia(): Promise<WeekMaterialsPageResponseDTO[]> {
    this.logger.debug('📥 Buscando todas as páginas com mídias');
    const pages = await this.repo.findAllPages();
    const pageIds = pages.map((p) => p.id);
    const allMedia = await this.mediaItemProcessor.findManyMediaItemsByTargets(
      pageIds,
      MediaTargetType.WeekMaterialsPage,
    );

    const grouped = pageIds.reduce((acc, id) => {
      acc[id] = allMedia.filter((m) => m.targetId === id);
      return acc;
    }, {} as Record<string, MediaItemEntity[]>);

    return pages.map((page) =>
      WeekMaterialsPageResponseDTO.fromEntity(page, grouped[page.id] || []),
    );
  }
}
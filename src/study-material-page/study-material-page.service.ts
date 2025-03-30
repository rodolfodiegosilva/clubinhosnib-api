import { Injectable, Logger } from '@nestjs/common';
import { StudyMaterialsPage } from './entities/study-material-page.entity/study-material-page.entity';
import {
  StudyMediaItem,
  StudyMediaPlatform,
  StudyMediaType,
  StudyMediaUploadType,
} from './entities/study-media-item/StudyMediaItem';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { RouteType } from 'src/route/route-page.entity';
import { StudyMaterialsPageRepository } from './study-material.repository';

@Injectable()
export class StudyMaterialsPageService {
  private readonly logger = new Logger(StudyMaterialsPageService.name);

  constructor(
    private readonly repo: StudyMaterialsPageRepository,
    private readonly s3: AwsS3Service,
    private readonly routeService: RouteService,
  ) {}

  async createStudyMaterialsPage(
    dto: any,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<StudyMaterialsPage> {
    const { pageTitle, pageSubtitle, pageDescription } = dto;
    this.logger.debug(`🚧 Criando nova página de materiais de estudo: "${pageTitle}"`);

    const page = new StudyMaterialsPage();
    page.title = pageTitle;
    page.subtitle = pageSubtitle;
    page.description = pageDescription;

    const saved = await this.repo.savePage(page);

    const path = await this.routeService.generateAvailablePath(pageTitle, 'study_');
    const route = await this.routeService.createRoute({
      title: pageTitle,
      subtitle: pageSubtitle,
      description: pageDescription,
      path,
      type: RouteType.PAGE,
      entityId: saved.id,
      idToFetch: saved.id,
      entityType: 'StudyMaterialsPage',
      image: 'https://bucket-clubinho-galeria.s3.amazonaws.com/uploads/1742760651080_logo192.png',
    });

    saved.route = route;

    const items = this.mergeAllMedia(dto);
    saved.mediaItems = await this.processMediaItems(items, saved, filesDict);

    const final = await this.repo.savePage(saved);
    this.logger.debug(`✅ Página criada com sucesso: ID=${final.id}`);
    return final;
  }

  async updateStudyMaterialsPage(
    id: string,
    dto: any,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<StudyMaterialsPage> {
    this.logger.debug(`🛠️ Atualizando página de estudo ID=${id}`);
    const page = await this.repo.findOnePageById(id);
    if (!page) throw new Error('Página não encontrada');

    const { pageTitle, pageSubtitle, pageDescription } = dto;
    const incoming = this.mergeAllMedia(dto);
    const oldItems = page.mediaItems || [];

    const incomingRefs = new Set(
      incoming.map((i) => (i.type === 'upload' ? i.url || i.fileField : i.url)),
    );

    const removedItems = oldItems.filter((item) => !incomingRefs.has(item.url));
    for (const removed of removedItems) {
      if (removed.isLocalFile) {
        this.logger.debug(`🗑️ Deletando do S3: ${removed.url}`);
        await this.s3.delete(removed.url);
      }
    }

    if (
      page.title !== pageTitle ||
      page.subtitle !== pageSubtitle ||
      page.description !== pageDescription
    ) {
      const newPath = await this.routeService.generateAvailablePath(pageTitle, 'study_');
      await this.routeService.updateRoute(page.route.id, {
        title: pageTitle,
        subtitle: pageSubtitle,
        description: pageDescription,
        path: newPath,
      });
    }

    page.title = pageTitle;
    page.subtitle = pageSubtitle;
    page.description = pageDescription;
    page.mediaItems = await this.processMediaItems(incoming, page, filesDict);

    const updated = await this.repo.savePage(page);
    this.logger.debug(`✅ Página atualizada com sucesso: ID=${updated.id}`);
    return updated;
  }

  async removePage(id: string): Promise<void> {
    this.logger.debug(`🗑️ Removendo página de estudo ID=${id}`);
    const page = await this.repo.findOnePageById(id);
    if (!page) throw new Error('Página não encontrada');

    for (const item of page.mediaItems) {
      if (item.isLocalFile) {
        this.logger.debug(`🧹 Removendo do S3: ${item.url}`);
        await this.s3.delete(item.url);
      }
    }

    if (page.route?.id) {
      await this.routeService.removeRoute(page.route.id);
    }

    await this.repo.removePage(page);
    this.logger.debug(`✅ Página removida: ID=${id}`);
  }

  async findAllPages(): Promise<StudyMaterialsPage[]> {
    this.logger.debug('📥 Buscando todas as páginas de materiais de estudo');
    return this.repo.findAllPages();
  }

  async findOnePage(id: string): Promise<StudyMaterialsPage> {
    this.logger.debug(`📄 Buscando página ID=${id}`);
    const page = await this.repo.findOnePageById(id);
    if (!page) throw new Error('Página não encontrada');
    return page;
  }

  private mergeAllMedia(dto: any): any[] {
    return [
      ...this.withType(dto.videos, StudyMediaType.VIDEO),
      ...this.withType(dto.documents, StudyMediaType.DOCUMENT),
      ...this.withType(dto.images, StudyMediaType.IMAGE),
      ...this.withType(dto.audios, StudyMediaType.AUDIO),
    ];
  }

  private withType(items: any[] = [], type: StudyMediaType): any[] {
    return items.map((i) => ({ ...i, mediaType: type }));
  }

  private async processMediaItems(
    items: any[],
    page: StudyMaterialsPage,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<StudyMediaItem[]> {
    return Promise.all(
      items.map(async (item) => {
        const media = new StudyMediaItem();
        media.title = item.title;
        media.description = item.description;
        media.mediaType = item.mediaType;
        media.type = item.type;
        media.platform = item.platform;
        media.page = page;

        if (item.type === 'upload') {
          const file = filesDict[item.fileField];
          if (!file) throw new Error(`Arquivo ausente: ${item.fileField}`);
          media.url = await this.s3.upload(file);
          media.isLocalFile = true;
          media.originalName = file.originalname;
          media.size = file.size;
        } else {
          media.url = item.url || '';
          media.isLocalFile = false;
        }

        return media;
      }),
    );
  }
}

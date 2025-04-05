import { Injectable, Logger } from '@nestjs/common';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { RouteEntity, RouteType } from 'src/route/route-page.entity';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
import { WeekMaterialsPageEntity } from './entities/week-material-page.entity/week-material-page.entity';
import { WeekMaterialsPageRepository } from './week-material.repository';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { WeekMaterialsPageResponseDTO } from './dto/week-material-response.dto';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';

@Injectable()
export class WeekMaterialsPageService {
  private readonly logger = new Logger(WeekMaterialsPageService.name);

  constructor(
    private readonly repo: WeekMaterialsPageRepository,
    private readonly s3: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) { }

  async createWeekMaterialsPage(
    dto: any,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<WeekMaterialsPageEntity> {
    const { pageTitle, pageSubtitle, pageDescription } = dto;

    this.logger.debug(`🚧 Criando nova página: "${pageTitle}"`);
    this.logger.debug(`📁 Arquivos no dict: ${Object.keys(filesDict).join(', ')}`);

    const page = new WeekMaterialsPageEntity();
    page.title = pageTitle;
    page.subtitle = pageSubtitle;
    page.description = pageDescription;

    const saved = await this.repo.savePage(page);
    this.logger.debug(`💾 Página salva inicialmente. ID=${saved.id}`);

    const path = await this.routeService.generateAvailablePath(pageTitle, 'semana_');
    this.logger.debug(`🛤️ Caminho gerado para rota: ${path}`);

    const route = await this.routeService.createRoute({
      title: pageTitle,
      subtitle: pageSubtitle,
      description: pageDescription,
      path,
      type: RouteType.PAGE,
      entityId: saved.id,
      idToFetch: saved.id,
      entityType: 'WeekMaterialsPage',
      image: '',
    });

    this.logger.debug(`🛤️ Rota criada com sucesso. ID=${route.id}`);
    saved.route = route;

    const items = this.mergeAllMedia(dto);
    this.logger.debug(`🎞️ Itens de mídia extraídos: ${items.length}`);

    await this.mediaItemProcessor.processMediaItemsPolymorphic(
      items,
      saved.id,
      MediaTargetType.WeekMaterialsPage,
      filesDict,
      (file) => this.s3.upload(file),
    );

    const final = await this.repo.savePage(saved);
    this.logger.debug(`✅ Página final salva com sucesso. ID=${final.id}`);

    return final;
  }

  async updateWeekMaterialsPage(
    id: string,
    dto: any,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<WeekMaterialsPageEntity> {
    this.logger.debug(`🚠 Atualizando página de materiais ID=${id}`);

    const page = await this.repo.findOnePageById(id);
    if (!page) throw new Error('Página não encontrada');

    const { pageTitle, pageSubtitle, pageDescription } = dto;
    const incoming = this.mergeAllMedia(dto);
    const incomingIds = new Set(incoming.map((m) => m.id).filter(Boolean));

    const existingItems = await this.mediaItemProcessor.findMediaItemsByTarget(page.id, MediaTargetType.WeekMaterialsPage);
    const existingMap = new Map(existingItems.map((m) => [m.id, m]));

    this.logger.debug(`📦 ${existingItems.length} mídias atuais encontradas:`);
    existingItems.forEach((m) => this.logger.debug(`  📌 ${m.id} [${m.mediaType}] - ${m.title}`));

    const toRemove = existingItems.filter((item) => !incomingIds.has(item.id));
    this.logger.debug(`🪹 ${toRemove.length} mídias obsoletas para remoção`);
    for (const item of toRemove) {
      this.logger.debug(`🗑️ Removendo mídia ID=${item.id}, título="${item.title}"`);
      await this.mediaItemProcessor.removeMediaItem(item, this.s3.delete.bind(this.s3));
    }

    this.logger.debug(`⚙️ Processando ${incoming.length} mídias recebidas...`);

    for (const item of incoming) {
      const isNew = !item.id;
      const media = this.mediaItemProcessor.buildBaseMediaItem(item, page.id, MediaTargetType.WeekMaterialsPage);

      if (item.type === 'upload') {
        if (!isNew) {
          const existing = existingMap.get(item.id);
          if (!existing) {
            this.logger.warn(`⚠️ Mídia com ID=${item.id} não encontrada no banco`);
            continue;
          }

          media.url = existing.url;
          media.isLocalFile = existing.isLocalFile;
          media.originalName = existing.originalName;
          media.size = existing.size;

          this.logger.debug(`🔁 Atualizando mídia existente: ${media.title} (ID=${item.id})`);
        } else if (item.fileField && filesDict[item.fileField]) {
          const file = filesDict[item.fileField];
          media.url = await this.s3.upload(file);
          media.isLocalFile = true;
          media.originalName = file.originalname;
          media.size = file.size;

          this.logger.debug(`🆕 Upload novo arquivo: ${file.originalname}`);
        } else {
          throw new Error(`Arquivo ausente para mídia "${item.title}"`);
        }
      } else {
        media.url = item.url?.trim() || '';
        media.isLocalFile = false;
      }

      await this.mediaItemProcessor.upsertMediaItem(item.id, media);
    }

    const routeUpdate: Partial<Pick<RouteEntity, 'title' | 'subtitle' | 'description'>> = {};
    if (page.route.title !== pageTitle) routeUpdate.title = pageTitle;
    if (page.route.subtitle !== pageSubtitle) routeUpdate.subtitle = pageSubtitle;
    if (page.route.description !== pageDescription) routeUpdate.description = pageDescription;

    if (Object.keys(routeUpdate).length > 0) {
      this.logger.debug(`🛤️ Atualizando rota ID=${page.route.id}`);
      await this.routeService.updateRoute(page.route.id, routeUpdate);
    }

    page.title = pageTitle;
    page.subtitle = pageSubtitle;
    page.description = pageDescription;

    const updated = await this.repo.savePage(page);
    this.logger.debug(`✅ Página atualizada com sucesso. ID=${updated.id}`);
    return updated;
  }

  async removeWeekMaterial(id: string): Promise<void> {
    this.logger.debug(`🗑️ Removendo página de estudo ID=${id}`);

    const page = await this.repo.findOnePageById(id);
    if (!page) throw new Error('Página não encontrada');

    this.logger.debug(`🔗 Buscando mídias associadas...`);
    const mediaItems = await this.mediaItemProcessor.findMediaItemsByTarget(
      page.id,
      MediaTargetType.WeekMaterialsPage,
    );

    if (mediaItems.length) {
      this.logger.debug(`🎯 ${mediaItems.length} mídias encontradas. Iniciando remoção...`);
      await this.mediaItemProcessor.deleteMediaItems(mediaItems, (url) => this.s3.delete(url));
    }

    if (page.route?.id) {
      this.logger.debug(`🗺️ Removendo rota associada ID=${page.route.id}`);
      await this.routeService.removeRoute(page.route.id);
    }

    await this.repo.removePage(page);
    this.logger.debug(`✅ Página removida com sucesso. ID=${id}`);
  }

  async findAllPages(): Promise<WeekMaterialsPageEntity[]> {
    this.logger.debug('📥 Iniciando busca de todas as páginas de materiais de estudo...');

    const pages = await this.repo.findAllPages();
    this.logger.debug(`📄 Total de páginas encontradas: ${pages.length}`);

    return pages;
  }

  async findOnePage(id: string): Promise<WeekMaterialsPageEntity> {
    this.logger.debug(`📄 Buscando página ID=${id}`);
    const page = await this.repo.findOnePageById(id);
    if (!page) throw new Error('Página não encontrada');
    return page;
  }

  async findPageWithMedia(id: string): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`🔍 Buscando página com mídias ID=${id}`);
    const page = await this.findOnePage(id);

    const mediaItems = await this.mediaItemProcessor.findMediaItemsByTarget(
      page.id,
      MediaTargetType.WeekMaterialsPage,
    );

    this.logger.debug(`📦 ${mediaItems.length} mídias associadas encontradas.`);
    return WeekMaterialsPageResponseDTO.fromEntity(page, mediaItems);
  }

  async findAllPagesWithMedia(): Promise<WeekMaterialsPageResponseDTO[]> {
    this.logger.debug('📥 Buscando todas as páginas de materiais de estudo com mídias');

    const pages = await this.repo.findAllPages();
    const pageIds = pages.map((p) => p.id);

    this.logger.debug(`🔗 IDs das páginas: ${pageIds.join(', ')}`);

    const allMedia = await this.mediaItemProcessor.findManyMediaItemsByTargets(
      pageIds,
      MediaTargetType.WeekMaterialsPage,
    );

    const grouped = pageIds.reduce((acc, id) => {
      acc[id] = allMedia.filter((m) => m.targetId === id);
      return acc;
    }, {} as Record<string, MediaItemEntity[]>);

    return pages.map((page) =>
      WeekMaterialsPageResponseDTO.fromEntity(page, grouped[page.id] || [])
    );
  }

  private mergeAllMedia(dto: any): any[] {
    return [
      ...this.withType(dto.videos, 'video'),
      ...this.withType(dto.documents, 'document'),
      ...this.withType(dto.images, 'image'),
      ...this.withType(dto.audios, 'audio'),
    ];
  }

  private withType(items: any[] = [], type: string): any[] {
    return items.map((i) => ({ ...i, mediaType: type }));
  }
}

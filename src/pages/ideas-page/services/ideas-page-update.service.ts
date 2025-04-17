import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { RouteEntity, RouteType } from 'src/route/route-page.entity';
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { UpdateIdeasPageDto } from '../dto/update-ideas-page.dto';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { IdeasSectionEntity } from '../entities/ideas-section.entity';
import { MediaItemEntity, MediaType, UploadType } from 'src/share/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
import { IdeasSectionRepository } from '../repositories/ideas-section.repository';
import { In } from 'typeorm';

@Injectable()
export class IdeasPageUpdateService {
  private readonly logger = new Logger(IdeasPageUpdateService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly s3: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly pageRepo: IdeasPageRepository,
    private readonly sectionRepo: IdeasSectionRepository,
  ) {
    this.logger.debug('🛠️ IdeasPageUpdateService inicializado');
  }

  async updateIdeasPage(
    id: string,
    pageData: UpdateIdeasPageDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<IdeasPageEntity> {
    this.logger.log(`🚀 Iniciando atualização da página de ideias com ID: ${id}`);
    this.logger.debug(`📋 Dados recebidos: ${JSON.stringify(pageData, null, 2)}`);
    this.logger.debug(`📂 Arquivos recebidos: ${Object.keys(filesDict).join(', ') || 'nenhum'}`);
    const queryRunner = this.dataSource.createQueryRunner();
    this.logger.debug('🔗 Conectando ao QueryRunner');
    await queryRunner.connect();
    this.logger.debug('✅ QueryRunner conectado com sucesso');
    this.logger.debug('🔄 Iniciando transação');
    await queryRunner.startTransaction();
    this.logger.debug('✅ Transação iniciada');

    try {
      // Validações iniciais
      this.logger.debug(`🔍 Iniciando validação da página com ID: ${id}`);
      const ideasPageExisting = await this.validatePage(id, queryRunner);
      this.logger.debug(`🔍 Iniciando validação das seções da página ID: ${ideasPageExisting.id}`);
      const ideasSectionExisting = await this.validateSections(ideasPageExisting.id, queryRunner);
      this.logger.debug(`🔍 Iniciando validação da rota da página ID: ${ideasPageExisting.id}`);
      const ideasPageRouteExisting = await this.validateRoute(ideasPageExisting.id);
      this.logger.debug(`🔍 Iniciando validação das mídias das seções`);
      const oldMedia = await this.validateMedia(ideasSectionExisting.map(section => section.id), queryRunner);

      // Exclusão de seções e mídias obsoletas
      this.logger.debug(`🗑️ Iniciando exclusão de seções obsoletas`);
      await this.deleteSections(ideasSectionExisting, pageData.sections, queryRunner);
      this.logger.debug(`✅ Exclusão de seções concluída com sucesso`);
      this.logger.debug(`🗑️ Iniciando exclusão de mídias obsoletas`);
      await this.deleteMedia(oldMedia, pageData.sections, queryRunner);
      this.logger.debug(`✅ Exclusão de mídias concluída com sucesso`);

      // Atualização da página e rota
      this.logger.debug(`📝 Iniciando upsert da página com ID: ${id}`);
      const savedIdeasPage = await this.upsertIdeasPage(ideasPageExisting.id, pageData, queryRunner);
      this.logger.debug(`✅ Página upsertada com sucesso: ID=${savedIdeasPage.id}, title="${savedIdeasPage.title}"`);
      this.logger.debug(`🛤️ Iniciando upsert da rota com ID: ${ideasPageRouteExisting.id}`);
      const savedRoute = await this.upsertRoute(ideasPageRouteExisting.id, pageData, savedIdeasPage.id);
      this.logger.debug(`✅ Rota upsertada com sucesso: ID=${savedRoute.id}, path="${savedRoute.path}"`);

      // Processamento de seções e mídias
      const updatedSections: IdeasSectionEntity[] = [];
      const processedMediaIds: string[] = [];

      this.logger.debug(`📂 Iniciando processamento de ${pageData.sections.length} seções`);
      for (const sectionInput of pageData.sections) {
        this.logger.debug(`📝 Processando seção: title="${sectionInput.title}", id=${sectionInput.id || 'novo'}`);
        let savedSection: IdeasSectionEntity;

        if (sectionInput.id) {
          this.logger.debug(`🔄 Iniciando upsert de seção existente com ID: ${sectionInput.id}`);
          savedSection = await this.upsertSection(sectionInput, savedIdeasPage, queryRunner);
          this.logger.debug(`✅ Seção upsertada: ID=${savedSection.id}, title="${savedSection.title}"`);
        } else {
          this.logger.debug(`🆕 Iniciando adição de nova seção: title="${sectionInput.title}"`);
          savedSection = await this.addSection(sectionInput, savedIdeasPage, queryRunner);
          this.logger.debug(`✅ Nova seção adicionada: ID=${savedSection.id}, title="${savedSection.title}"`);
        }
        updatedSections.push(savedSection);

        this.logger.debug(`🖼️ Iniciando processamento de mídias para seção ID: ${savedSection.id}`);
        const oldSectionMedia = oldMedia.filter(m => m.targetId === savedSection.id);
        const processedMedia = await this.processSectionMedia(
          sectionInput.medias || [],
          savedSection.id,
          oldSectionMedia,
          filesDict,
          queryRunner
        );
        processedMediaIds.push(...processedMedia.map(m => m.id));
        this.logger.debug(`✅ ${processedMedia.length} mídias processadas para seção ID: ${savedSection.id}`);
        this.logger.debug(
          `📋 Mídias processadas: ${processedMedia.map(m => `ID=${m.id}, URL=${m.url}`).join('; ')}`
        );
      }

      // Associação e salvamento final
      this.logger.debug('🔗 Iniciando associação de seções e rota à página');
      savedIdeasPage.sections = updatedSections;
      savedIdeasPage.route = savedRoute;
      this.logger.debug('💾 Iniciando salvamento final da página com associações');
      const finalIdeasPage = await queryRunner.manager.save(IdeasPageEntity, savedIdeasPage);
      this.logger.debug(`✅ Página final salva com sucesso: ID=${finalIdeasPage.id}`);

      // Carregar mídias associadas dentro da transação
      this.logger.debug('🔍 Carregando mídias associadas para todas as seções dentro da transação');
      for (const section of finalIdeasPage.sections) {
        const medias = await queryRunner.manager.find(MediaItemEntity, {
          where: {
            targetId: section.id,
            targetType: MediaTargetType.IdeasSection,
            id: In(processedMediaIds),
          },
        });
        (section as any).medias = medias;
        this.logger.debug(
          `✅ Carregadas ${medias.length} mídias para seção ID=${section.id}: ${medias
            .map(m => `ID=${m.id}, URL=${m.url}`)
            .join('; ')}`
        );
      }

      this.logger.debug('✅ Iniciando commit da transação');
      await queryRunner.commitTransaction();
      this.logger.log(`✅ Página de ideias atualizada com sucesso: ID=${finalIdeasPage.id}`);
      return finalIdeasPage;
    } catch (error) {
      this.logger.error(`❌ Erro ao atualizar página de ideias com ID: ${id}. Iniciando rollback`, error.stack);
      this.logger.debug('🔙 Executando rollback da transação');
      await queryRunner.rollbackTransaction();
      this.logger.debug('✅ Rollback concluído com sucesso');
      throw new BadRequestException('Erro ao atualizar a página de ideias. Nenhum dado foi salvo.');
    } finally {
      this.logger.debug('🔚 Iniciando liberação do QueryRunner');
      await queryRunner.release();
      this.logger.debug('✅ QueryRunner liberado com sucesso');
    }
  }

  private async validatePage(id: string, queryRunner: QueryRunner): Promise<IdeasPageEntity> {
    this.logger.debug(`🔍 Buscando página com ID: ${id} no banco de dados`);
    const page = await queryRunner.manager.findOne(IdeasPageEntity, {
      where: { id },
      relations: ['route'],
    });
    if (!page) {
      this.logger.warn(`⚠️ Página com ID ${id} não encontrada`);
      throw new NotFoundException('Página de ideias não encontrada');
    }
    this.logger.debug(`✅ Página encontrada e validada: ID=${page.id}, title="${page.title}"`);
    return page;
  }

  private async validateSections(pageId: string, queryRunner: QueryRunner): Promise<IdeasSectionEntity[]> {
    this.logger.debug(`🔍 Buscando seções para página ID: ${pageId} no banco de dados`);
    const sections = await queryRunner.manager.find(IdeasSectionEntity, {
      where: { page: { id: pageId } },
    });
    if (!sections || sections.length === 0) {
      this.logger.warn(`⚠️ Nenhuma seção encontrada para página ID: ${pageId}`);
      throw new NotFoundException('Seções da página de ideias não encontradas');
    }
    this.logger.debug(`✅ ${sections.length} seções encontradas e validadas para página ID: ${pageId}`);
    return sections;
  }

  private async validateRoute(entityId: string): Promise<RouteEntity> {
    this.logger.debug(`🔍 Buscando rota para entityId: ${entityId}`);
    const route = await this.routeService.findRouteByEntityId(entityId);
    if (!route) {
      this.logger.warn(`⚠️ Rota para entityId ${entityId} não encontrada`);
      throw new NotFoundException('Rota da página de ideias não encontrada');
    }
    this.logger.debug(`✅ Rota encontrada e validada: ID=${route.id}, path="${route.path}"`);
    return route;
  }

  private async validateMedia(sectionIds: string[], queryRunner: QueryRunner): Promise<MediaItemEntity[]> {
    this.logger.debug(`🔍 Buscando mídias para ${sectionIds.length} seções: ${sectionIds.join(', ')}`);
    const media = await queryRunner.manager.find(MediaItemEntity, {
      where: {
        targetId: In(sectionIds),
        targetType: MediaTargetType.IdeasSection,
      },
    });
    if (!media || media.length === 0) {
      this.logger.warn(`⚠️ Nenhuma mídia encontrada para seções: ${sectionIds.join(', ')}`);
      throw new NotFoundException('Mídias associadas à página de ideias não encontradas');
    }
    this.logger.debug(`✅ ${media.length} mídias encontradas e validadas: ${media.map(m => `ID=${m.id}`).join(', ')}`);
    return media;
  }

  private async upsertIdeasPage(
    id: string,
    pageData: UpdateIdeasPageDto,
    queryRunner: QueryRunner,
  ): Promise<IdeasPageEntity> {
    this.logger.debug(`📝 Preparando upsert da página com ID: ${id}`);
    const ideasPageToUpsert: Partial<IdeasPageEntity> = {
      id,
      title: pageData.title,
      subtitle: pageData.subtitle,
      description: pageData.description,
    };
    this.logger.debug(`💾 Salvando página no banco com dados: ${JSON.stringify(ideasPageToUpsert)}`);
    const savedIdeasPage = await queryRunner.manager.save(IdeasPageEntity, ideasPageToUpsert);
    this.logger.debug(`✅ Página upsertada com sucesso: ID=${savedIdeasPage.id}, title="${savedIdeasPage.title}"`);
    return savedIdeasPage;
  }

  private async addSection(
    sectionInput: any,
    ideasPage: IdeasPageEntity,
    queryRunner: QueryRunner,
  ): Promise<IdeasSectionEntity> {
    this.logger.debug(`🆕 Preparando adição de nova seção: title="${sectionInput.title}"`);
    const sectionToAdd: Partial<IdeasSectionEntity> = {
      title: sectionInput.title,
      description: sectionInput.description,
      public: sectionInput.public ?? true,
      page: ideasPage,
    };
    this.logger.debug(`💾 Salvando nova seção no banco com dados: ${JSON.stringify(sectionToAdd)}`);
    const savedSection = await queryRunner.manager.save(IdeasSectionEntity, sectionToAdd);
    this.logger.debug(`✅ Nova seção adicionada com sucesso: ID=${savedSection.id}, title="${savedSection.title}"`);
    return savedSection;
  }

  private async deleteSections(
    existingSections: IdeasSectionEntity[],
    requestedSections: any[],
    queryRunner: QueryRunner,
  ): Promise<void> {
    this.logger.debug(`🗑️ Identificando seções para remoção`);
    const sectionsToRemove = existingSections.filter(
      existing => !requestedSections.some(requested => requested.id === existing.id),
    );
    this.logger.debug(
      `🗑️ ${sectionsToRemove.length} seções marcadas para remoção: ${sectionsToRemove.map(s => s.id).join(', ')}`
    );
    for (const section of sectionsToRemove) {
      this.logger.debug(`🗑️ Removendo seção ID: ${section.id}, title="${section.title}"`);
      await queryRunner.manager.remove(IdeasSectionEntity, section);
      this.logger.debug(`✅ Seção removida com sucesso: ID=${section.id}`);
    }
    this.logger.debug(`✅ Processo de remoção de seções concluído`);
  }

  private async deleteMedia(
    existingMedia: MediaItemEntity[],
    requestedSections: any[],
    queryRunner: QueryRunner,
  ): Promise<void> {
    this.logger.debug(`🗑️ Identificando mídias para remoção`);
    const requestedMediaIds = requestedSections
      .flatMap(section => section.medias.map(media => media.id))
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    this.logger.debug(`📋 IDs de mídias recebidas: ${requestedMediaIds.join(', ') || 'nenhum'}`);
    const mediaToRemove = existingMedia.filter(
      existing => existing.id && !requestedMediaIds.includes(existing.id),
    );
    this.logger.debug(
      `🗑️ ${mediaToRemove.length} mídias marcadas para remoção: ${mediaToRemove.map(m => m.id).join(', ')}`
    );
    for (const media of mediaToRemove) {
      if (!media.id) {
        this.logger.warn(`⚠️ Mídia sem ID detectada, pulando exclusão: URL=${media.url || 'desconhecida'}`);
        continue;
      }
      this.logger.debug(`🗑️ Iniciando remoção da mídia ID: ${media.id}, URL="${media.url || 'não fornecida'}"`);
      if (media.isLocalFile && media.url) {
        this.logger.debug(`🗑️ Removendo arquivo do S3: ${media.url}`);
        try {
          await this.s3.delete(media.url);
          this.logger.debug(`✅ Arquivo removido do S3 com sucesso: ${media.url}`);
        } catch (error) {
          this.logger.error(`❌ Falha ao remover arquivo do S3: ${media.url}`, error.stack);
          throw new BadRequestException(`Falha ao remover arquivo do S3: ${media.url}`);
        }
      }
      this.logger.debug(`🗑️ Removendo mídia do banco de dados: ID=${media.id}`);
      await queryRunner.manager.delete(MediaItemEntity, { id: media.id });
      this.logger.debug(`✅ Mídia removida do banco com sucesso: ID=${media.id}`);
    }
    this.logger.debug(`✅ Processo de remoção de mídias concluído`);
  }

  private async addMedia(
    mediaInput: any,
    targetId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity> {
    this.logger.debug(
      `🆕 Iniciando adição de mídia: fieldKey="${mediaInput.fieldKey || 'não fornecido'}"`
    );
    this.logger.debug(`📋 Construindo base da mídia para targetId: ${targetId}`);
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      mediaInput,
      targetId,
      MediaTargetType.IdeasSection
    );
    if (mediaInput.isLocalFile && mediaInput.uploadType === UploadType.UPLOAD) {
      this.logger.debug(
        `🔍 Verificando arquivo para upload: fieldKey=${mediaInput.fieldKey || mediaInput.url}`
      );
      const key = mediaInput.fieldKey ?? mediaInput.url;
      if (!key) {
        this.logger.error(`❌ Arquivo ausente para upload: nenhum fieldKey ou url fornecido`);
        throw new BadRequestException(`Arquivo ausente para upload: nenhum fieldKey ou url fornecido`);
      }
      const file = filesDict[key];
      if (!file) {
        this.logger.error(`❌ Arquivo não encontrado para chave: ${key}`);
        throw new BadRequestException(`Arquivo não encontrado para upload: ${key}`);
      }
      this.logger.debug(`📤 Iniciando upload do arquivo para S3: ${file.originalname}`);
      media.url = await this.s3.upload(file);
      media.originalName = file.originalname;
      media.size = file.size;
      this.logger.debug(`✅ Upload concluído com sucesso, URL: ${media.url}`);
    }
    this.logger.debug(`💾 Salvando mídia no banco com dados: ${JSON.stringify(media)}`);
    const savedMedia = await queryRunner.manager.save(MediaItemEntity, media);
    this.logger.debug(
      `✅ Mídia adicionada com sucesso: ID=${savedMedia.id}, URL=${savedMedia.url}, targetId=${savedMedia.targetId}, targetType=${savedMedia.targetType}`
    );
    return savedMedia;
  }

  private async upsertSection(
    sectionInput: any,
    ideasPage: IdeasPageEntity,
    queryRunner: QueryRunner,
  ): Promise<IdeasSectionEntity> {
    this.logger.debug(
      `🔄 Preparando upsert de seção: ID=${sectionInput.id}, title="${sectionInput.title}"`
    );
    const sectionToUpsert: Partial<IdeasSectionEntity> = {
      id: sectionInput.id,
      title: sectionInput.title,
      description: sectionInput.description,
      public: sectionInput.public ?? true,
      page: ideasPage,
    };
    this.logger.debug(`💾 Salvando seção no banco com dados: ${JSON.stringify(sectionToUpsert)}`);
    const savedSection = await queryRunner.manager.save(IdeasSectionEntity, sectionToUpsert);
    this.logger.debug(
      `✅ Seção upsertada com sucesso: ID=${savedSection.id}, title="${savedSection.title}"`
    );
    return savedSection;
  }

  private async upsertMedia(
    mediaInput: any,
    targetId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity> {
    this.logger.debug(
      `🔄 Iniciando upsert de mídia: ID=${mediaInput.id || 'novo'}, fieldKey="${mediaInput.fieldKey || 'não fornecido'}"`
    );
    this.logger.debug(`📋 Construindo base da mídia para targetId: ${targetId}`);
    const media = this.mediaItemProcessor.buildBaseMediaItem(
      mediaInput,
      targetId,
      MediaTargetType.IdeasSection
    );
    if (mediaInput.isLocalFile && !mediaInput.id && mediaInput.uploadType === UploadType.UPLOAD) {
      this.logger.debug(
        `🔍 Verificando arquivo para upload: fieldKey=${mediaInput.fieldKey || mediaInput.url}`
      );
      const key = mediaInput.fieldKey ?? mediaInput.url;
      if (!key) {
        this.logger.error(`❌ Arquivo ausente para upload: nenhum fieldKey ou url fornecido`);
        throw new BadRequestException(`Arquivo ausente para upload: nenhum fieldKey ou url fornecido`);
      }
      const file = filesDict[key];
      if (!file) {
        this.logger.error(`❌ Arquivo não encontrado para chave: ${key}`);
        throw new BadRequestException(`Arquivo não encontrado para upload: ${key}`);
      }
      this.logger.debug(`📤 Iniciando upload do arquivo para S3: ${file.originalname}`);
      media.url = await this.s3.upload(file);
      media.originalName = file.originalname;
      media.size = file.size;
      this.logger.debug(`✅ Upload concluído com sucesso, URL: ${media.url}`);
    }
    this.logger.debug(`💾 Salvando mídia no banco com dados: ${JSON.stringify(media)}`);
    const savedMedia = await queryRunner.manager.save(MediaItemEntity, {
      ...media,
      id: mediaInput.id,
    });
    this.logger.debug(
      `✅ Mídia upsertada com sucesso: ID=${savedMedia.id}, URL=${savedMedia.url}, targetId=${savedMedia.targetId}, targetType=${savedMedia.targetType}`
    );
    return savedMedia;
  }

  private async upsertRoute(
    routeId: string,
    pageData: UpdateIdeasPageDto,
    ideasPageId: string,
  ): Promise<RouteEntity> {
    this.logger.debug(`🛤️ Iniciando upsert da rota com ID: ${routeId}`);
    const routeData: Partial<RouteEntity> = {
      title: pageData.title,
      subtitle: pageData.subtitle,
      description: pageData.description,
      idToFetch: ideasPageId,
      entityType: 'IdeasPage',
      entityId: ideasPageId,
      type: RouteType.PAGE,
      path: 'galeria_ideias_',
      image: 'https://bucket-clubinho-galeria.s3.amazonaws.com/uploads/img_card.jpg',
    };
    this.logger.debug(`📋 Dados da rota preparados: ${JSON.stringify(routeData)}`);
    this.logger.debug(`💾 Iniciando salvamento da rota no banco`);
    const savedRoute = await this.routeService.upsertRoute(routeId, routeData);
    this.logger.debug(
      `✅ Rota upsertada com sucesso: ID=${savedRoute.id}, path="${savedRoute.path}"`
    );
    return savedRoute;
  }

  private async processSectionMedia(
    mediaItems: any[],
    sectionId: string,
    oldMedia: MediaItemEntity[],
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity[]> {
    this.logger.debug(`📽️ Iniciando processamento de ${mediaItems.length} mídias para seção ID: ${sectionId}`);
    const processedMedia: MediaItemEntity[] = [];
    for (const mediaInput of mediaItems) {
      this.logger.debug(
        `📽️ Processando mídia: id=${mediaInput.id || 'novo'}, fieldKey="${mediaInput.fieldKey || 'não fornecido'}", mediaType=${mediaInput.mediaType}, uploadType=${mediaInput.uploadType}`
      );
      if (mediaInput.id) {
        this.logger.debug(`🔄 Iniciando upsert de mídia existente com ID: ${mediaInput.id}`);
        const savedMedia = await this.upsertMedia(mediaInput, sectionId, filesDict, queryRunner);
        processedMedia.push(savedMedia);
        this.logger.debug(
          `✅ Mídia upsertada com sucesso: ID=${savedMedia.id}, URL=${savedMedia.url}, targetId=${savedMedia.targetId}, targetType=${savedMedia.targetType}`
        );
      } else {
        this.logger.debug(
          `🆕 Iniciando adição de nova mídia: fieldKey="${mediaInput.fieldKey || 'não fornecido'}"`
        );
        const savedMedia = await this.addMedia(mediaInput, sectionId, filesDict, queryRunner);
        processedMedia.push(savedMedia);
        this.logger.debug(
          `✅ Nova mídia adicionada com sucesso: ID=${savedMedia.id}, URL=${savedMedia.url}, targetId=${savedMedia.targetId}, targetType=${savedMedia.targetType}`
        );
      }
    }
    this.logger.debug(
      `✅ Processamento de mídias concluído: ${processedMedia.length} mídias processadas para seção ID: ${sectionId}`
    );
    return processedMedia;
  }
}
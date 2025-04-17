import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { RouteEntity, RouteType } from 'src/route/route-page.entity';
import {
  MediaItemEntity,
  PlatformType,
  MediaType,
  UploadType,
} from 'src/share/media/media-item/media-item.entity';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { VideosPage } from '../entities/video-page.entity';
import { UpdateVideosPageDto } from '../dto/update-videos-page.dto';
import { VideosPageResponseDto } from '../dto/videos-page-response.dto';
import { VideosPageRepository } from '../video-page.repository';

@Injectable()
export class UpdateVideosPageService {
  private readonly logger = new Logger(UpdateVideosPageService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly awsS3Service: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly videosPageRepo: VideosPageRepository,
  ) {
    this.logger.debug('🛠️ UpdateVideosPageService inicializado');
  }

  async execute(
    id: string,
    dto: UpdateVideosPageDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<VideosPageResponseDto> {
    this.logger.log(`🚀 Iniciando atualização da página de vídeos com ID: ${id}`);
    const queryRunner = this.dataSource.createQueryRunner();
    this.logger.debug('🔗 Conectando ao QueryRunner');
    await queryRunner.connect();
    this.logger.debug('✅ QueryRunner conectado');
    this.logger.debug('🔄 Iniciando transação');
    await queryRunner.startTransaction();
    this.logger.debug('✅ Transação iniciada');

    try {
      this.logger.debug(`🔍 Buscando página de vídeos com ID: ${id}`);
      const existingPage = await this.videosPageRepo.findById(id);
      if (!existingPage) {
        this.logger.warn(`⚠️ Página não encontrada para ID: ${id}`);
        throw new NotFoundException('Página não encontrada');
      }
      this.logger.debug(`✅ Página encontrada: title="${existingPage.name}"`);

      this.logger.debug(`🔍 Buscando mídias existentes para a página ID: ${existingPage.id}`);
      const existingMedia = await this.mediaItemProcessor.findManyMediaItemsByTargets(
        [existingPage.id],
        'VideosPage',
      );
      this.logger.debug(`✅ Encontradas ${existingMedia.length} mídias existentes`);

      this.logger.debug(`🗑️ Iniciando remoção de mídias não mais presentes na requisição`);
      await this.deleteMedia(existingMedia, dto.videos, queryRunner);
      this.logger.debug(`✅ Remoção de mídias concluída`);

      this.logger.debug(`📝 Atualizando dados da página: title="${dto.title}", public=${dto.public}`);
      existingPage.name = dto.title;
      existingPage.description = dto.description;
      existingPage.public = dto.public;
      this.logger.debug(`💾 Salvando página atualizada`);
      const updatedPage = await queryRunner.manager.save(existingPage);
      this.logger.debug(`✅ Página salva com ID: ${updatedPage.id}`);

      this.logger.debug(`🔄 Iniciando atualização da rota para a página ID: ${updatedPage.id}`);
      const savedRoute = await this.upsertRoute(existingPage.route.id, dto, updatedPage.id);
      this.logger.debug(`✅ Rota atualizada com path: ${savedRoute.path}`);

      this.logger.debug(`📽️ Iniciando processamento de mídias da página`);
      const mediaItems = await this.processPageMedia(
        dto.videos,
        updatedPage.id,
        existingMedia,
        filesDict,
        queryRunner,
      );
      this.logger.debug(`✅ Processadas ${mediaItems.length} mídias`);

      this.logger.debug(`🔗 Associando rota à página`);
      updatedPage.route = savedRoute;
      this.logger.debug(`💾 Salvando página com rota associada`);
      const finalPage = await queryRunner.manager.save(updatedPage);
      this.logger.debug(`✅ Página final salva com ID: ${finalPage.id}`);

      this.logger.debug(`✅ Iniciando commit da transação`);
      await queryRunner.commitTransaction();
      this.logger.log(`✅ Página de vídeos atualizada com sucesso: ID=${finalPage.id}`);
      this.logger.debug(`📤 Preparando resposta DTO para página ID: ${finalPage.id}`);
      return VideosPageResponseDto.fromEntity(finalPage, mediaItems);
    } catch (error) {
      this.logger.error('❌ Erro ao atualizar página de vídeos. Iniciando rollback.', error.stack);
      this.logger.debug('🔙 Executando rollback da transação');
      await queryRunner.rollbackTransaction();
      this.logger.debug('✅ Rollback concluído');
      throw new BadRequestException('Erro ao atualizar a página de vídeos.');
    } finally {
      this.logger.debug('🔚 Liberando QueryRunner');
      await queryRunner.release();
      this.logger.debug('✅ QueryRunner liberado');
    }
  }

  private async upsertRoute(
    routeId: string,
    pageData: UpdateVideosPageDto,
    videoPageId: string,
  ): Promise<RouteEntity> {
    this.logger.debug(`🔄 Iniciando upsert da rota ID: ${routeId}`);
    const routeData: Partial<RouteEntity> = {
      title: pageData.title,
      subtitle: 'Página de vídeos',
      idToFetch: videoPageId,
      entityType: 'VideosPage',
      entityId: videoPageId,
      public: pageData.public,
      type: RouteType.PAGE,
      description: pageData.description,
      path: 'galeria_videos_',
      image: 'https://bucket-clubinho-galeria.s3.us-east-2.amazonaws.com/uploads/img_card.jpg',
    };
    this.logger.debug(`📋 Dados da rota preparados: title="${routeData.title}", path="${routeData.path}"`);
    this.logger.debug(`💾 Salvando rota no banco`);
    const savedRoute = await this.routeService.upsertRoute(routeId, routeData);
    this.logger.debug(`✅ Rota upsertada: ID=${savedRoute.id}, path=${savedRoute.path}`);
    return savedRoute;
  }

  private async deleteMedia(
    existingMedia: MediaItemEntity[],
    requestedMedia: any[],
    queryRunner: QueryRunner,
  ): Promise<void> {
    this.logger.debug(`🗑️ Iniciando identificação de mídias a remover`);
    const requestedMediaIds = requestedMedia
      .map((media) => media.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    this.logger.debug(`📋 IDs de mídias recebidas: ${requestedMediaIds.join(', ') || 'nenhum'}`);
    const mediaToRemove = existingMedia.filter(
      (existing) => existing.id && !requestedMediaIds.includes(existing.id),
    );
    this.logger.debug(`🗑️ ${mediaToRemove.length} mídias marcadas para remoção`);

    for (const media of mediaToRemove) {
      if (!media.id) {
        this.logger.warn(`⚠️ Mídia sem ID detectada, pulando exclusão: URL=${media.url || 'desconhecida'}`);
        continue;
      }
      this.logger.debug(`🗑️ Processando remoção da mídia ID: ${media.id}, URL: ${media.url || 'não fornecida'}`);
      
      if (media.isLocalFile && media.url) {
        this.logger.debug(`🗑️ Removendo arquivo do S3: ${media.url}`);
        try {
          await this.awsS3Service.delete(media.url);
          this.logger.debug(`✅ Arquivo removido do S3: ${media.url}`);
        } catch (error) {
          this.logger.error(`❌ Falha ao remover arquivo do S3: ${media.url}`, error.stack);
          throw new BadRequestException(`Falha ao remover arquivo do S3: ${media.url}`);
        }
      } else {
        this.logger.debug(`ℹ️ Mídia não é arquivo local ou não possui URL, pulando remoção do S3`);
      }

      this.logger.debug(`🗑️ Removendo mídia do banco de dados: ID=${media.id}`);
      await queryRunner.manager.remove(MediaItemEntity, media);
      this.logger.debug(`✅ Mídia removida do banco de dados: ID=${media.id}`);
    }
    this.logger.debug(`✅ Remoção de mídias concluída`);
  }

  private async processPageMedia(
    mediaItems: any[],
    pageId: string,
    oldMedia: MediaItemEntity[],
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity[]> {
    this.logger.debug(`📽️ Iniciando processamento de ${mediaItems.length} mídias`);
    const processed: MediaItemEntity[] = [];
    for (const mediaInput of mediaItems) {
      this.logger.debug(`📽️ Processando mídia: type=${mediaInput.type}, id=${mediaInput.id || 'novo'}`);
      if (mediaInput.id) {
        this.logger.debug(`🔄 Iniciando upsert para mídia existente ID: ${mediaInput.id}`);
        const saved = await this.upsertMedia(mediaInput, pageId, filesDict, queryRunner);
        processed.push(saved);
        this.logger.debug(`✅ Mídia upsertada: ID=${saved.id}`);
      } else {
        this.logger.debug(`➕ Iniciando adição de nova mídia`);
        const saved = await this.addMedia(mediaInput, pageId, filesDict, queryRunner);
        processed.push(saved);
        this.logger.debug(`✅ Nova mídia adicionada: ID=${saved.id}`);
      }
    }
    this.logger.debug(`✅ Finalizado processamento de ${processed.length} mídias`);
    return processed;
  }

  private async addMedia(
    mediaInput: any,
    targetId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity> {
    this.logger.debug(`➕ Iniciando adição de nova mídia: type=${mediaInput.type}, fieldKey=${mediaInput.fieldKey || 'não fornecido'}`);
    const media = new MediaItemEntity();
    this.logger.debug(`📋 Construindo base da mídia para targetId: ${targetId}`);
    Object.assign(media, this.mediaItemProcessor.buildBaseMediaItem(
      {
        ...mediaInput,
        mediaType: MediaType.VIDEO,
        type: mediaInput.type as UploadType,
        platformType: mediaInput.platformType as PlatformType,
      },
      targetId,
      'VideosPage',
    ));
    this.logger.debug(`✅ Base da mídia construída`);

    if (mediaInput.type === UploadType.UPLOAD && mediaInput.isLocalFile) {
      this.logger.debug(`🔍 Verificando arquivo para upload: fieldKey=${mediaInput.fieldKey || mediaInput.url}`);
      const file = filesDict[mediaInput.fieldKey || mediaInput.url];
      if (!file) {
        this.logger.error(`❌ Arquivo ausente para upload: ${mediaInput.fieldKey || mediaInput.url}`);
        throw new BadRequestException(`Arquivo ausente para upload: ${mediaInput.fieldKey || mediaInput.url}`);
      }
      this.logger.debug(`📤 Iniciando upload do arquivo para S3: ${file.originalname}`);
      media.url = await this.awsS3Service.upload(file);
      media.isLocalFile = true;
      media.originalName = file.originalname;
      media.size = file.size;
      this.logger.debug(`✅ Upload concluído, URL: ${media.url}`);
    } else if (mediaInput.type === UploadType.LINK || mediaInput.isLocalFile === false) {
      if (!mediaInput.url) {
        this.logger.error('❌ URL obrigatória para vídeos do tipo link');
        throw new BadRequestException('URL obrigatória para vídeos do tipo link.');
      }
      this.logger.debug(`🔗 Usando URL fornecida: ${mediaInput.url}`);
      media.url = mediaInput.url;
      media.isLocalFile = false;
      media.platformType = mediaInput.platformType || PlatformType.YOUTUBE;
      this.logger.debug(`✅ Plataforma definida: ${media.platformType}`);
    } else {
      this.logger.error(`❌ Tipo de mídia inválido: ${mediaInput.type}`);
      throw new BadRequestException(`Tipo de mídia inválido: ${mediaInput.type}`);
    }

    this.logger.debug(`💾 Iniciando salvamento da nova mídia no banco de dados`);
    const savedMedia = await queryRunner.manager.save(MediaItemEntity, media);
    this.logger.debug(`✅ Nova mídia salva com ID: ${savedMedia.id}`);
    return savedMedia;
  }

  private async upsertMedia(
    mediaInput: any,
    targetId: string,
    filesDict: Record<string, Express.Multer.File>,
    queryRunner: QueryRunner,
  ): Promise<MediaItemEntity> {
    this.logger.debug(`🔄 Iniciando atualização da mídia: ID=${mediaInput.id}, type=${mediaInput.type}`);

    this.logger.debug(`🔍 Buscando mídia existente com ID: ${mediaInput.id}`);
    const existingMedia = await queryRunner.manager.findOne(MediaItemEntity, { where: { id: mediaInput.id } });
    if (!existingMedia) {
      this.logger.warn(`⚠️ Mídia com ID ${mediaInput.id} não encontrada`);
      throw new NotFoundException(`Mídia com id ${mediaInput.id} não encontrada.`);
    }
    this.logger.debug(`✅ Mídia existente encontrada: URL=${existingMedia.url}`);

    const media = new MediaItemEntity();
    this.logger.debug(`📋 Construindo base da mídia para atualização`);
    Object.assign(media, this.mediaItemProcessor.buildBaseMediaItem(
      {
        ...mediaInput,
        mediaType: MediaType.VIDEO,
        type: mediaInput.type as UploadType,
        platformType: mediaInput.platformType as PlatformType,
      },
      targetId,
      'VideosPage',
    ));
    media.id = mediaInput.id;
    this.logger.debug(`✅ Base da mídia construída com ID: ${media.id}`);

    if (mediaInput.type === UploadType.UPLOAD) {
      this.logger.debug(`🔍 Verificando arquivo para upload: fieldKey=${mediaInput.fieldKey || 'não fornecido'}`);
      const file = filesDict[mediaInput.fieldKey];
      if (file) {
        this.logger.debug(`📤 Novo arquivo detectado, iniciando upload para S3: ${file.originalname}`);
        media.url = await this.awsS3Service.upload(file);
        media.isLocalFile = true;
        media.originalName = file.originalname;
        media.size = file.size;
        this.logger.debug(`✅ Upload concluído, nova URL: ${media.url}`);
      } else {
        this.logger.debug(`🔗 Nenhum novo arquivo fornecido, mantendo dados existentes`);
        media.url = existingMedia.url;
        media.isLocalFile = existingMedia.isLocalFile;
        media.originalName = existingMedia.originalName;
        media.size = existingMedia.size;
        this.logger.debug(`✅ Dados existentes mantidos: URL=${media.url}`);
      }
    } else if (mediaInput.type === UploadType.LINK) {
      if (!mediaInput.url) {
        this.logger.error('❌ URL obrigatória para vídeos do tipo link');
        throw new BadRequestException('URL obrigatória para vídeos do tipo link.');
      }
      this.logger.debug(`🔗 Atualizando com nova URL: ${mediaInput.url}`);
      media.url = mediaInput.url;
      media.isLocalFile = false;
      media.platformType = mediaInput.platformType || PlatformType.YOUTUBE;
      this.logger.debug(`✅ Plataforma definida: ${media.platformType}`);
    } else {
      this.logger.error(`❌ Tipo de mídia inválido: ${mediaInput.type}`);
      throw new BadRequestException(`Tipo de mídia inválido: ${mediaInput.type}`);
    }

    this.logger.debug(`💾 Iniciando salvamento da mídia atualizada no banco de dados`);
    const savedMedia = await queryRunner.manager.save(MediaItemEntity, media);
    this.logger.debug(`✅ Mídia atualizada salva com ID: ${savedMedia.id}`);
    return savedMedia;
  }
}
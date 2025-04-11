import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { RouteEntity, RouteType } from 'src/route/route-page.entity';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { WeekMaterialsPageRepository } from '../week-material.repository';
import { MediaItemEntity, MediaType } from 'src/share/media/media-item/media-item.entity';
import { CreateWeekMaterialsPageDto } from '../dto/create-week-material.dto';
import { WeekMaterialsPageResponseDTO } from '../dto/week-material-response.dto';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';

@Injectable()
export class WeekMaterialsPageCreateService {
  private readonly logger = new Logger(WeekMaterialsPageCreateService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly repo: WeekMaterialsPageRepository,
    private readonly s3: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async createWeekMaterialsPage(
    dto: CreateWeekMaterialsPageDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<WeekMaterialsPageResponseDTO> {
    this.logger.debug(`🚧 Criando nova página: "${dto.pageTitle}"`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedPage: WeekMaterialsPageEntity;
    let mediaItems: MediaItemEntity[] = [];

    try {
      // Criar a página
      const page = queryRunner.manager.create(WeekMaterialsPageEntity, {
        title: dto.pageTitle,
        subtitle: dto.pageSubtitle,
        description: dto.pageDescription,
      });
      savedPage = await queryRunner.manager.save(page);
      this.logger.debug(`💾 Página salva. ID=${savedPage.id}`);

      // Criar a rota
      const path = await this.routeService.generateAvailablePath(dto.pageTitle, 'semana_');
      const route = await this.routeService.createRouteWithManager(queryRunner.manager, {
        title: dto.pageTitle,
        subtitle: dto.pageSubtitle,
        description: dto.pageDescription,
        path,
        type: RouteType.PAGE,
        entityId: savedPage.id,
        idToFetch: savedPage.id,
        entityType: 'WeekMaterialsPage',
        image: '',
      });
      this.logger.debug(`🛤️ Rota criada. ID=${route.id}`);

      // Associar a rota à página
      savedPage.route = route;
      await queryRunner.manager.save(savedPage);

      // Processar mídias com tipo correto
      const adjustedMediaItems = this.mergeAndFixMedia({
        videos: dto.videos || [],
        documents: dto.documents || [],
        images: dto.images || [],
        audios: dto.audios || [],
      });
      this.logger.debug(`Itens de mídia ajustados: ${JSON.stringify(adjustedMediaItems)}`);

      mediaItems = await this.mediaItemProcessor.processMediaItemsPolymorphic(
        adjustedMediaItems,
        savedPage.id,
        MediaTargetType.WeekMaterialsPage,
        filesDict,
        this.s3.upload.bind(this.s3),
      );

      await queryRunner.commitTransaction();
      this.logger.debug(`✅ Página criada com sucesso. ID=${savedPage.id}`);

      return WeekMaterialsPageResponseDTO.fromEntity(savedPage, mediaItems);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Erro ao criar página. Rollback executado.', error);
      throw new BadRequestException(`Erro ao criar a página de materiais: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  private mergeAndFixMedia(dto: {
    videos: any[];
    documents: any[];
    images: any[];
    audios: any[];
  }): any[] {
    // Mapear itens com seus respectivos mediaTypes
    const videos = (dto.videos || []).map((item) => ({
      ...item,
      mediaType: MediaType.VIDEO,
      fileField: item.type === 'upload' && item.isLocalFile ? item.fieldKey : undefined,
    }));
    const documents = (dto.documents || []).map((item) => ({
      ...item,
      mediaType: MediaType.DOCUMENT,
      fileField: item.type === 'upload' && item.isLocalFile ? item.fieldKey : undefined,
    }));
    const images = (dto.images || []).map((item) => ({
      ...item,
      mediaType: MediaType.IMAGE,
      fileField: item.type === 'upload' && item.isLocalFile ? item.fieldKey : undefined,
    }));
    const audios = (dto.audios || []).map((item) => ({
      ...item,
      mediaType: MediaType.AUDIO,
      fileField: item.type === 'upload' && item.isLocalFile ? item.fieldKey : undefined,
    }));

    // Combinar todos os itens
    const mediaItems = [...videos, ...documents, ...images, ...audios];

    // Validar itens de upload
    mediaItems.forEach((item) => {
      if (item.type === 'upload' && item.isLocalFile && !item.fileField) {
        throw new BadRequestException(`fieldKey ausente para item de mídia: ${item.title}`);
      }
    });

    return mediaItems;
  }
}
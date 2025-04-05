import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MeditationRepository } from './meditation.repository';
import { CreateMeditationDto } from './dto/create-meditation.dto';
import { UpdateMeditationDto } from './dto/update-meditation.dto';
import { MeditationEntity } from './entities/meditation.entity';
import { AwsS3Service } from '../aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { RouteType } from 'src/route/route-page.entity';
import {
  MediaItemEntity,
  MediaPlatform,
  MediaType,
  MediaUploadType,
} from 'src/share/media/media-item/media-item.entity';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { DayEntity } from './entities/day.entity';
import { WeekMeditationResponseDto } from './dto/week-meditation-response-dto';

@Injectable()
export class MeditationService {
  private readonly logger = new Logger(MeditationService.name);

  constructor(
    @Inject(MeditationRepository)
    private readonly meditationRepo: MeditationRepository,
    private readonly s3Service: AwsS3Service,
    private readonly dataSource: DataSource,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) { }

  async create(
    dto: CreateMeditationDto,
    file?: Express.Multer.File,
  ): Promise<MeditationEntity> {
    try {
      this.logger.log('🟡 Iniciando criação da meditação...');
      this.logger.debug('📦 DTO recebido:\n' + JSON.stringify(dto, null, 2));
  
      const startDate = parseDateAsLocal(dto.startDate);
      const endDate = parseDateAsLocal(dto.endDate);
  
      this.logger.debug(`📅 startDate: ${startDate} (getDay=${startDate.getDay()})`);
      this.logger.debug(`📅 endDate: ${endDate} (getDay=${endDate.getDay()})`);
  
      if (startDate.getDay() !== 1) {
        throw new BadRequestException('startDate deve ser uma segunda-feira (Monday)');
      }
  
      if (endDate.getDay() !== 5) {
        throw new BadRequestException('endDate deve ser uma sexta-feira (Friday)');
      }
  
      this.logger.log('🔍 Verificando conflitos com meditações existentes...');
      const existing = await this.meditationRepo.findAllWithRelations();
      this.logger.debug(`📋 Meditações existentes: ${existing.length}`);
  
      const hasConflict = existing.some((m) => {
        const s = new Date(m.startDate);
        const e = new Date(m.endDate);
        return (
          (startDate >= s && startDate <= e) ||
          (endDate >= s && endDate <= e) ||
          (startDate <= s && endDate >= e)
        );
      });
  
      if (hasConflict) {
        throw new BadRequestException('Conflito com datas de uma meditação existente.');
      }
  
      this.logger.log('📥 Criando entidade da meditação...');
      const meditation = this.meditationRepo.create({
        topic: dto.topic,
        startDate: dto.startDate,
        endDate: dto.endDate,
        days: dto.days,
      });
  
      this.logger.log('💾 Salvando meditação...');
      const savedMeditation = await this.meditationRepo.save(meditation);
      this.logger.log(`✅ Meditação salva com ID: ${savedMeditation.id}`);
  
      this.logger.log('🎞️ Processando mídia da meditação...');
      this.logger.debug('🎯 Dados da mídia recebidos:\n' + JSON.stringify(dto.media, null, 2));
  
      let mediaUrl = dto.media.url?.trim() || '';
      let originalName = dto.media.originalName;
      let size = dto.media.size;
  
      if (dto.media.isLocalFile) {
        if (!file) {
          this.logger.warn('⚠️ isLocalFile está true mas nenhum arquivo foi enviado!');
        } else {
          this.logger.log(`⬆️ Enviando arquivo para o S3: ${file.originalname}`);
          mediaUrl = await this.s3Service.upload(file);
          originalName = file.originalname;
          size = file.size;
          this.logger.debug(`✅ Upload concluído. URL do S3: ${mediaUrl}`);
        }
      }
  
      const mediaData = {
        title: dto.media.title,
        description: dto.media.description,
        mediaType: MediaType.DOCUMENT,
        type: dto.media.type,
        platform: dto.media.platform ?? null,
        fileField: 'file',
        isLocalFile: dto.media.isLocalFile,
        url: mediaUrl,
        originalName,
        size,
      };
  
      this.logger.debug('📦 Dados finais da mídia a serem salvos:\n' + JSON.stringify(mediaData, null, 2));
  
      const mediaEntity = this.mediaItemProcessor.buildBaseMediaItem(
        mediaData,
        savedMeditation.id,
        'meditation',
      );
  
      const savedMedia = await this.mediaItemProcessor.saveMediaItem(mediaEntity);
      this.logger.debug(`💾 Mídia salva com ID: ${savedMedia.id} | URL: ${savedMedia.url}`);
  
      this.logger.log('🛤️ Criando rota da meditação...');
      const route = await this.routeService.createRoute({
        title: savedMeditation.topic,
        subtitle: '',
        idToFetch: savedMeditation.id,
        entityType: 'meditation',
        description: `Meditação semanal de ${dto.startDate} a ${dto.endDate}`,
        entityId: savedMeditation.id,
        type: RouteType.DOC,
        prefix: 'meditacao_',
        image: '',
      });
  
      this.logger.log(`✅ Rota criada com sucesso: path=${route.path}`);
      this.logger.log(`🎉 Meditação, mídia e rota criadas com sucesso! 🆔 ${savedMeditation.id}`);
  
      return savedMeditation;
    } catch (error) {
      this.logger.error('❌ Erro na criação da meditação:', error);
      throw new BadRequestException(
        error?.message || 'Erro inesperado ao criar meditação. Verifique os dados enviados.',
      );
    }
  }
  
  
  
  
  
  


  async update(
    id: string,
    dto: UpdateMeditationDto & { isLocalFile?: boolean },
    file?: Express.Multer.File,
  ): Promise<MeditationEntity> {
    this.logger.log(`🛠️ Atualizando meditação ID=${id}`);
    this.logger.debug(`🔍 Buscando meditação com ID=${id}`);

    const existing = await this.findOne(id);

    const startDate = dto.startDate ? parseDateAsLocal(dto.startDate) : existing.startDate;
    const endDate = dto.endDate ? parseDateAsLocal(dto.endDate) : existing.endDate;

    if (dto.startDate && startDate.getDay() !== 1) {
      throw new BadRequestException('startDate deve ser uma segunda-feira (Monday)');
    }

    if (dto.endDate && endDate.getDay() !== 5) {
      throw new BadRequestException('endDate deve ser uma sexta-feira (Friday)');
    }

    const all = await this.meditationRepo.findAllWithRelations();
    const hasConflict = all.some((m) => {
      if (m.id === id) return false;
      const s = new Date(m.startDate);
      const e = new Date(m.endDate);
      return (
        (startDate >= s && startDate <= e) ||
        (endDate >= s && endDate <= e) ||
        (startDate <= s && endDate >= e)
      );
    });

    if (hasConflict) {
      throw new BadRequestException('Conflito com outra meditação existente.');
    }

    return await this.dataSource.transaction(async (manager) => {
      const updatedMeditation = manager.merge(MeditationEntity, existing, {
        ...dto,
        startDate,
        endDate,
      });

      const savedMeditation = await manager.save(MeditationEntity, updatedMeditation);
      this.logger.log(`✅ Meditação atualizada com sucesso. ID=${savedMeditation.id}`);

      if (dto.days) {
        const dayRepo = this.dataSource.getRepository(DayEntity);
        await dayRepo.delete({ meditation: { id: savedMeditation.id } });
        const newDays = dto.days.map((day) => dayRepo.create({ ...day, meditation: savedMeditation }));
        await dayRepo.save(newDays);
      }

      const mediaData = {
        title: savedMeditation.topic,
        description: `Material da meditação: ${savedMeditation.topic}`,
        mediaType: MediaType.DOCUMENT,
        type: dto.isLocalFile ? MediaUploadType.UPLOAD : MediaUploadType.LINK,
        platform: dto.isLocalFile ? null : MediaPlatform.GOOGLE_DRIVE,
        fileField: 'file',
        isLocalFile: dto.isLocalFile,
        url: dto.url,
      };

      const existingMedia = await this.mediaItemProcessor.findMediaItemsByTarget(
        savedMeditation.id,
        'meditation',
      );

      const mediaEntity = this.mediaItemProcessor.buildBaseMediaItem(
        mediaData,
        savedMeditation.id,
        'meditation',
      );

      await this.mediaItemProcessor.upsertMediaItem(existingMedia[0]?.id, mediaEntity);

      return savedMeditation;
    });
  }



  async findAll(): Promise<WeekMeditationResponseDto[]> {
    this.logger.debug('📦 Buscando todas as meditações com mídias...');
  
    const meditations = await this.meditationRepo.findAllWithRelations();
    const meditationIds = meditations.map((m) => m.id);
  
    if (!meditationIds.length) {
      this.logger.debug('⚠️ Nenhuma meditação encontrada.');
      return [];
    }
  
    const mediaItems = await this.mediaItemProcessor.findManyMediaItemsByTargets(
      meditationIds,
      'meditation',
    );
  
    const mediaMap = new Map<string, typeof mediaItems[number][]>();
    mediaItems.forEach((item) => {
      const list = mediaMap.get(item.targetId) || [];
      list.push(item);
      mediaMap.set(item.targetId, list);
    });
  
    return meditations.map((meditation) => {
      const media = mediaMap.get(meditation.id)?.[0]; // pega a primeira mídia associada
      if (!media) {
        this.logger.warn(`⚠️ Meditação "${meditation.topic}" sem mídia associada.`);
        return WeekMeditationResponseDto.success(meditation, null); // ou WeekMeditationResponseDto.notFound()?
      }
      return WeekMeditationResponseDto.success(meditation, media);
    });
  }
  

  async findOne(id: string): Promise<MeditationEntity> {
    this.logger.debug(`🔍 Buscando meditação com ID=${id}`);
    if (!id || typeof id !== 'string') {
      throw new BadRequestException('ID inválido fornecido para busca');
    }

    const meditation = await this.meditationRepo.findOneWithRelations(id);

    if (!meditation) {
      this.logger.warn(`⚠️ Nenhuma meditação encontrada com ID=${id}`);
      throw new NotFoundException('Meditação não encontrada');
    }

    return meditation;
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`🗑️ Iniciando remoção da meditação ID=${id}`);
    const meditation = await this.findOne(id);

    const media = await this.mediaItemProcessor.findMediaItemsByTarget(id, 'meditation');
    if (media.length > 0) {
      await this.mediaItemProcessor.deleteMediaItems(media, this.s3Service.delete.bind(this.s3Service));
    }

    await this.routeService.removeRouteByEntity('meditation', id);
    this.logger.log(`✅ Rota da meditação removida.`);

    await this.meditationRepo.delete(id);
    this.logger.log(`✅ Meditação removida com sucesso.`);
  }

  async getThisWeekMeditation(): Promise<WeekMeditationResponseDto> {
    const today = new Date();
    const todayLocal = parseDateAsLocal(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    );
  
    this.logger.debug(`📅 Data local de hoje: ${todayLocal.toISOString()}`);
  
    const all = await this.meditationRepo.findAllWithRelations();
    this.logger.debug(`🔍 Total de meditações encontradas: ${all.length}`);
  
    for (const m of all) {
      const start = parseDateAsLocal(m.startDate.toString());
      const end = parseDateAsLocal(m.endDate.toString());
  
      this.logger.debug(`📘 Verificando meditação: ${m.topic}`);
      this.logger.debug(`   ⏳ Início: ${start.toDateString()} | Fim: ${end.toDateString()}`);
  
      if (todayLocal >= start && todayLocal <= end) {
        this.logger.log(`✅ Meditação da semana encontrada: ID=${m.id}, Tópico=${m.topic}`);
  
        const mediaList = await this.mediaItemProcessor.findMediaItemsByTarget(m.id, 'meditation');
        const media = mediaList?.[0];
  
        if (!media) {
          this.logger.warn(`⚠️ Nenhuma mídia encontrada para a meditação ID=${m.id}`);
          return WeekMeditationResponseDto.notFound();
        }
  
        this.logger.debug(`🎞️ Mídia vinculada: ${media.title}`);
        return WeekMeditationResponseDto.success(m, media);
      }
    }
  
    this.logger.log('📭 Nenhuma meditação encontrada para esta semana.');
    return WeekMeditationResponseDto.notFound();
  }
  
  

}

function parseDateAsLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

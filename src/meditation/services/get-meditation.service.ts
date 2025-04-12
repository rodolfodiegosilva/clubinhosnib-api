import {
    Injectable,
    Logger,
    BadRequestException,
    NotFoundException,
  } from '@nestjs/common';
  import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
  import { MediaItemProcessor } from 'src/share/media/media-item-processor';
  import { MeditationRepository } from '../meditation.repository';
  import { WeekMeditationResponseDto } from '../dto/week-meditation-response-dto';
  import { MeditationEntity } from '../entities/meditation.entity';
  
  @Injectable()
  export class GetMeditationService {
    private readonly logger = new Logger(GetMeditationService.name);
  
    constructor(
      private readonly meditationRepo: MeditationRepository,
      private readonly mediaItemProcessor: MediaItemProcessor,
    ) {}
  
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
  
      const mediaMap = new Map<string, MediaItemEntity[]>();
      mediaItems.forEach((item) => {
        const list = mediaMap.get(item.targetId) || [];
        list.push(item);
        mediaMap.set(item.targetId, list);
      });
  
      return meditations.map((meditation) => {
        const media = mediaMap.get(meditation.id)?.[0]; // pega a primeira mídia associada
        if (!media) {
          this.logger.warn(`⚠️ Meditação "${meditation.topic}" sem mídia associada.`);
        }
        return WeekMeditationResponseDto.success(meditation, media ?? null);
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
  
    async getThisWeek(): Promise<WeekMeditationResponseDto> {
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
  
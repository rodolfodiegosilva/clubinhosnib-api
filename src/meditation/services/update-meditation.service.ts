import {
    Injectable,
    Logger,
    BadRequestException,
    NotFoundException,
  } from '@nestjs/common';
  import { DataSource } from 'typeorm';
  import { MeditationRepository } from '../meditation.repository';
  import { UpdateMeditationDto } from '../dto/update-meditation.dto';
  import { MeditationEntity } from '../entities/meditation.entity';
  import { MediaPlatform, MediaType, MediaUploadType } from 'src/share/media/media-item/media-item.entity';
  import { MediaItemProcessor } from 'src/share/media/media-item-processor';
  import { DayEntity } from '../entities/day.entity';
  
  @Injectable()
  export class UpdateMeditationService {
    private readonly logger = new Logger(UpdateMeditationService.name);
  
    constructor(
      private readonly dataSource: DataSource,
      private readonly meditationRepo: MeditationRepository,
      private readonly mediaItemProcessor: MediaItemProcessor,
    ) {}
  
    async execute(
      id: string,
      dto: UpdateMeditationDto & { isLocalFile?: boolean },
      file?: Express.Multer.File,
    ): Promise<MeditationEntity> {
      this.logger.log(`🛠️ Atualizando meditação ID=${id}`);
      this.logger.debug(`📦 DTO recebido:\n${JSON.stringify(dto, null, 2)}`);
  
      const existing = await this.meditationRepo.findOneWithRelations(id);
      if (!existing) {
        this.logger.warn(`❌ Meditação não encontrada: ID=${id}`);
        throw new NotFoundException('Meditação não encontrada');
      }
  
      const startDate = dto.startDate ? parseDateAsLocal(dto.startDate) : existing.startDate;
      const endDate = dto.endDate ? parseDateAsLocal(dto.endDate) : existing.endDate;
  
      this.logger.debug(`📅 startDate: ${startDate} (getDay=${startDate.getDay()})`);
      this.logger.debug(`📅 endDate: ${endDate} (getDay=${endDate.getDay()})`);
  
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
        this.logger.log('🔄 Atualizando dados da meditação...');
        const updatedMeditation = manager.merge(MeditationEntity, existing, {
          ...dto,
          startDate,
          endDate,
        });
  
        const savedMeditation = await manager.save(MeditationEntity, updatedMeditation);
        this.logger.log(`✅ Meditação atualizada com sucesso. ID=${savedMeditation.id}`);
  
        if (dto.days) {
          this.logger.log('📆 Atualizando dias da meditação...');
          const dayRepo = this.dataSource.getRepository(DayEntity);
          await dayRepo.delete({ meditation: { id: savedMeditation.id } });
          const newDays = dto.days.map((day) => dayRepo.create({ ...day, meditation: savedMeditation }));
          await dayRepo.save(newDays);
          this.logger.log(`📅 ${newDays.length} dias atualizados.`);
        }
  
        this.logger.log('🎞️ Processando mídia...');
        let mediaUrl = dto.url?.trim() || '';
        let originalName = "dto.originalName";
        let size = 12345;
  
        if (dto.isLocalFile && file) {
          this.logger.log(`⬆️ Enviando novo arquivo para o S3: ${file.originalname}`);
         // mediaUrl = await this.mediaItemProcessor.uploadToS3(file);
          originalName = file.originalname;
          size = file.size;
          this.logger.debug(`✅ Upload concluído. URL do S3: ${mediaUrl}`);
        }
  
        const mediaData = {
          title: savedMeditation.topic,
          description: `Material da meditação: ${savedMeditation.topic}`,
          mediaType: MediaType.DOCUMENT,
          type: dto.isLocalFile ? MediaUploadType.UPLOAD : MediaUploadType.LINK,
          platform: dto.isLocalFile ? null : MediaPlatform.GOOGLE_DRIVE,
          fileField: 'file',
          isLocalFile: dto.isLocalFile,
          url: mediaUrl,
          originalName,
          size,
        };
  
        this.logger.debug('📦 Dados finais da mídia a serem salvos:\n' + JSON.stringify(mediaData, null, 2));
  
        const existingMedia = await this.mediaItemProcessor.findMediaItemsByTarget(savedMeditation.id, 'meditation');
        const mediaEntity = this.mediaItemProcessor.buildBaseMediaItem(mediaData, savedMeditation.id, 'meditation');
  
        await this.mediaItemProcessor.upsertMediaItem(existingMedia[0]?.id, mediaEntity);
        this.logger.log(`🎉 Mídia atualizada com sucesso.`);
  
        return savedMeditation;
      });
    }
  }
  
  function parseDateAsLocal(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
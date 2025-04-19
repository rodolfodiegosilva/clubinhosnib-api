import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MediaType, UploadType, PlatformType } from 'src/share/media/media-item/media-item.entity';
import { MeditationRepository } from '../meditation.repository';
import { UpdateMeditationDto } from '../dto/update-meditation.dto';
import { MeditationEntity } from '../entities/meditation.entity';
import { DayEntity } from '../entities/day.entity';

@Injectable()
export class UpdateMeditationService {
  private readonly logger = new Logger(UpdateMeditationService.name);

  constructor(
    private readonly meditationRepo: MeditationRepository,
    private readonly dataSource: DataSource,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async update(
    id: string,
    dto: UpdateMeditationDto & { isLocalFile?: boolean },
    file?: Express.Multer.File,
  ): Promise<MeditationEntity> {
    this.logger.log(`🛠️ Atualizando meditação ID=${id}`);
    this.logger.debug(`🔍 Buscando meditação com ID=${id}`);

    const existing = await this.meditationRepo.findOneWithRelations(id);
    if (!existing) {
      throw new NotFoundException('Meditação não encontrada');
    }

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

      if (dto.url || dto.isLocalFile) {
        const mediaData = {
          title: savedMeditation.topic,
          description: `Material da meditação: ${savedMeditation.topic}`,
          mediaType: MediaType.DOCUMENT,
          type: dto.isLocalFile ? UploadType.UPLOAD : UploadType.LINK,
          platformType: dto.isLocalFile ? null : PlatformType.GOOGLE_DRIVE,
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
      }

      return savedMeditation;
    });
  }
}

function parseDateAsLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
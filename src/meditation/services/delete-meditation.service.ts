import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RouteService } from 'src/route/route.service';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MeditationRepository } from '../meditation.repository';
import { AwsS3Service } from 'src/aws/aws-s3.service';

@Injectable()
export class DeleteMeditationService {
  private readonly logger = new Logger(DeleteMeditationService.name);

  constructor(
    private readonly meditationRepo: MeditationRepository,
    private readonly s3Service: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async remove(id: string): Promise<void> {
    this.logger.log(`🗑️ Iniciando remoção da meditação ID=${id}`);
    const meditation = await this.meditationRepo.findOneWithRelations(id);
    if (!meditation) {
      throw new NotFoundException('Meditação não encontrada');
    }

    const media = await this.mediaItemProcessor.findMediaItemsByTarget(id, 'meditation');
    if (media.length > 0) {
      await this.mediaItemProcessor.deleteMediaItems(media, this.s3Service.delete.bind(this.s3Service));
    }

    await this.routeService.removeRouteByEntity('meditation', id);
    this.logger.log(`✅ Rota da meditação removida.`);

    await this.meditationRepo.delete(id);
    this.logger.log(`✅ Meditação removida com sucesso.`);
  }
}
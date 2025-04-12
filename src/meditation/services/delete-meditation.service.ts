import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
  } from '@nestjs/common';
  import { MeditationRepository } from '../meditation.repository';
  import { MediaItemProcessor } from 'src/share/media/media-item-processor';
  import { AwsS3Service } from 'src/aws/aws-s3.service';
  import { RouteService } from 'src/route/route.service';
  
  @Injectable()
  export class DeleteMeditationService {
    private readonly logger = new Logger(DeleteMeditationService.name);
  
    constructor(
      private readonly meditationRepo: MeditationRepository,
      private readonly mediaItemProcessor: MediaItemProcessor,
      private readonly s3Service: AwsS3Service,
      private readonly routeService: RouteService,
    ) {}
  
    async execute(id: string): Promise<void> {
      this.logger.log(`🗑️ Iniciando remoção da meditação ID=${id}`);
  
      if (!id || typeof id !== 'string') {
        throw new BadRequestException('ID inválido fornecido para remoção');
      }
  
      const meditation = await this.meditationRepo.findOneWithRelations(id);
  
      if (!meditation) {
        this.logger.warn(`⚠️ Nenhuma meditação encontrada com ID=${id}`);
        throw new NotFoundException('Meditação não encontrada');
      }
  
      this.logger.log('🎞️ Buscando mídias associadas à meditação...');
      const media = await this.mediaItemProcessor.findMediaItemsByTarget(id, 'meditation');
  
      if (media.length > 0) {
        this.logger.log(`🧹 Removendo ${media.length} mídia(s)...`);
        await this.mediaItemProcessor.deleteMediaItems(
          media,
          this.s3Service.delete.bind(this.s3Service),
        );
        this.logger.log('✅ Mídias removidas com sucesso.');
      } else {
        this.logger.warn('⚠️ Nenhuma mídia encontrada para remover.');
      }
  
      this.logger.log('🛤️ Removendo rota associada à meditação...');
      await this.routeService.removeRouteByEntity('meditation', id);
      this.logger.log('✅ Rota removida com sucesso.');
  
      this.logger.log('🗃️ Excluindo entidade da meditação do banco de dados...');
      await this.meditationRepo.delete(id);
      this.logger.log('✅ Meditação removida com sucesso.');
    }
  }
  
import {
    Inject,
    Injectable,
    Logger,
    BadRequestException,
  } from '@nestjs/common';
  import { RouteService } from 'src/route/route.service';
  import { RouteType } from 'src/route/route-page.entity';
  import { MediaType } from 'src/share/media/media-item/media-item.entity';
  import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MeditationRepository } from '../meditation.repository';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { CreateMeditationDto } from '../dto/create-meditation.dto';
import { MeditationEntity } from '../entities/meditation.entity';
  
  @Injectable()
  export class CreateMeditationService {
    private readonly logger = new Logger(CreateMeditationService.name);
  
    constructor(
      @Inject(MeditationRepository)
      private readonly meditationRepo: MeditationRepository,
      private readonly s3Service: AwsS3Service,
      private readonly routeService: RouteService,
      private readonly mediaItemProcessor: MediaItemProcessor,
    ) {}
  
    async create(
      dto: CreateMeditationDto,
      file?: Express.Multer.File,
    ): Promise<MeditationEntity> {
      try {
        this.logger.log('🟡 Iniciando criação da meditação...');
    
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
          platformType: dto.media.platformType ?? null,
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
          image: 'https://bucket-clubinho-galeria.s3.us-east-2.amazonaws.com/uploads/img_card.jpg',
          public: true,
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
  }
  
  function parseDateAsLocal(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
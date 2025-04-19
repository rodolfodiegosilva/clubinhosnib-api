import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MediaType } from 'src/share/media/media-item/media-item.entity';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { DocumentDto } from '../dto/document-response.dto'; // agora retornando DocumentDto diretamente
import { DocumentRepository } from '../document.repository';

@Injectable()
export class CreateDocumentService {
  private readonly logger = new Logger(CreateDocumentService.name);

  constructor(
    @Inject(DocumentRepository)
    private readonly documentRepo: DocumentRepository,
    private readonly s3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async execute(
    dto: CreateDocumentDto,
    file?: Express.Multer.File,
  ): Promise<DocumentDto> {
    this.logger.log('=== [CreateDocumentService] Iniciando criação do documento ===');

    this.logger.debug('📦 DTO recebido:\n' + JSON.stringify(dto, null, 2));

    if (file) {
      this.logger.debug('📎 Arquivo recebido: ' + file.originalname);
      this.logger.debug(`📎 Tamanho do arquivo: ${file.size} bytes`);
    } else {
      this.logger.debug('Nenhum arquivo foi recebido na requisição.');
    }

    let mediaUrl = dto.media.url?.trim() || '';
    let originalName = dto.media.originalName;
    let size = dto.media.size;

    if (dto.media.isLocalFile) {
      if (!file) {
        this.logger.error('🚫 Erro: arquivo não foi enviado, mas isLocalFile = true.');
        throw new BadRequestException('Arquivo não enviado.');
      }

      this.logger.log(`⬆️ Fazendo upload do arquivo para o S3: ${file.originalname}`);
      try {
        mediaUrl = await this.s3Service.upload(file);
      } catch (error) {
        this.logger.error(
          `Erro ao fazer upload para o S3 do arquivo ${file.originalname}`,
          error.stack,
        );
        throw error;
      }

      this.logger.log(`✅ Upload concluído! URL retornada pelo S3: ${mediaUrl}`);
      originalName = file.originalname;
      size = file.size;
    }

    this.logger.log('📝 Criando entidade do documento no repositório...');
    const document = this.documentRepo.create({
      name: dto.name,
      description: dto.description,
    });

    this.logger.log('💾 Salvando documento no banco...');
    const savedDocument = await this.documentRepo.save(document);
    this.logger.log(`✅ Documento salvo com ID: ${savedDocument.id}`);

    this.logger.log('🧩 Construindo MediaItem a partir do DTO...');
    const mediaEntity = this.mediaItemProcessor.buildBaseMediaItem(
      {
        title: dto.media.title,
        description: dto.media.description,
        mediaType: MediaType.DOCUMENT,
        uploadType: dto.media.type,
        platformType: dto.media.platformType,
        fileField: dto.media.fileField ?? 'file',
        isLocalFile: dto.media.isLocalFile,
        url: mediaUrl,
        originalName,
        size,
      },
      savedDocument.id,
      'document',
    );

    this.logger.log('💾 Salvando a entidade de mídia no banco...');
    const savedMedia = await this.mediaItemProcessor.saveMediaItem(mediaEntity);
    this.logger.log(`✅ Mídia salva com ID: ${savedMedia.id}`);

    this.logger.log('=== [CreateDocumentService] Documento criado com sucesso! ===\n');

    // 🔄 Novo retorno direto do DocumentDto
    return DocumentDto.fromEntity(savedDocument, savedMedia);
  }
}

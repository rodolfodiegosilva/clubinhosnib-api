import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import {
  MediaType,
  UploadType,
} from 'src/share/media/media-item/media-item.entity';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { DocumentDto } from '../dto/document-response.dto';
import { DocumentRepository } from '../document.repository';

@Injectable()
export class UpdateDocumentService {
  private readonly logger = new Logger(UpdateDocumentService.name);

  constructor(
    @Inject(DocumentRepository)
    private readonly documentRepo: DocumentRepository,
    private readonly s3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async execute(
    id: string,
    dto: UpdateDocumentDto & { isLocalFile?: boolean },
    file?: Express.Multer.File,
  ): Promise<DocumentDto> {
    this.logger.log(`🛠️ Atualizando documento ID=${id}`);

    const existingDocument = await this.documentRepo.findOneById(id);
    if (!existingDocument) throw new NotFoundException('Documento não encontrado');

    const existingMedia = await this.mediaItemProcessor.findMediaItemByTarget(id, 'document');
    if (!existingMedia) throw new NotFoundException('Mídia não encontrada');

    // 🔁 Upsert no documento
    const savedDocument = await this.documentRepo.upsertOne({
      id,
      name: dto.name,
      description: dto.description,
    });
    this.logger.log('✅ Documento atualizado com sucesso');

    // 🔄 Processamento de mídia
    let mediaUrl = dto.media.url?.trim() || '';
    let originalName = dto.media.originalName;
    let size = dto.media.size;

    if (dto.isLocalFile && file) {
      this.logger.log(`⬆️ Enviando novo arquivo para o S3: ${file.originalname}`);
      mediaUrl = await this.s3Service.upload(file);
      originalName = file.originalname;
      size = file.size;
    }

    const mediaData = {
      title: dto.media.title,
      description: dto.media.description,
      mediaType: MediaType.DOCUMENT,
      type: dto.isLocalFile ? UploadType.UPLOAD : UploadType.LINK,
      platformType: dto.isLocalFile ? null : dto.media.platformType,
      fileField: 'file',
      isLocalFile: dto.isLocalFile,
      url: mediaUrl,
      originalName,
      size,
    };

    const mediaEntity = this.mediaItemProcessor.buildBaseMediaItem(
      mediaData,
      id,
      'document',
    );

    const updatedMedia = await this.mediaItemProcessor.upsertMediaItem(
      existingMedia.id,
      mediaEntity,
    );

    this.logger.log(`🎞️ Mídia atualizada com sucesso: ${existingMedia.id}`);
    return DocumentDto.fromEntity(savedDocument, updatedMedia);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { CreateGalleryPageDTO } from './dto/create-gallery.dto';
import { GalleryPage } from './gallery-page.entity';
import { GallerySection } from './gallery-section.entity';
import { GalleryImage } from './gallery-image.entity';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { GalleryPageRepository } from './gallery-page.repository';
import { GallerySectionRepository } from './gallery-section.repository';
import { GalleryImageRepository } from './gallery-image.repository';
import { RouteRepository } from './route-page.repository';
import { Route } from './route-page.entity';

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);
  private readonly s3Client: S3Client;

  constructor(
    private readonly galleryPageRepo: GalleryPageRepository,
    private readonly sectionRepo: GallerySectionRepository,
    private readonly imageRepo: GalleryImageRepository,
    private readonly routeRepo: RouteRepository,
  ) {
    this.logger.debug('Inicializando S3Client...');

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  async createGalleryPage(
    pageData: CreateGalleryPageDTO,
    filesDict: { [fileField: string]: Express.Multer.File },
  ): Promise<GalleryPage> {
    const { name, description, sections } = pageData;
    this.logger.debug(`🔍 Criando página de galeria - Nome: ${name}`);

    const newPage = new GalleryPage();
    newPage.name = name;
    newPage.description = description;
    newPage.sections = [];

    const routePath = this.generateRoute(name);

    const existingRoute = await this.routeRepo.findByPath(routePath);
    if (existingRoute) {
      throw new Error(`⚠️ A rota "${routePath}" já está em uso!`);
    }

    const newRoute = new Route();
    newRoute.path = routePath;
    newRoute.entityType = 'GalleryPage';
    newRoute.entityId = newPage.id;
    newPage.route = await this.routeRepo.save(newRoute);

    for (let sectionItem of sections) {
      const newSection = new GallerySection();
      newSection.caption = sectionItem.caption;
      newSection.description = sectionItem.description;
      newSection.images = [];
      newSection.page = newPage;

      for (let img of sectionItem.images || []) {
        const newImage = new GalleryImage();
        if (img.isLocalFile) {
          const file = filesDict[img.fileFieldName as string];
          if (!file) continue;

          newImage.url = await this.uploadToS3(file);
          newImage.isLocalFile = true;
          newImage.originalName = file.originalname;
          newImage.size = file.size;
        } else {
          newImage.url = img.url || '';
          newImage.isLocalFile = false;
        }
        newImage.section = newSection;
        newSection.images.push(newImage);
      }
      newPage.sections.push(newSection);
    }

    const savedPage = await this.galleryPageRepo.save(newPage);
    this.logger.debug(`✅ Página ID=${savedPage.id} criada com rota ${savedPage.route.path}.`);
    return savedPage;
  }

  private generateRoute(name: string): string {
    return 'galeria_' + name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .trim();
  }

  private async uploadToS3(file: Express.Multer.File): Promise<string> {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) throw new Error('❌ AWS_S3_BUCKET_NAME não foi definido!');

    const s3Key = `uploads/${Date.now()}_${file.originalname}`;
    this.logger.debug(`📂 Enviando para S3: ${s3Key}`);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);
      return `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
    } catch (error) {
      this.logger.error(`❌ Erro no upload: ${error.message}`);
      throw new Error('Falha no upload para S3');
    }
  }

  async findAllPages(): Promise<GalleryPage[]> {
    this.logger.debug('📡 Buscando todas as páginas de galeria...');
    return this.galleryPageRepo.findAllWithRelations();
  }

  async findOnePage(id: string): Promise<GalleryPage> {
    this.logger.debug(`📡 Buscando página ID=${id}...`);
    const page = await this.galleryPageRepo.findOneWithRelations(id);
    if (!page) {
      this.logger.warn(`⚠️ Página ID=${id} não encontrada.`);
      throw new Error('Página não encontrada');
    }
    return page;
  }

  async removePage(id: string): Promise<void> {
    this.logger.debug(`🗑️ Removendo página ID=${id}...`);
    const page = await this.galleryPageRepo.findOneWithRelations(id);
    if (!page) throw new Error('Página não encontrada');
    await this.galleryPageRepo.remove(page);
    this.logger.debug(`✅ Página ID=${id} removida.`);
  }
}

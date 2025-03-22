import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { CreateGalleryPageDTO } from './dto/create-gallery.dto';
import { GalleryPage } from './gallery-page.entity';
import { GallerySection } from './gallery-section.entity';
import { GalleryImage } from './gallery-image.entity';
import { GalleryPageRepository } from './gallery-page.repository';
import { RouteService } from 'src/route/route.service';
import { Route } from 'src/route/route-page.entity';

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);
  private readonly s3Client: S3Client;

  constructor(
    private readonly galleryPageRepo: GalleryPageRepository,
    private readonly routeService: RouteService,
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
    this.logger.debug(`🔍 Criando galeria: "${name}"`);

    const newPage = new GalleryPage();
    newPage.name = name;
    newPage.description = description;

    const routePath = this.generateRoute(name);
    await this.routeService.checkPathAvailability(routePath);
    const createdRoute: Route = await this.routeService.createRouteForGallery(
      routePath,
      newPage.description,
      newPage.id,
    );
    newPage.route = createdRoute;

    newPage.sections = await Promise.all(
      sections.map(async (sectionItem) => {
        const newSection = new GallerySection();
        newSection.caption = sectionItem.caption;
        newSection.description = sectionItem.description;
        newSection.page = newPage;

        const images = await Promise.all(
          (sectionItem.images || []).map(async (img) => {
            if (img.isLocalFile) {
              const file = filesDict[img.fileFieldName as string];
              if (!file) return null;

              const newImage = new GalleryImage();
              newImage.url = await this.uploadToS3(file);
              newImage.isLocalFile = true;
              newImage.originalName = file.originalname;
              newImage.size = file.size;
              newImage.section = newSection;
              return newImage;
            } else {
              const newImage = new GalleryImage();
              newImage.url = img.url || '';
              newImage.isLocalFile = false;
              newImage.section = newSection;
              return newImage;
            }
          }),
        );

        newSection.images = images.filter((img): img is GalleryImage => img !== null);
        return newSection;
      }),
    );

    const savedPage = await this.galleryPageRepo.save(newPage);
    this.logger.debug(`✅ Página criada: ID=${savedPage.id}, rota=${savedPage.route.path}`);
    return savedPage;
  }

  async updateGalleryPage(
    id: string,
    pageData: CreateGalleryPageDTO,
    filesDict: { [fileField: string]: Express.Multer.File },
  ): Promise<GalleryPage> {
    this.logger.debug(`🔧 Atualizando galeria ID=${id}...`);

    const existingPage = await this.galleryPageRepo.findOneWithRelations(id);
    if (!existingPage) throw new Error('Página não encontrada para atualização');

    const existingImages = existingPage.sections.flatMap((s) => s.images);

    const newImageUrls = pageData.sections
      .flatMap((section) => section.images || [])
      .map((img) => img.url || '');
    const newUrlSet = new Set(newImageUrls);

    this.logger.debug(`📸 Existentes: ${existingImages.length}, Novas: ${newUrlSet.size}`);

    const removedImages = existingImages.filter((img) => {
      return img.isLocalFile && img.url && !newUrlSet.has(img.url);
    });
    this.logger.debug(`🗑️ Removendo do S3: ${removedImages.length} imagens`);

    for (const image of removedImages) {
      this.logger.debug(`🗑️ Excluindo: ${image.url}`);
      await this.deleteFromS3(image.url);
    }

    existingPage.name = pageData.name;
    existingPage.description = pageData.description;

    existingPage.sections = await Promise.all(
      pageData.sections.map(async (sectionItem) => {
        const section = new GallerySection();
        section.caption = sectionItem.caption;
        section.description = sectionItem.description;
        section.page = existingPage;

        const images = await Promise.all(
          (sectionItem.images || []).map(async (img) => {
            if (img.isLocalFile) {
              const file = filesDict[img.fileFieldName as string];
              if (!file) return null;

              const image = new GalleryImage();
              image.url = await this.uploadToS3(file);
              image.isLocalFile = true;
              image.originalName = file.originalname;
              image.size = file.size;
              image.section = section;
              return image;
            } else {
              const image = new GalleryImage();
              image.url = img.url || '';
              image.isLocalFile = false;
              image.section = section;
              return image;
            }
          }),
        );
        section.images = images.filter((img): img is GalleryImage => img !== null);
        return section;
      }),
    );

    const updatedPage = await this.galleryPageRepo.save(existingPage);
    this.logger.debug(`✅ Página atualizada: ID=${updatedPage.id}`);
    return updatedPage;
  }

  private generateRoute(name: string): string {
    return (
      'galeria_' +
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .trim()
    );
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

  private async deleteFromS3(url: string): Promise<void> {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) throw new Error('❌ AWS_S3_BUCKET_NAME não foi definido!');

    const key = url.split(`${bucketName}.s3.amazonaws.com/`)[1];
    if (!key) {
      this.logger.warn(`❗ Falha ao extrair chave do S3 a partir de: ${url}`);
      return;
    }

    this.logger.debug(`🔑 Chave do S3: ${key}`);

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
      this.logger.debug(`🗑️ Removido do S3: ${key}`);
    } catch (error) {
      this.logger.error(`❌ Erro ao excluir do S3: ${error.message}`);
    }
  }

  async findAllPages(): Promise<GalleryPage[]> {
    this.logger.debug('📡 Listando todas as galerias...');
    return this.galleryPageRepo.findAllWithRelations();
  }

  async findOnePage(id: string): Promise<GalleryPage> {
    this.logger.debug(`📡 Buscando galeria ID=${id}...`);
    const page = await this.galleryPageRepo.findOneWithRelations(id);
    if (!page) {
      this.logger.warn(`⚠️ Galeria não encontrada ID=${id}`);
      throw new Error('Página não encontrada');
    }
    return page;
  }

  async removePage(id: string): Promise<void> {
    this.logger.debug(`🗑️ Removendo galeria ID=${id}...`);
    const page = await this.galleryPageRepo.findOneWithRelations(id);
    if (!page) throw new Error('Página não encontrada');
    await this.galleryPageRepo.remove(page);
    this.logger.debug(`✅ Galeria removida ID=${id}`);
  }
}

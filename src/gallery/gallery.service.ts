import { Injectable, Logger } from '@nestjs/common';
import { CreateGalleryPageDTO } from './dto/create-gallery.dto';
import { GalleryPage } from './gallery-page.entity';
import { GallerySection } from './gallery-section.entity';
import { GalleryImage } from './gallery-image.entity';
import { GalleryPageRepository } from './gallery-page.repository';
import { RouteService } from 'src/route/route.service';
import { Route, RouteType } from 'src/route/route-page.entity';
import { AwsS3Service } from 'src/aws/aws-s3.service';

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);

  constructor(
    private readonly galleryPageRepo: GalleryPageRepository,
    private readonly routeService: RouteService,
    private readonly awsS3Service: AwsS3Service,
  ) {}

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
      RouteType.PAGE,
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
              newImage.url = await this.awsS3Service.upload(file);
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

    const newImageMap = new Map<string, { url: string; isLocalFile: boolean }>();
    pageData.sections.forEach(section => {
      (section.images || []).forEach(img => {
        if (img.url) {
          newImageMap.set(img.url, { url: img.url, isLocalFile: img.isLocalFile });
        }
      });
    });

    const removedImages = existingImages.filter((img) => {
      return img.url && !newImageMap.has(img.url);
    });

    for (const image of removedImages) {
      if (image.isLocalFile) {
        this.logger.debug(`🗑️ Excluindo imagem local: ${image.url}`);
        await this.awsS3Service.delete(image.url);
      } else {
        this.logger.debug(`🗑️ Removendo referência de imagem externa: ${image.url}`);
      }
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
            if (img.isLocalFile && filesDict[img.fileFieldName as string]) {
              const file = filesDict[img.fileFieldName as string];
              const image = new GalleryImage();
              image.url = await this.awsS3Service.upload(file);
              image.isLocalFile = true;
              image.originalName = file.originalname;
              image.size = file.size;
              image.section = section;
              return image;
            } else {
              const image = new GalleryImage();
              image.url = img.url || '';

              const previousImage = existingImages.find(e => e.url === img.url);
              image.isLocalFile = previousImage?.isLocalFile ?? false;

              image.originalName = previousImage?.originalName || '';
              image.size = previousImage?.size || 0;
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
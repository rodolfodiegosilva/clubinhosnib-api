import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GalleryPage } from './gallery-page.entity';
import { GallerySection } from './gallery-section.entity';
import { GalleryImage } from './gallery-image.entity';
import { CreateGalleryPageDTO } from './dto/create-gallery.dto';

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);
  private readonly s3Client: S3Client;

  constructor(
    @InjectRepository(GalleryPage)
    private readonly galleryPageRepo: Repository<GalleryPage>,
    @InjectRepository(GallerySection)
    private readonly sectionRepo: Repository<GallerySection>,
    @InjectRepository(GalleryImage)
    private readonly imageRepo: Repository<GalleryImage>,
  ) {
    this.logger.debug('Inicializando S3Client com as seguintes credenciais:');
    this.logger.debug(`AWS_REGION: ${process.env.AWS_REGION}`);
    this.logger.debug(`AWS_S3_BUCKET_NAME: ${process.env.AWS_S3_BUCKET_NAME}`);

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  /**
   * Cria uma nova página de galeria com seções e imagens.
   */
  async createGalleryPage(
    pageData: CreateGalleryPageDTO,
    filesDict: { [fileField: string]: Express.Multer.File },
  ): Promise<GalleryPage> {
    const { name, description, sections } = pageData;
    this.logger.debug(`🔍 Iniciando createGalleryPage - Nome: ${name}, Descrição: ${description}, Total de seções: ${sections.length}`);

    // Cria a nova página
    const newPage = new GalleryPage();
    newPage.name = name;
    newPage.description = description;
    newPage.sections = [];

    // Processa cada seção
    for (let i = 0; i < sections.length; i++) {
      const sectionItem = sections[i];
      this.logger.debug(`📌 Processando seção [${i}] - Caption: ${sectionItem.caption}`);

      const newSection = new GallerySection();
      newSection.caption = sectionItem.caption;
      newSection.description = sectionItem.description;
      newSection.images = [];
      newSection.page = newPage;

      const imagesArray = sectionItem.images || [];
      this.logger.debug(`🖼️ Seção [${i}] - Total de imagens: ${imagesArray.length}`);

      // Processa cada imagem da seção
      for (let j = 0; j < imagesArray.length; j++) {
        const img = imagesArray[j];
        const newImage = new GalleryImage();
        this.logger.debug(`🔄 Processando imagem [${j}] da seção [${i}]`);

        if (img.isLocalFile) {
          const fileFieldName = img.fileFieldName as string;
          const file = filesDict[fileFieldName];
          if (!file) {
            this.logger.warn(`⚠️ Arquivo local não encontrado em filesDict[${fileFieldName}]`);
            continue;
          }

          this.logger.debug(`📤 Fazendo upload do arquivo "${file.originalname}" (${file.size} bytes)...`);
          const url = await this.uploadToS3(file);
          this.logger.debug(`✅ Upload concluído! URL gerada: ${url}`);

          newImage.url = url;
          newImage.isLocalFile = true;
          newImage.originalName = file.originalname;
          newImage.size = file.size;
        } else {
          this.logger.debug(`🌐 Imagem remota detectada: ${img.url}`);
          newImage.url = img.url || '';
          newImage.isLocalFile = false;
        }

        newImage.section = newSection;
        newSection.images.push(newImage);
      }

      newPage.sections.push(newSection);
    }

    // Salva a página com cascade
    this.logger.debug(`🛠️ Salvando página de galeria com ${newPage.sections.length} seções...`);
    const savedPage = await this.galleryPageRepo.save(newPage);
    this.logger.debug(`✅ createGalleryPage concluído! Página ID=${savedPage.id} criada.`);

    return savedPage;
  }

  /**
   * Faz upload do arquivo para o Amazon S3 e retorna a URL pública.
   */
  private async uploadToS3(file: Express.Multer.File): Promise<string> {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;

    this.logger.debug(`🔍 Verificando bucket: ${bucketName}`);
    if (!bucketName) {
      throw new Error('❌ AWS_S3_BUCKET_NAME não foi definido!');
    }

    const s3Key = `uploads/${Date.now()}_${file.originalname}`;
    this.logger.debug(`📂 Enviando arquivo para S3: ${s3Key}`);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);
      this.logger.debug(`✅ Upload para S3 concluído com sucesso!`);
      return `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
    } catch (error) {
      this.logger.error(`❌ Erro ao enviar arquivo para S3: ${error.message}`);
      throw new Error('Falha no upload para S3');
    }
  }

  /**
   * Busca todas as páginas de galeria com seções e imagens.
   */
  async findAllPages(): Promise<GalleryPage[]> {
    this.logger.debug('📡 Buscando todas as páginas de galeria...');

    const pages = await this.galleryPageRepo.find({
      relations: ['sections', 'sections.images'],
      order: { id: 'ASC' },
    });

    this.logger.debug(`✅ Encontradas ${pages.length} páginas de galeria.`);
    return pages;
  }

  /**
   * Busca uma página de galeria específica pelo ID
   */
  async findOnePage(id: string): Promise<GalleryPage> {
    this.logger.debug(`📡 Buscando página de galeria com ID=${id}...`);

    const page = await this.galleryPageRepo.findOne({
      where: { id },
      relations: ['sections', 'sections.images'], // ✅ Corrigido!
    });
    

    if (!page) {
      this.logger.warn(`⚠️ Página de galeria ID=${id} não encontrada.`);
      throw new Error('Página de galeria não encontrada');
    }

    this.logger.debug(`✅ Página de galeria ID=${id} encontrada.`);
    return page;
  }

  /**
   * Remove uma página de galeria específica pelo ID
   */
  async removePage(id: string): Promise<void> {
    this.logger.debug(`🗑️ Removendo página de galeria ID: ${id}`);

    const page = await this.galleryPageRepo.findOne({
      where: { id },
      relations: ['sections', 'sections.images'],
    });

    if (!page) {
      this.logger.warn(`⚠️ Página de galeria ID: ${id} não encontrada.`);
      throw new Error('Página de galeria não encontrada');
    }

    await this.galleryPageRepo.remove(page);
    this.logger.debug(`✅ Página de galeria ID: ${id} removida com sucesso!`);
  }
}
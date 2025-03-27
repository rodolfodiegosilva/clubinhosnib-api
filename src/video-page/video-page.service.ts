import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

import { VideosPageRepository } from './video-page.repository';
import { VideosPage } from './entities/video-page.entity/video-page.entity';
import { VideoItem, VideoPlatform, VideoType } from './entities/video-item.entity/video-item.entity';
import { RouteService } from 'src/route/route.service';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteType } from 'src/route/route-page.entity';

export interface CreateVideosPageDto {
  pageTitle: string;
  pageDescription: string;
  videos: {
    title: string;
    description: string;
    type: 'link' | 'upload';
    platform?: 'youtube' | 'google-drive' | 'onedrive';
    url?: string;
    fileField?: string;
  }[];
}

@Injectable()
export class VideosPageService {
  private readonly logger = new Logger(VideosPageService.name);

  constructor(
    private readonly videosPageRepo: VideosPageRepository,
    private readonly routeService: RouteService,
    private readonly awsS3Service: AwsS3Service,
  ) { }

  async createVideosPage(
    dto: CreateVideosPageDto,
    filesDict: { [fileField: string]: Express.Multer.File },
  ): Promise<VideosPage> {
    const { pageTitle, pageDescription, videos } = dto;
    this.logger.debug(`🔍 Iniciando criação da página de vídeos: "${pageTitle}"`);

    const newPage = new VideosPage();
    newPage.name = pageTitle;
    newPage.description = pageDescription;

    const savedPage = await this.videosPageRepo.savePage(newPage);
    this.logger.debug(`📦 Página de vídeos salva inicialmente com ID=${savedPage.id}`);

    const routePath = await this.routeService.generateAvailablePath(pageTitle, 'videos_');
    this.logger.debug(`📍 Rota gerada: ${routePath}`);

    const createdRoute = await this.routeService.createRoute({
      name: pageTitle,
      idToFetch: savedPage.id,
      path: routePath,
      entityType: 'VideosPage',
      description: pageDescription,
      entityId: savedPage.id,
      type: RouteType.PAGE,
      image: 'https://bucket-clubinho-galeria.s3.amazonaws.com/uploads/1742760651080_logo192.png',
    });

    savedPage.route = createdRoute;
    this.logger.debug(`🔗 Rota associada com sucesso: ${createdRoute.path}`);

    savedPage.videos = await Promise.all(
      videos.map(async (videoItem, index) => {
        const video = new VideoItem();
        video.title = videoItem.title;
        video.description = videoItem.description;
        video.type = videoItem.type as VideoType;
        video.platform = videoItem.platform as VideoPlatform;
        video.page = savedPage;

        if (videoItem.type === 'upload') {
          const file = filesDict[videoItem.fileField as string];
          if (!file) {
            this.logger.warn(`⚠️ Arquivo não encontrado para vídeo upload "${videoItem.title}"`);
            throw new Error(`Arquivo ausente para o vídeo "${videoItem.title}"`);
          }
          this.logger.debug(`💾 Enviando vídeo ${index + 1} (${videoItem.fileField}) para o S3...`);
          video.url = await this.awsS3Service.upload(file);
          video.isLocalFile = true;
          video.originalName = file.originalname;
          video.size = file.size;
        } else {
          this.logger.debug(`🌐 Referência externa adicionada: ${videoItem.url}`);
          video.url = videoItem.url || '';
          video.isLocalFile = false;
        }

        return video;
      }),
    );

    const finalSavedPage = await this.videosPageRepo.savePage(savedPage);
    this.logger.debug(`✅ Página de vídeos criada com sucesso: ID=${finalSavedPage.id}, rota=${finalSavedPage.route.path}`);

    return finalSavedPage;
  }

  async updateVideosPage(
    id: string,
    dto: any,
    filesDict: { [fileField: string]: Express.Multer.File } = {},
  ): Promise<VideosPage> {
    this.logger.debug(`🔧 Iniciando atualização da página de vídeos ID=${id}`);

    const existingPage = await this.videosPageRepo.findOnePageById(id);
    if (!existingPage) throw new Error('Página não encontrada para atualização');

    const oldVideos = existingPage.videos || [];
    const incomingUrls = new Set(
      dto.videos.map(v => (v.type === 'upload' ? (v.url || v.fileField) : v.url))
    );

    const removedVideos = oldVideos.filter(old => !incomingUrls.has(old.url));

    for (const removed of removedVideos) {
      if (removed.isLocalFile) {
        this.logger.debug(`🗑️ Excluindo vídeo local: "${removed.title}" (${removed.url})`);
        await this.awsS3Service.delete(removed.url);
      } else {
        this.logger.debug(`🗑️ Removendo referência externa: "${removed.title}" (${removed.url})`);
      }
    }

    const oldName = existingPage.name;
    const oldDescription = existingPage.description;
    existingPage.name = dto.pageTitle;
    existingPage.description = dto.pageDescription;

    if (existingPage.route) {
      const hasChanged = oldName !== dto.pageTitle || oldDescription !== dto.pageDescription;
      if (hasChanged) {
        const newPath = await this.routeService.generateAvailablePath(dto.pageTitle, '_videos');
        this.logger.debug(`✏️ Atualizando rota: novo path será ${newPath}`);
        await this.routeService.updateRoute(existingPage.route.id, {
          name: dto.pageTitle,
          description: dto.pageDescription,
          path: newPath,
        });
      }
    }

    existingPage.videos = await Promise.all(
      dto.videos.map(async (v, index) => {
        this.logger.debug(`🎞️ Processando vídeo: "${v.title}"`);
        const video = new VideoItem();
        video.title = v.title;
        video.description = v.description;
        video.type = v.type as VideoType;
        video.platform = v.platform as VideoPlatform;
        video.page = existingPage;

        if (v.type === 'upload') {
          const fileRef = v.url || v.fileField;
          const previous = oldVideos.find(ov => ov.url === fileRef);

          if (fileRef && previous) {
            this.logger.debug(`🔁 Reutilizando vídeo existente: ${fileRef}`);
            video.url = previous.url;
            video.isLocalFile = previous.isLocalFile;
            video.originalName = previous.originalName;
            video.size = previous.size;
          } else if (v.fileField && filesDict[v.fileField]) {
            const file = filesDict[v.fileField];
            this.logger.debug(`💾 Fazendo upload do novo vídeo: ${v.fileField}`);
            video.url = await this.awsS3Service.upload(file);
            video.isLocalFile = true;
            video.originalName = file.originalname;
            video.size = file.size;
          } else {
            throw new Error(`Arquivo ausente para vídeo "${v.title}"`);
          }
        } else {
          video.url = v.url || '';
          video.isLocalFile = false;
        }

        return video;
      })
    );

    const updatedPage = await this.videosPageRepo.savePage(existingPage);
    this.logger.debug(`✅ Página de vídeos atualizada com sucesso: ID=${updatedPage.id}`);

    return updatedPage;
  }

  async findAllPages(): Promise<VideosPage[]> {
    this.logger.debug('📡 Listando todas as páginas de vídeos...');
    return this.videosPageRepo.findAllPages();
  }

  async findOnePage(id: string): Promise<VideosPage> {
    this.logger.debug(`📡 Buscando página de vídeos ID=${id}...`);
    const page = await this.videosPageRepo.findOnePageById(id);
    if (!page) {
      this.logger.warn(`⚠️ Página de vídeos não encontrada ID=${id}`);
      throw new Error('Página não encontrada');
    }
    return page;
  }

  async removePage(id: string): Promise<void> {
    this.logger.debug(`🗑️ Removendo página de vídeos ID=${id}...`);
    const page = await this.videosPageRepo.findOnePageById(id);
    if (!page) {
      this.logger.warn(`⚠️ Página não encontrada para exclusão ID=${id}`);
      throw new Error('Página não encontrada');
    }

    const localVideos = page.videos.filter(video => video.isLocalFile);
    await Promise.all(
      localVideos.map(async (video) => {
        this.logger.debug(`🧹 Deletando vídeo local do S3: ${video.url}`);
        await this.awsS3Service.delete(video.url);
      })
    );

    if (page.route?.id) {
      this.logger.debug(`🗑️ Removendo rota associada ID=${page.route.id}`);
      await this.routeService.removeRoute(page.route.id);
    }

    await this.videosPageRepo.removePage(page);

    this.logger.debug(`✅ Página de vídeos removida com sucesso: ID=${id}`);
  }

  private async uploadBase64Video(base64Data: string): Promise<string> {
    const [header, raw] = base64Data.split(',');
    if (!raw) throw new Error('Base64 inválido ou mal formatado para vídeo.');
    const match = header.match(/data:(.*);base64/);
    const mimeType = match?.[1] || 'video/mp4';
    const fileBuffer = Buffer.from(raw, 'base64');
    const readStream = Readable.from(fileBuffer);
    const filename = `video_${Date.now()}.${mimeType.split('/')[1] || 'mp4'}`;
    const fakeFile: Express.Multer.File = {
      fieldname: 'video',
      originalname: filename,
      encoding: '7bit',
      mimetype: mimeType,
      size: fileBuffer.length,
      buffer: fileBuffer,
      destination: '',
      filename,
      path: '',
      stream: readStream,
    };

    this.logger.debug(`🚀 Subindo vídeo para AWS S3: ${filename}`);
    return await this.awsS3Service.upload(fakeFile);
  }
}
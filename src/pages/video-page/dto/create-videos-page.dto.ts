import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    ValidateNested,
  } from 'class-validator';
  import { Type } from 'class-transformer';
  import {
    PlatformType,
    UploadType,
    MediaType,
  } from 'src/share/media/media-item/media-item.entity';
  
  class VideoItemDto {
    @IsString({ message: 'O campo "title" deve ser uma string.' })
    title: string;
  
    @IsString({ message: 'O campo "description" deve ser uma string.' })
    description: string;
  
    @IsEnum(UploadType, { message: 'O campo "type" deve ser "upload" ou "link".' })
    type: UploadType;
  
    @IsBoolean({ message: 'O campo "isLocalFile" deve ser um valor booleano.' })
    isLocalFile: boolean;
  
    @IsOptional()
    @IsString({ message: 'O campo "url" deve conter uma URL válida.' })
    url?: string;
  
    @IsOptional()
    @IsEnum(PlatformType, { message: 'O campo "platformType" deve conter uma plataforma válida.' })
    platformType?: PlatformType;
  
    @IsOptional()
    @IsString({ message: 'O campo "originalName" deve ser uma string.' })
    originalName?: string;
  
    @IsEnum(MediaType, { message: 'O campo "mediaType" deve conter um tipo de mídia válido.' })
    mediaType: MediaType;
    
    @IsOptional()
    @IsString({ message: 'O campo "fieldKey" é obrigatório e deve ser uma string.' })
    fieldKey?: string;
  }
  
  export class CreateVideosPageDto {
    @IsString({ message: 'O campo "title" da página deve ser uma string.' })
    title: string;
  
    @IsString({ message: 'O campo "description" da página deve ser uma string.' })
    description: string;
  
    @IsBoolean({ message: 'O campo "public" da página deve ser booleano.' })
    public: boolean;
  
    @IsArray({ message: 'O campo "videos" deve ser um array.' })
    @ValidateNested({ each: true })
    @Type(() => VideoItemDto)
    videos: VideoItemDto[];
  }
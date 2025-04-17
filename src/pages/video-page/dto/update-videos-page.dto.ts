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
  
  class UpdateVideoItemDto {
    @IsOptional()
    @IsString({ message: 'O campo "id" da mídia deve ser uma string.' })
    id?: string;
  
    @IsOptional()
    @IsString({ message: 'O campo "title" da mídia deve ser uma string.' })
    title?: string;
  
    @IsOptional()
    @IsString({ message: 'O campo "description" da mídia deve ser uma string.' })
    description?: string;
  
    @IsEnum(UploadType, { message: 'O campo "type" deve ser "upload" ou "link".' })
    type: UploadType;
  
    @IsBoolean({ message: 'O campo "isLocalFile" deve ser booleano.' })
    isLocalFile: boolean;
  
    @IsOptional()
    @IsString({ message: 'O campo "url" deve ser uma string.' })
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
    @IsString({ message: 'O campo "fieldKey" deve ser uma string.' })
    fieldKey?: string;
  }
  
  export class UpdateVideosPageDto {
    @IsString({ message: 'O campo "id" da página deve ser uma string.' })
    id: string;
  
    @IsString({ message: 'O campo "title" da página deve ser uma string.' })
    title: string;
  
    @IsString({ message: 'O campo "description" da página deve ser uma string.' })
    description: string;
  
    @IsBoolean({ message: 'O campo "public" da página deve ser booleano.' })
    public: boolean;
  
    @IsArray({ message: 'O campo "videos" deve ser um array.' })
    @ValidateNested({ each: true })
    @Type(() => UpdateVideoItemDto)
    videos: UpdateVideoItemDto[];
  }
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MediaPlatform,
  MediaUploadType,
  MediaType,
} from 'src/share/media/media-item/media-item.entity';

class MediaItemDto {

  @IsOptional()
  @IsString({ message: 'O campo "title" deve ser uma string.' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'O campo "description" deve ser uma string.' })
  description?: string;

  @IsEnum(MediaUploadType, { message: 'O campo "type" deve ser "upload" ou "link".' })
  type: MediaUploadType;

  @IsBoolean({ message: 'O campo "isLocalFile" deve ser um valor booleano.' })
  isLocalFile: boolean;

  @IsOptional()
  @IsString({ message: 'O campo "url" deve conter uma URL válida.' })
  url?: string;

  @IsOptional()
  @IsEnum(MediaPlatform, { message: 'O campo "platform" deve conter uma plataforma válida.' })
  platform?: MediaPlatform;

  @IsOptional()
  @IsString({ message: 'O campo "originalName" deve ser uma string.' })
  originalName?: string;

  @IsOptional()
  @IsNumber({}, { message: 'O campo "size" deve ser um número.' })
  size?: number;

  @IsEnum(MediaType, { message: 'O campo "mediaType" deve conter um tipo de mídia válido.' })
  mediaType?: MediaType;

  @IsString({ message: 'O campo "fieldKey" é obrigatório e deve ser uma string.' })
  fieldKey: string;

  @ValidateIf(() => false)
  file?: any;
}

class SectionDto {

  @IsString({ message: 'O campo "caption" da seção deve ser uma string.' })
  caption: string;

  @IsString({ message: 'O campo "description" da seção deve ser uma string.' })
  description: string;

  @IsBoolean({ message: 'O campo "public" da seção deve ser booleano.' })
  public: boolean;

  @IsArray({ message: 'O campo "mediaItems" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  mediaItems: MediaItemDto[];
}

export class CreateImagePageDto {

  @IsString({ message: 'O campo "title" da galeria deve ser uma string.' })
  title: string;

  @IsString({ message: 'O campo "description" da galeria deve ser uma string.' })
  description: string;

  @IsBoolean({ message: 'O campo "public" da galeria deve ser booleano.' })
  public: boolean;

  @IsArray({ message: 'O campo "sections" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => SectionDto)
  sections: SectionDto[];
}

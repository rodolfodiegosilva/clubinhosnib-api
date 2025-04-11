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
  MediaPlatform,
  MediaUploadType,
} from 'src/share/media/media-item/media-item.entity';

class MediaItemDto {

  @IsString({ message: 'O campo "title" deve ser uma string.' })
  title: string;

  @IsString({ message: 'O campo "description" deve ser uma string.' })
  description: string;

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
  @IsString({ message: 'O campo "fieldKey" deve ser uma string.' })
  fieldKey?: string;

  @IsOptional()
  @IsString({ message: 'O campo "size" deve ser uma string.' })
  size?: string;
}

export class CreateWeekMaterialsPageDto {

  @IsString({ message: 'O campo "pageTitle" deve ser uma string.' })
  pageTitle: string;

  @IsString({ message: 'O campo "pageSubtitle" deve ser uma string.' })
  pageSubtitle: string;

  @IsString({ message: 'O campo "pageDescription" deve ser uma string.' })
  pageDescription: string;

  @IsOptional()
  @IsArray({ message: 'O campo "videos" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  videos?: MediaItemDto[];

  @IsOptional()
  @IsArray({ message: 'O campo "documents" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  documents?: MediaItemDto[];

  @IsOptional()
  @IsArray({ message: 'O campo "images" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  images?: MediaItemDto[];

  @IsOptional()
  @IsArray({ message: 'O campo "audios" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  audios: MediaItemDto[];
}
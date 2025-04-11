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

class UpdateMediaItemDto {
  @IsOptional()
  @IsString({ message: 'O campo "id" da mídia deve ser uma string.' })
  id?: string;

  @IsOptional()
  @IsString({ message: 'O campo "title" da mídia deve ser uma string.' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'O campo "description" da mídia deve ser uma string.' })
  description?: string;

  @IsEnum(MediaUploadType, { message: 'O campo "type" deve ser "upload" ou "link".' })
  type: MediaUploadType;

  @IsBoolean({ message: 'O campo "isLocalFile" deve ser booleano.' })
  isLocalFile: boolean;

  @IsOptional()
  @IsString({ message: 'O campo "url" deve ser uma string.' })
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

export class UpdateWeekMaterialsPageDto {
  @IsString({ message: 'O campo "id" da página deve ser uma string.' })
  id: string;

  @IsString({ message: 'O campo "pageTitle" da página deve ser uma string.' })
  pageTitle: string;

  @IsString({ message: 'O campo "pageSubtitle" da página deve ser uma string.' })
  pageSubtitle: string;

  @IsString({ message: 'O campo "pageDescription" da página deve ser uma string.' })
  pageDescription: string;

  @IsOptional()
  @IsArray({ message: 'O campo "videos" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => UpdateMediaItemDto)
  videos?: UpdateMediaItemDto[];

  @IsOptional()
  @IsArray({ message: 'O campo "documents" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => UpdateMediaItemDto)
  documents?: UpdateMediaItemDto[];

  @IsOptional()
  @IsArray({ message: 'O campo "images" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => UpdateMediaItemDto)
  images?: UpdateMediaItemDto[];

  @IsOptional()
  @IsArray({ message: 'O campo "audios" deve ser um array.' })
  @ValidateNested({ each: true })
  @Type(() => UpdateMediaItemDto)
  audios?: UpdateMediaItemDto[];
}
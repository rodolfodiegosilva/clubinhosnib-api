import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    IsNumber,
    ValidateIf,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
    MediaPlatform,
    MediaUploadType,
    MediaType,
} from 'src/share/media/media-item/media-item.entity';

export class UpdateMediaItemDto {
    @IsOptional()
    @IsString({ message: 'O campo "id" da mídia deve ser uma string.' })
    id?: string;

    @IsOptional()
    @IsString({ message: 'O campo "title" da mídia deve ser uma string.' })
    title?: string;

    @IsOptional()
    @IsString({ message: 'O campo "description" da mídia deve ser uma string.' })
    description?: string;

    @IsEnum(MediaType, { message: 'O campo "mediaType" deve conter um tipo de mídia válido.' })
    mediaType: MediaType;

    @IsEnum(MediaUploadType, { message: 'O campo "type" deve ser "upload" ou "link".' })
    type: MediaUploadType;

    @IsBoolean({ message: 'O campo "isLocalFile" deve ser booleano.' })
    isLocalFile: boolean;

    @IsString({ message: 'O campo "url" deve ser uma string.' })
    url: string;

    @IsOptional()
    @IsEnum(MediaPlatform, { message: 'O campo "platform" deve conter uma plataforma válida.' })
    platform?: MediaPlatform;

    @IsOptional()
    @IsString({ message: 'O campo "fieldKey" deve ser uma string.' })
    fieldKey?: string;

    @IsOptional()
    @IsString({ message: 'O campo "originalName" deve ser uma string.' })
    originalName?: string;

    @IsOptional()
    @IsNumber({}, { message: 'O campo "size" deve ser um número.' })
    size?: number;

    @ValidateIf(() => false)
    file?: any;
}

export class UpdateSectionDto {
    @IsOptional()
    @IsString({ message: 'O campo "id" da seção deve ser uma string.' })
    id?: string;

    @IsString({ message: 'O campo "caption" da seção deve ser uma string.' })
    caption: string;

    @IsString({ message: 'O campo "description" da seção deve ser uma string.' })
    description: string;

    @IsBoolean({ message: 'O campo "public" da seção deve ser booleano.' })
    public: boolean;

    @IsArray({ message: 'O campo "mediaItems" deve ser um array.' })
    @ValidateNested({ each: true })
    @Type(() => UpdateMediaItemDto)
    mediaItems: UpdateMediaItemDto[];
}

export class UpdateImagePageDto {

    @IsString({ message: 'O campo "id" da galeria deve ser uma string.' })
    id: string; // Campo id obrigatório

    @IsString({ message: 'O campo "title" da galeria deve ser uma string.' })
    title: string;

    @IsString({ message: 'O campo "description" da galeria deve ser uma string.' })
    description: string;

    @IsBoolean({ message: 'O campo "public" da galeria deve ser booleano.' })
    public: boolean;

    @IsArray({ message: 'O campo "sections" deve ser um array.' })
    @ValidateNested({ each: true })
    @Type(() => UpdateSectionDto)
    sections: UpdateSectionDto[]; // Seções como array de UpdateSectionDto
}

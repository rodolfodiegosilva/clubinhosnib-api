import {
    IsString,
    IsOptional,
    IsEnum,
    IsBoolean,
    IsNumber,
    ValidateNested,
  } from 'class-validator';
  import { Type } from 'class-transformer';
  import { PlatformType, UploadType } from 'src/share/media/media-item/media-item.entity';
  
  class MediaDto {
    @IsOptional()
    @IsString({ message: 'id da mídia deve ser uma string' })
    id?: string;
  
    @IsString({ message: 'title deve ser uma string' })
    title: string;
  
    @IsString({ message: 'description deve ser uma string' })
    description: string;
  
    @IsEnum(UploadType, { message: 'type deve ser "link" ou "upload"' })
    type: UploadType;
  
    @IsBoolean({ message: 'isLocalFile deve ser um booleano' })
    isLocalFile: boolean;
  
    @IsString({ message: 'url deve ser uma string' })
    url: string;
  
    @IsOptional()
    @IsEnum(PlatformType, { message: 'platformType deve ser um valor válido' })
    platformType?: PlatformType;
  
    @IsOptional()
    @IsString({ message: 'originalName deve ser uma string' })
    originalName?: string;
  
    @IsOptional()
    @IsNumber({}, { message: 'size deve ser um número' })
    size?: number;

    @IsOptional()
    @IsString({ message: 'fileField deve ser uma string' })
    fileField?: string;
  
  }
  
  export class UpdateDocumentDto {
    @IsString({ message: 'id deve ser uma string' })
    id: string;
  
    @IsString({ message: 'name deve ser uma string' })
    name: string;
  
    @IsOptional()
    @IsString({ message: 'description deve ser uma string' })
    description?: string;
  
    @ValidateNested()
    @Type(() => MediaDto)
    media: MediaDto;
  }
  
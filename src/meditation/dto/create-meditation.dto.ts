import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WeekDay } from '../entities/day.entity';
import { MediaPlatform, MediaUploadType } from 'src/share/media/media-item/media-item.entity';

class DayDto {
  @IsEnum(WeekDay, {
    message: 'day deve ser um dos valores: Monday, Tuesday, Wednesday, Thursday, Friday',
  })
  day: WeekDay;

  @IsString({ message: 'verse deve ser uma string' })
  verse: string;

  @IsString({ message: 'topic deve ser uma string' })
  topic: string;
}

class MediaDto {
  @IsString({ message: 'title deve ser uma string' })
  title: string;

  @IsString({ message: 'description deve ser uma string' })
  description: string;

  @IsEnum(MediaUploadType, { message: 'type deve ser "link" ou "upload"' })
  type: MediaUploadType;

  @IsBoolean({ message: 'isLocalFile deve ser um booleano' })
  isLocalFile: boolean;

  @IsString({ message: 'url deve ser uma string' })
  url: string;

  @IsOptional()
  @IsEnum(MediaPlatform, { message: 'platform deve ser um valor válido' })
  platform?: MediaPlatform;

  @IsOptional()
  @IsString({ message: 'originalName deve ser uma string' })
  originalName?: string;

  @IsOptional()
  @IsNumber({}, { message: 'size deve ser um número' })
  size?: number;
}

export class CreateMeditationDto {
  @IsString({ message: 'topic deve ser uma string' })
  topic: string;

  @IsDateString({}, { message: 'startDate deve estar em formato ISO válido (YYYY-MM-DD)' })
  startDate: string;

  @IsDateString({}, { message: 'endDate deve estar em formato ISO válido (YYYY-MM-DD)' })
  endDate: string;

  @ValidateNested()
  @Type(() => MediaDto)
  media: MediaDto;

  @IsArray({ message: 'days deve ser um array' })
  @ArrayMinSize(5, { message: 'days deve conter exatamente 5 itens' })
  @ArrayMaxSize(5, { message: 'days deve conter exatamente 5 itens' })
  @ValidateNested({ each: true })
  @Type(() => DayDto)
  days: DayDto[];
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class AwsS3Service {
  private readonly logger = new Logger(AwsS3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';

    if (!this.bucketName) {
      this.logger.error('❌ AWS_S3_BUCKET_NAME não foi definido!');
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async upload(file: Express.Multer.File): Promise<string> {
    const key = `uploads/${Date.now()}_${file.originalname}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);
      this.logger.log(`📤 Upload realizado: ${key}`);
      return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
    } catch (err) {
      this.logger.error(`❌ Erro ao enviar para o S3: ${err.message}`);
      throw new Error('Erro ao fazer upload para o S3');
    }
  }

  async delete(url: string): Promise<void> {
    const key = url.split(`${this.bucketName}.s3.amazonaws.com/`)[1];
    if (!key) {
      this.logger.warn(`⚠️ Não foi possível extrair a chave do S3 da URL: ${url}`);
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
      this.logger.log(`🗑️ Arquivo removido: ${key}`);
    } catch (err) {
      this.logger.error(`❌ Erro ao remover do S3: ${err.message}`);
    }
  }
}

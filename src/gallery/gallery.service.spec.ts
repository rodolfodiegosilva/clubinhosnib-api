import { Test, TestingModule } from '@nestjs/testing';
import { GalleryService } from './gallery.service';
import { GalleryPageRepository } from './gallery-page.repository';
import { RouteService } from 'src/route/route.service';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { CreateGalleryPageDTO } from './dto/create-gallery.dto';
import { GalleryPage } from './gallery-page.entity';

const mockGalleryPageRepo = () => ({
  save: jest.fn(),
  findOneWithRelations: jest.fn(),
  findAllWithRelations: jest.fn(),
  remove: jest.fn(),
});

const mockRouteService = () => ({
  checkPathAvailability: jest.fn(),
  createRouteForGallery: jest.fn(),
});

const mockAwsS3Service = () => ({
  upload: jest.fn(),
  delete: jest.fn(),
});

describe('GalleryService', () => {
  let service: GalleryService;
  let repo;
  let route;
  let s3;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GalleryService,
        { provide: GalleryPageRepository, useFactory: mockGalleryPageRepo },
        { provide: RouteService, useFactory: mockRouteService },
        { provide: AwsS3Service, useFactory: mockAwsS3Service },
      ],
    }).compile();

    service = module.get<GalleryService>(GalleryService);
    repo = module.get(GalleryPageRepository);
    route = module.get(RouteService);
    s3 = module.get(AwsS3Service);
  });

  describe('createGalleryPage', () => {
    it('should upload local files and set isLocalFile true', async () => {
      const fileMock = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('test'),
        size: 1234,
      } as Express.Multer.File;

      const dto: CreateGalleryPageDTO = {
        name: 'Test Page',
        description: 'A test page',
        sections: [
          {
            caption: 'Caption 1',
            description: 'Description 1',
            images: [
              {
                isLocalFile: true,
                fileFieldName: 'file1',
              },
              {
                isLocalFile: false,
                url: 'https://external.com/image.jpg',
              },
            ],
          },
        ],
      };

      s3.upload.mockResolvedValue('https://aws.com/uploaded.jpg');
      route.checkPathAvailability.mockResolvedValue(true);
      route.createRouteForGallery.mockResolvedValue({ path: 'galeria_test' });
      repo.save.mockImplementation((page) => Promise.resolve(page));

      const result: GalleryPage = await service.createGalleryPage(dto, {
        file1: fileMock,
      });

      expect(result.sections[0].images).toHaveLength(2);
      expect(result.sections[0].images[0].url).toBe('https://aws.com/uploaded.jpg');
      expect(result.sections[0].images[0].isLocalFile).toBe(true);
      expect(result.sections[0].images[1].url).toBe('https://external.com/image.jpg');
      expect(result.sections[0].images[1].isLocalFile).toBe(false);
    });
  });
});
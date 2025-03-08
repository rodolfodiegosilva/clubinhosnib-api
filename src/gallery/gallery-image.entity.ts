import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { GallerySection } from './gallery-section.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('gallery_images')
export class GalleryImage {
  @PrimaryColumn()
  id: string;

  @Column()
  url: string;

  @Column({ default: false })
  isLocalFile: boolean;

  @Column({ nullable: true })
  originalName?: string;

  @Column({ nullable: true })
  size?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => GallerySection, (section) => section.images, { onDelete: 'CASCADE' })
  section: GallerySection;

  constructor() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
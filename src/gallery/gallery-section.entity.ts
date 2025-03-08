import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { GalleryImage } from './gallery-image.entity';
import { GalleryPage } from './gallery-page.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('gallery_sections')
export class GallerySection {
  @PrimaryColumn()
  id: string;

  @Column()
  caption: string;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => GalleryImage, (img) => img.section, { cascade: true })
  images: GalleryImage[];

  @ManyToOne(() => GalleryPage, (page) => page.sections, { onDelete: 'CASCADE' })
  page: GalleryPage;

  constructor() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
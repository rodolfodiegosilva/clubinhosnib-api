import { Entity, PrimaryColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { GallerySection } from './gallery-section.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('gallery_pages')
export class GalleryPage {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => GallerySection, (section) => section.page, { cascade: true })
  sections: GallerySection[];

  constructor() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
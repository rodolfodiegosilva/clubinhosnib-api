import { Entity, PrimaryColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { GallerySection } from './gallery-section.entity';
import { Route } from '../route/route-page.entity';

@Entity('gallery_pages')
export class GalleryPage {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @OneToOne(() => Route, { cascade: true, eager: true })
  @JoinColumn()
  route: Route;

  @OneToMany(() => GallerySection, (section) => section.page, { cascade: true })
  sections: GallerySection[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  constructor() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}

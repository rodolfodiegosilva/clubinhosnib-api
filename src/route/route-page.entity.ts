import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RouteType {
  PAGE = 'page',
  DOC = 'doc',
  IMAGE = 'image',
}

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  image: string;
  
  @Column()
  idToFetch: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  path: string;

  @Column({ type: 'varchar', length: 100 })
  entityType: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'enum', enum: RouteType })
  type: RouteType;


  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

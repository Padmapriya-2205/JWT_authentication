import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;
export type UserRole = 'user' | 'admin';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  username!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  phoneNumber!: string;

  @Prop({ required: true, enum: ['user', 'admin'], default: 'user' })
  role!: UserRole;

  @Prop({ select: false })
  refreshTokenHash?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

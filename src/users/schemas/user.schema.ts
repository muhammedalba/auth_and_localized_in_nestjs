import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Exclude } from 'class-transformer';
import slugify from 'slugify';

@Schema({ timestamps: true })
export class User {
  @Prop({
    type: 'string',
    trim: true,
    unique: false,
    required: true,
    minlength: [4, 'name must be a least 4 characters'],
    maxlength: [30, 'name must be a maximum of 30 characters'],
  })
  name!: string;
  @Prop({
    type: 'string',
    trim: true,
    lowercase: true,
  })
  slug?: string;
  @Prop({
    required: true,
    type: 'string',
    trim: true,
    isEmail: true,
    unique: true,
  })
  email!: string;

  @Prop({
    required: true,
    trim: true,
    type: 'string',
    minlength: [6, 'password must be a least 8 characters'],
    maxlength: [32, 'password must be a maximum of 100 characters'],
    select: false,
  })
  @Exclude()
  password!: string;

  @Prop({
    required: false,
    lowercase: true,
    type: 'string',
    enum: ['user', 'admin', 'manager'],
    default: 'user',
  })
  @Exclude()
  role?: string;
  @Exclude()
  @Prop({
    required: false,
    type: Boolean,
    default: undefined,
  })
  verificationCode?: boolean;
  @Prop({
    required: false,
    type: Number,
    default: undefined,
  })
  passwordResetExpires?: number;
  @Prop({
    required: false,
    type: 'string',
    default: undefined,
  })
  passwordResetCode?: string;
  @Prop({
    required: false,
    type: 'string',
    default: 'default.png',
    trim: true,
  })
  avatar?: string;
}
export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

// Hook for hashing password before saving
UserSchema.pre('save', async function (next) {
  if (this.name) {
    this.slug = slugify(this.name, { lower: true });
  }
  if (!this.isModified('password')) return next();

  if (typeof this.password === 'string') {
    const saltOrRounds = process.env.saltOrRounds || '10';
    const hash = await bcrypt.hash(this.password, parseInt(saltOrRounds, 10));
    this.password = hash;
  }

  next();
});
//update , findOne and findAll
UserSchema.post('init', function (doc) {
  if (doc.avatar && doc.name) {
    if (!doc.avatar.startsWith(process.env.BASE_URL ?? 'http')) {
      doc.avatar = `${process.env.BASE_URL}${doc.avatar}`;
    }
  }
});

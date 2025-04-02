import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema, User } from 'src/users/schemas/user.schema';

@Module({
  imports: [
    FileUploadDiskStorageModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

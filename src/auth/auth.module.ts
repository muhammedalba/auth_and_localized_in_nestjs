import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/users/shared/schemas/user.schema';
import {
  RefreshToken,
  refreshTokenSchema,
} from './shared/schema/refresh-token.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { EmailModule } from 'src/email/email.module';
import { tokenService } from './shared/services/token.service';
import { CookieService } from './shared/services/cookie.service';
import { PasswordResetService } from './shared/services/password-reset.service';
import { userProfileService } from './shared/services/user-profile.service';

@Module({
  imports: [
    FileUploadDiskStorageModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshToken.name, schema: refreshTokenSchema },
    ]),
    EmailModule,
  ],
  exports: [AuthService],
  controllers: [AuthController],
  providers: [
    AuthService,
    CookieService,
    CustomI18nService,
    PasswordResetService,
    tokenService,
    userProfileService,
  ],
})
export class AuthModule {}

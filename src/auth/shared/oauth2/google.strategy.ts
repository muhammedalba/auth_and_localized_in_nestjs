import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { Request } from 'express';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly AuthService: AuthService) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Missing Google OAuth environment variables');
    }

    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/api/v1/auth/google/redirect`,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): any {
    const { id, name, emails, photos } = profile;

    const userData = {
      email: emails?.[0]?.value,
      name: `${name?.givenName} ${name?.familyName}`,
      picture: photos?.[0]?.value,
      provider: 'google',
      providerId: id,
    };

    // حفظ أو جلب المستخدم من قاعدة البيانات
    //     const user = await this.AuthService.(userData.providerId);

    return userData;
  }
}

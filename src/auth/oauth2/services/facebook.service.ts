import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { Response } from 'express';
import { User } from 'src/users/shared/schemas/user.schema';
import { tokenService } from 'src/auth/shared/services/token.service';
import { CookieService } from 'src/auth/shared/services/cookie.service';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';

@Injectable()
export class facebookService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly i18n: CustomI18nService,
    private readonly tokenService: tokenService,
    private readonly cookieService: CookieService,
  ) {}

  async facebookLogin(
    facebookUser: {
      email: string;
      name: string;
      picture: string;
      provider: string;
      facebookId: string;
    },
    res: Response,
  ) {
    const { email } = facebookUser;

    // 1) check user is use
    const user = await this.userModel
      .findOne({ email: email })
      .select('name role email avatar')
      .lean();

    let Tokens: { refresh_Token: string; access_token: string };
    //
    if (!user) {
      //1) create password
      const randomPassword = crypto.randomBytes(16).toString('hex');
      // 2) create user
      const newUser = await this.userModel.create({
        email: facebookUser.email,
        name: facebookUser.name,
        password: randomPassword,
        avatar: facebookUser.picture,
        provider: 'facebook',
      });
      const userId = {
        user_id: newUser._id.toString(),
        role: 'user',
        email: newUser.email,
      };
      // 3) generate access token
      Tokens = await this.tokenService.generate_Tokens(userId, '1h');
      //4) send token to cookies
      // 5) Set cookies using CookieService
      this.cookieService.setRefreshTokenCookie(res, Tokens.refresh_Token);
      this.cookieService.setAccessTokenCookie(res, Tokens.access_token);

      return {
        status: 'success',
        message: this.i18n.translate('success.LOGIN_SUCCESS'),
        data: { ...newUser.toObject(), password: undefined },
        access_token: Tokens.access_token,
      };
    } else {
      const userId = {
        user_id: user._id.toString(),
        role: user.role || 'user',
        email: user.email,
      };
      Tokens = await this.tokenService.generate_Tokens(userId, '1h');
      this.cookieService.setRefreshTokenCookie(res, Tokens.refresh_Token);
      this.cookieService.setAccessTokenCookie(res, Tokens.access_token);
    }

    return {
      status: 'success',
      message: this.i18n.translate('success.LOGIN_SUCCESS'),
      data: user,
      access_token: Tokens.access_token,
    };
  }
}

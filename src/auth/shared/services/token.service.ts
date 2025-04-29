import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { RefreshToken } from '../schema/refresh-token.schema';
import { RefreshTokenDto } from '../Dto/refresh-Token.Dto';

interface DecodedToken {
  user_id: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class tokenService {
  constructor(
    private readonly i18n: CustomI18nService,
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    private readonly jwtService: JwtService,
  ) {}

  // --- generate new access tokens and delete old refresh token --- //
  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    //1) find refresh token from database
    const refresh_Token = await this.RefreshTokenModel.findOne({
      refresh_Token: refreshTokenDto.refresh_Token,
      expiryDate: { $gt: new Date() },
    })
      .select('refresh_Token expiryDate')
      .lean();

    if (!refresh_Token) {
      throw new BadRequestException(
        this.i18n.translate('exception.INVALID', {
          args: { variable: 'refresh token' },
        }),
      );
    }

    //2) Verify ACCESS  token
    const decoded_access_token =
      await this.jwtService.verifyAsync<DecodedToken>(
        refreshTokenDto.access_token,
      );
    if (!decoded_access_token) {
      throw new BadRequestException(
        this.i18n.translate('exception.INVALID', {
          args: { variable: 'access token' },
        }),
      );
    }
    //3) verify user data from decoded token
    const userData = {
      user_id: decoded_access_token.user_id,
      role: decoded_access_token.role || 'user',
      email: decoded_access_token.email,
    };
    // generate new access and refresh token and delete old refresh token
    const new_access_Tokens = await this.generate_Tokens(userData, '1h');
    return new_access_Tokens;
  }

  async generate_Tokens(userData: DecodedToken, expiresIn: string) {
    // 1) generate new access token
    const access_token = await this.jwtService.signAsync(userData, {
      expiresIn: expiresIn,
    });
    //2) generate new refresh token
    const refresh_Token = uuidv4();
    // save refresh token in database
    await this.store_Refresh_Token(userData.user_id, refresh_Token);

    return { access_token, refresh_Token };
  }

  // delete old refresh token and save new refresh token in date base
  async store_Refresh_Token(userId: string, refresh_Token: string) {
    //1) delete old refresh token from database
    await this.RefreshTokenModel.findOneAndDelete({
      userId: userId,
    })
      .select('userId')
      .lean();

    //2) add expiry date to refresh token
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 3);
    //3) save refresh token in database
    await this.RefreshTokenModel.create({
      refresh_Token: refresh_Token,
      userId: userId,
      expiryDate: expiryDate,
    });
  }
}

import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/users/shared/schemas/user.schema';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { EmailService } from 'src/email/email.service';
import { RefreshToken } from '../shared/schema/refresh-token.schema';
import { ForgotPasswordDto } from '../shared/Dto/forgotPassword.dto.';
import { resetCodeDto } from '../shared/Dto/resetCode.dto';
import { LoginUserDto } from '../shared/Dto/login.dto';
interface DecodedToken {
  user_id: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    private readonly i18n: CustomI18nService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    // 1 ) get user by email
    const user = await this.userModel
      .findOne({
        email: forgotPasswordDto.email,
      })
      .select(
        'email name passwordResetCode passwordResetExpires verificationCode',
      )
      .exec();
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.NOT_FOUND', {
          args: { variable: 'email' },
        }),
      );
    }
    // 2) generate hash reset rendom 6 digits and save it in db
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedResetCode = crypto
      .createHash('sha256')
      .update(resetCode)
      .digest('hex');
    // save hashed password reset code into db
    user.passwordResetCode = hashedResetCode;
    // add expiration time for password reset code (10 min)
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    user.verificationCode = false;
    await user.save();

    // 3 ) send email with code
    try {
      await this.emailService.sendRandomCode(
        user.email,
        user.name,
        resetCode.toString(),
        this.i18n.translate('email.VERIFY_CODE_SUBJECT'),
      );
    } catch {
      user.passwordResetCode = undefined;
      user.passwordResetExpires = undefined;
      user.verificationCode = undefined;
      await user.save();
      throw new BadGatewayException(
        this.i18n.translate('exception.ERROR_SEND', {
          args: { variable: 'email' },
        }),
      );
    }

    // 4 ) save code in database
    await user.save();

    return {
      status: 'success',
      message: 'Reset code sent to your email',
    };
  }

  async verify_Pass_Reset_Code(resetCode: resetCodeDto) {
    //1)  get user based on reset code
    const hashedResetCode = crypto
      .createHash('sha256')
      .update(resetCode.resetCode)
      .digest('hex');
    // 2) check if reset code is valid and not expired
    const user = await this.userModel
      .findOne({
        passwordResetCode: hashedResetCode,
        passwordResetExpires: { $gt: Date.now() },
      })
      .select('verificationCode')
      .exec();

    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.INVALID', {
          args: { variable: 'code' },
        }),
      );
    }
    // 3) reset code is invalid
    user.verificationCode = true;

    await user.save();
    return {
      status: 'success',
      message: 'Code is valid',
    };
  }
  async resetPassword(LoginUserDto: LoginUserDto) {
    // 1) get user by email
    const user = await this.userModel
      .findOne({ email: LoginUserDto.email })
      .select('email role verificationCode passwordResetExpires')
      .exec();
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.NOT_FOUND', {
          args: { variable: 'email' },
        }),
      );
    }
    // 2) check if password reset code is valid and not expired
    if (
      !user.verificationCode ||
      (user.passwordResetExpires ?? 0) < Date.now()
    ) {
      throw new BadRequestException(
        this.i18n.translate('exception.INVALID', {
          args: { variable: 'code our expired' },
        }),
      );
    }
    // 3) save new password and  reset seatings
    user.password = LoginUserDto.password;
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    user.verificationCode = undefined;
    await user.save();
    // 4) if everything is ok ,generate token
    const userId = {
      user_id: user._id.toString(),
      role: user.role || 'user',
      email: user.email,
    };
    const Tokens = await this.generate_Tokens(userId, '1h');
    // 5) send email to user
    try {
      await this.emailService.send_reset_password_success(
        user.email,
        user.name,
        `${process.env.BASE_URL}/auth/login`,
        `${process.env.BASE_URL}/auth/login`,
        'Password reset successfully',
      );
    } catch {
      throw new BadGatewayException(
        this.i18n.translate('exception.ERROR_SEND', {
          args: { variable: 'email' },
        }),
      );
    }
    return {
      status: 'success',
      message: 'Password reset successfully',
      Tokens,
    };
  }
  // --- generate new access tokens and delete old refresh token --- //

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

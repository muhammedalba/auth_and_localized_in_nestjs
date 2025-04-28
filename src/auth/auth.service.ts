import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';
import { CreateUserDto, UserRole } from 'src/users/dto/create-user.dto';
import { User } from 'src/users/schemas/user.schema';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { JwtService } from '@nestjs/jwt';
import { RefreshToken } from './shared/schema/refresh-token.schema';
import { v4 as uuidv4 } from 'uuid';
import { RefreshTokenDto } from './shared/Dto/refresh-Token.Dto';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { EmailService } from 'src/email/email.service';
import { ForgotPasswordDto } from './shared/Dto/forgotPassword.dto.';
import { LoginUserDto } from './shared/Dto/login.dto';
import { resetCodeDto } from './shared/Dto/resetCode.dto';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';
interface DecodedToken {
  user_id: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly i18n: CustomI18nService,
    private readonly emailService: EmailService,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    private readonly fileUploadService: FileUploadService,
    private readonly jwtService: JwtService,
  ) {}
  async getMe(request: {
    user: { user_id: string; role: string };
  }): Promise<any> {
    // 1) get user from database
    const user_Id = request.user.user_id;
    const user = await this.userModel
      .findById(user_Id)
      .select('-__v -role -slug')
      .lean();
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.NOT_FOUND', {
          args: { variable: user_Id },
        }),
      );
    }
    // 2) add avatar url
    if (
      user.avatar &&
      !user.avatar.startsWith(process.env.BASE_URL ?? 'http')
    ) {
      user.avatar = `${process.env.BASE_URL}${user.avatar}`;
    }
    return user;
  }
  async updateMe(
    userId: { user: { user_id: string } },
    updateUserDto: UpdateUserDto,
    file: Express.Multer.File,
  ) {
    //1) check if user exists
    const user = await this.userModel
      .findById(userId.user.user_id)
      .select('avatar');

    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.NOT_FOUND', {
          args: { variable: userId },
        }),
      );
    }
    // 2) check if email is in use
    const isExists = await this.userModel.exists({
      email: updateUserDto.email,
      _id: { $ne: user._id },
    });

    if (isExists) {
      throw new BadRequestException(
        this.i18n.translate('exception.EMAIL_EXISTS'),
      );
    }
    // 3) update user avatar if new file is provided
    if (file) {
      const destinationPath = `./${process.env.UPLOADS_FOLDER}/users`;
      const oldAvatarPath = `.${user.avatar}`;
      const avatarPath = await this.fileUploadService.updateFile(
        file,
        destinationPath,
        oldAvatarPath,
      );
      // 4) update user avatar
      updateUserDto.avatar = avatarPath;
    }
    // 5) check if password is provided  delete  refresh tokens for the user
    if (updateUserDto.password) {
      try {
        await this.RefreshTokenModel.deleteOne({
          userId: user._id,
        });
      } catch {
        throw new BadRequestException(this.i18n.translate('exception.LOGOUT'));
      }
    }
    // 4) update user in the database
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        { _id: user._id },
        {
          $set: {
            name: updateUserDto.name,
            email: updateUserDto.email,
            avatar: updateUserDto.avatar,
            password: updateUserDto.password,
          },
        },
        { new: true, runValidators: true },
      )
      .select('-__v');

    return {
      status: 'success',
      message: 'User updated successfully',
      updatedUser,
    };
  }
  // --- register user --- //
  async register(
    createUserDto: CreateUserDto,
    file: Express.Multer.File,
  ): Promise<User> {
    const { email } = createUserDto;
    //1) check email if is in use
    const isExists = await this.userModel.exists({
      email: email,
    });
    if (isExists) {
      throw new BadRequestException(
        this.i18n.translate('exception.EMAIL_EXISTS'),
      );
    }
    //2) file upload service (save image in disk storage)
    let filePath = `/${process.env.UPLOADS_FOLDER}/users/avatar.png`;
    if (file) {
      try {
        filePath = await this.fileUploadService.saveFileToDisk(
          file,
          `./${process.env.UPLOADS_FOLDER}/users`,
        );
      } catch (error) {
        console.error('File upload failed:', error);
      }
    }
    //3) save user to db with avatar path
    createUserDto.avatar = filePath;
    // reset role to user
    createUserDto.role = UserRole.USER;
    const newUser = await this.userModel.create(createUserDto);
    //4) generate refresh token and access token and save the refresh token in database and delete old refresh token
    const userId = {
      user_id: newUser._id.toString(),
      role: UserRole.USER,
      email: newUser.email,
      passwordChangeAt: undefined,
    };

    const Tokens = await this.generate_Tokens(userId, '1h');
    //5) update avatar url and tokens
    newUser.avatar = `${process.env.BASE_URL}${filePath}`;
    const userWithTokens = { ...newUser.toObject(), Tokens, status: 'success' };
    return userWithTokens;
  }
  async login(
    loginUserDto: LoginUserDto,
  ): Promise<{ status: string; userResponse: any; Tokens: any }> {
    const { email, password } = loginUserDto;
    // 1) Find user by email
    const user = await this.userModel
      .findOne({ email })
      .select('password email role avatar name passwordChangeAt')
      .lean();

    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.INVALID', {
          args: { variable: 'email or password' },
        }),
      );
    }
    // 2) check password is valid
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new BadRequestException(
        this.i18n.translate('exception.INVALID', {
          args: { variable: 'email or password' },
        }),
      );
    }

    // 3) generate RefreshToken and access token and save the refresh token in database and delete old refresh token
    const userId = {
      user_id: user._id.toString(),
      role: user.role || 'user',
      email: user.email,
      passwordChangeAt: user.passwordChangeAt,
    };
    const Tokens = await this.generate_Tokens(userId, '1h');

    // 5) Clean user data before returning
    const userResponse = {
      ...user,
      avatar: `${process.env.BASE_URL}${user.avatar}`,
      password: undefined,
    };
    return {
      status: 'success',
      userResponse,
      Tokens,
    };
  }

  async logout(req: { user: { user_id: string } }) {
    // 1) check if user is logged in
    if (!req.user) {
      throw new BadRequestException(
        this.i18n.translate('exception.NOT_LOGGED'),
      );
    }
    // delete  refresh tokens for the user
    try {
      await this.RefreshTokenModel.deleteOne({
        userId: req.user.user_id,
      });
      return { message: 'Logged out successfully' };
    } catch {
      throw new BadRequestException(this.i18n.translate('exception.LOGOUT'));
    }
  }
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

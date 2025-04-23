import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { User } from 'src/users/schemas/user.schema';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import slugify from 'slugify';
import * as bcrypt from 'bcrypt';

import { JwtService } from '@nestjs/jwt';
import { RefreshToken } from './shared/schema/refresh-token.schema';
import { v4 as uuidv4 } from 'uuid';
import { RefreshTokenDto } from './shared/Dto/refresh-Token.Dto';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { EmailService } from 'src/email/email.service';
import { ForgotPasswordDto } from './shared/Dto/forgotPassword.dto.';
import { LoginUserDto } from './shared/Dto/login.dto';
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
  async register(
    createUserDto: CreateUserDto,
    file: Express.Multer.File,
  ): Promise<User> {
    const { email, name } = createUserDto;
    //1) check email if is in use
    const isExists = await this.userModel.exists({
      email: email,
    });
    if (isExists) {
      throw new BadRequestException('Email already exists');
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

    createUserDto.slug = name
      ? slugify(name, { lower: true, strict: true })
      : '';

    //3) save user to db with avatar path
    createUserDto.avatar = filePath;
    const newUser = await this.userModel.create(createUserDto);
    //4) generate refresh token and access token and save the refresh token in database and delet old refresh token
    const userId = {
      user_id: newUser._id.toString(),
      role: 'user',
      email: newUser.email,
    };

    const Tokens = await this.generate_Tokens(userId, '1h');
    //5) update avatar url and tokens
    newUser.avatar = `${process.env.BASE_URL}${filePath}`;
    const userWithTokens = { ...newUser.toObject(), Tokens, status: 'success' };
    return userWithTokens;
  }
  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;
    // 1) check email in database
    const user = await this.userModel
      .findOne({ email })
      .select('password email role avatar');
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('test.HELLO', { args: { email } }),
      );
      // throw new BadRequestException('Invalid credentials');
    }
    // 2) check password is valid
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new BadRequestException('Invalid credentials');
    }
    // 3) generate RefreshToken and access token and save the refresh token in database and delet old refresh token
    const userId = {
      user_id: user._id.toString(),
      role: user.role || 'user',
      email: user.email,
    };
    const Tokens = await this.generate_Tokens(userId, '1h');

    //5) update avatar url
    user.avatar = `${process.env.BASE_URL}${user.avatar}`;
    const userWithTokens = { ...user.toObject(), Tokens, status: 'success' };
    return userWithTokens;
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    //1) find refresh token from database
    const refreshToken = await this.RefreshTokenModel.findOne({
      refresh_Token: refreshTokenDto.refresh_Token,
      expiryDate: { $gt: new Date() },
    }).select('refresh_Token expiryDate');

    if (!refreshToken) {
      throw new BadRequestException('Invalid Refresh Token');
    }

    //2) Verify ACCESS  token
    const decoded_hToken = await this.jwtService.verifyAsync<DecodedToken>(
      refreshTokenDto.access_token,
    );
    if (!decoded_hToken) {
      throw new BadRequestException('Invalid  Token');
    }
    //3) verify user data from decoded token
    const userData = {
      user_id: decoded_hToken.user_id,
      role: decoded_hToken.role || 'user',
      email: decoded_hToken.email,
    };
    // generate new access and refresh token and delet old refresh token
    const new_access_Tokens = await this.generate_Tokens(userData, '1h');
    return new_access_Tokens;
  }

  async logout(req: { user: { user_id: string } }) {
    // delete  refresh tokens for the user
    try {
      const deleted = await this.RefreshTokenModel.deleteOne({
        userId: req.user.user_id,
      });
      console.log(deleted);
      return { message: 'Logged out successfully' };
    } catch {
      throw new BadRequestException('Error occurred while logging out');
    }
  }
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    // 1 ) check email if is in use
    const user = await this.userModel
      .findOne({
        email: forgotPasswordDto.email,
      })
      .select('email name');
    if (!user) {
      throw new BadRequestException('Email not found');
    }
    // 2 ) generate random 6  number
    const code = Math.floor(100000 + Math.random() * 900000);
    console.log(code, 'code');

    // 3 ) send email with code
    await this.emailService.sendRandomCode(
      user.email,
      user.name,
      code.toString(),
    );
    // 4 ) save code in database
    await this.userModel.findOneAndUpdate(
      { email: forgotPasswordDto.email },
      { verificationCode: code },
    );
    return {
      status: 'success',
      message: this.i18n.translate('test.HELLO', {
        args: { email: forgotPasswordDto.email },
      }),
    };
  }

  // --- generate tokens and delete old refresh token --- //
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
    await this.RefreshTokenModel.findOneAndDelete({ userId: userId });
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

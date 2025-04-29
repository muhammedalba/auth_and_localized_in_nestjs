import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto, UserRole } from 'src/users/shared/dto/create-user.dto';
import { User } from 'src/users/shared/schemas/user.schema';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import * as bcrypt from 'bcrypt';
import { RefreshToken } from '../shared/schema/refresh-token.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { ForgotPasswordDto } from '../shared/Dto/forgotPassword.dto.';
import { LoginUserDto } from '../shared/Dto/login.dto';
import { resetCodeDto } from '../shared/Dto/resetCode.dto';
import { UpdateUserDto } from 'src/users/shared/dto/update-user.dto';
import { PasswordResetService } from './password-reset.service';
import { tokenService } from '../shared/services/token.service';
import { RefreshTokenDto } from '../shared/Dto/refresh-Token.Dto';
import { userProfileService } from './user-profile.service';
type file = Express.Multer.File;
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    private readonly fileUploadService: FileUploadService,
    private readonly i18n: CustomI18nService,
    private readonly tokenService: tokenService,
    private readonly passwordResetService: PasswordResetService,
    private readonly userProfileService: userProfileService,
  ) {}
  async getMe(request: {
    user: { user_id: string; role: string };
  }): Promise<any> {
    return await this.userProfileService.getMe(request);
  }
  async updateMe(
    userId: { user: { user_id: string } },
    updateUserDto: UpdateUserDto,
    file: file,
  ): Promise<any> {
    return await this.userProfileService.updateMe(userId, updateUserDto, file);
  }
  async changeMyPassword(
    userId: { user: { user_id: string } },
    updateUserDto: UpdateUserDto,
  ): Promise<any> {
    return await this.userProfileService.changeMyPassword(
      userId,
      updateUserDto,
    );
  }
  // --- register user --- //
  async register(createUserDto: CreateUserDto, file: file): Promise<User> {
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

    const Tokens = await this.tokenService.generate_Tokens(userId, '1h');
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
    const Tokens = await this.tokenService.generate_Tokens(userId, '1h');

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

  async logout(req: { user: { user_id: string } }): Promise<any> {
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
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<any> {
    return await this.passwordResetService.forgotPassword(forgotPasswordDto);
  }

  async verify_Pass_Reset_Code(resetCode: resetCodeDto): Promise<any> {
    return await this.passwordResetService.verify_Pass_Reset_Code(resetCode);
  }
  async resetPassword(LoginUserDto: LoginUserDto): Promise<any> {
    return await this.passwordResetService.resetPassword(LoginUserDto);
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<any> {
    return await this.tokenService.refreshToken(refreshTokenDto);
  }
}

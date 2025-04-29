import { BadRequestException, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { User } from 'src/users/shared/schemas/user.schema';
import { UpdateUserDto } from '../../users/shared/dto/update-user.dto';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { RefreshToken } from '../shared/schema/refresh-token.schema';

type file = Express.Multer.File;

@Injectable()
export class userProfileService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    private readonly fileUploadService: FileUploadService,
    private readonly i18n: CustomI18nService,
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
    file: file,
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
    // 4) update user in the database
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        { _id: user._id },
        {
          $set: {
            name: updateUserDto.name,
            email: updateUserDto.email,
            avatar: updateUserDto.avatar,
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
  async changeMyPassword(
    userId: { user: { user_id: string } },
    updateUserDto: UpdateUserDto,
  ) {
    // 1) update user password
    const user = await this.userModel
      .findByIdAndUpdate(
        { _id: userId.user.user_id },
        {
          $set: {
            password: updateUserDto.password,
          },
        },
        { new: true, runValidators: true },
      )
      .select('-__v')
      .lean();
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.NOT_FOUND', {
          args: { variable: userId },
        }),
      );
    }
    // 2) check if password is provided  delete  refresh tokens for the user
    try {
      await this.RefreshTokenModel.deleteOne({
        userId: userId.user.user_id,
      }).lean();
    } catch {
      throw new BadRequestException(this.i18n.translate('exception.LOGOUT'));
    }

    return {
      status: 'success',
      message: 'Password changed successfully',
      user,
    };
  }
}

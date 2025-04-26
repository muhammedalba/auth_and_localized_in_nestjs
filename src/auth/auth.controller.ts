import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { LoginUserDto } from 'src/auth/shared/Dto/login.dto';
import { RefreshTokenDto } from './shared/Dto/refresh-Token.Dto';
import { AuthGuard } from './shared/guards/auth.guard';
import { ForgotPasswordDto } from './shared/Dto/forgotPassword.dto.';
import { resetCodeDto } from './shared/Dto/resetCode.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  /*
   * public: http://localhost:4000/api/v1/auth
   * method: POST
   */
  @Post('login')
  login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.login(loginUserDto);
  }
  /*
   * public: http://localhost:4000/api/v1/auth/register
   * method: POST
   */
  @Post('register')
  @UseInterceptors(FileInterceptor('avatar'))
  async register(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
    file: Express.Multer.File,
  ) {
    // Implement registration logic
    return await this.authService.register(createUserDto, file);
  }
  /*
   * public: http://localhost:4000/api/v1/auth/refresh-token
   * method: POST
   */
  @Post('refresh-token')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return await this.authService.refreshToken(refreshTokenDto);
  }
  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@Request() request: { user: { user_id: string } }) {
    return await this.authService.logout(request);
  }
  @Get('me')
  async getMe() {
    // Implement getMe logic
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPassword: ForgotPasswordDto) {
    return await this.authService.forgotPassword(forgotPassword);
  }
  @Post('reset-password')
  async resetPassword(@Body() LoginUserDto: LoginUserDto) {
    return this.authService.resetPassword(LoginUserDto);
  }
  @Post('verify-Pass-Reset-Code')
  async verify_Pass_Reset_Code(@Body() code: resetCodeDto) {
    return this.authService.verify_Pass_Reset_Code(code);
  }
}

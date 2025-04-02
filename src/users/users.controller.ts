import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { FileInterceptor } from '@nestjs/platform-express';

import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { CreateUserDto } from './dto/create-user.dto';
import { IdParamDto } from './dto/id-param.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { Roles } from 'src/auth/decorators/rolesdecorator';
import { roles } from 'src/auth/enums/role.enum';
import { RoleGuard } from 'src/auth/guards/role.guard';

//  * rote: http://localhost:4000/api/v1/users
//  * privet
@Controller('users')
@Roles(roles.ADMIN)
@UseGuards(RoleGuard)
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  /*
   * Creates a new user with the provided data and avatar file.
   * The uploaded avatar file, validated to be of type png, jpeg, or webp and not exceeding 1MB.
   */
  @Post()
  @UseInterceptors(FileInterceptor('avatar'))
  createUser(
    @Body()
    CreateUserDto: CreateUserDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
    file: Express.Multer.File,
  ) {
    return this.usersService.createUser(CreateUserDto, file);
  }

  /**
   * Retrieves a list of all users.
   * rote: http://localhost:4000/api/v1/users
   * privet
   * returns An array of user objects.
   */
  @Get()
  getUsers() {
    return this.usersService.getUsers();
  }
  // @Post()
  // @UseInterceptors(FileInterceptor('file'))
  // create(
  //   @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
  //   file: Express.Multer.File,
  // ): any {
  //   return this.usersService.create(file);
  // }

  // @Post('/users')
  // @UseInterceptors(FilesInterceptor('file', MaxFileCount.PRODUCTS_IMAGES))
  // createMany(
  //   @UploadedFiles(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
  //   file: Express.Multer.File,
  // ): any {
  //   return this.usersService.createMany(file);
  // }

  /**
   * rote: http://localhost:4000/api/v1/users
   * privet
   * Retrieves a user by their unique identifier.
   * @param IdParamDto - An object containing the user's ID.
   * @returns The user object corresponding to the provided ID.
   */
  @Get(':id')
  findOne(@Param() IdParamDto: IdParamDto) {
    return this.usersService.findOne(IdParamDto.id);
  }
  /*
   * rote: http://localhost:4000/api/v1/users/:id
   * privet
   */
  @Patch(':id')
  @UseInterceptors(FileInterceptor('avatar'))
  update_user(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
    file: Express.Multer.File,
    @Param()
    IdParamDto: IdParamDto,
    @Body()
    UpdateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update_user(IdParamDto.id, UpdateUserDto, file);
  }
  /*
   * rote: http://localhost:4000/api/v1/users:id
   * privet
   */
  @Delete(':id')
  delete_user(@Param() IdParamDto: IdParamDto) {
    return this.usersService.delete_user(IdParamDto.id);
  }
}

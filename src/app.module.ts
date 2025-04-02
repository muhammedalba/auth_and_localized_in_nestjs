import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from './auth/auth.module';
import * as path from 'path';
import { JwtModule } from '@nestjs/jwt';
import {
  I18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
} from 'nestjs-i18n';
import { BrandsModule } from './brands/brands.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        fallbackLanguage: configService.getOrThrow('FALLBACK_LANGUAGE'),

        loaderOptions: {
          path: path.join(__dirname, '/i18n/'),
          watch: true,
        },
      }),
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-lang']),
      ],
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        if (!uri) {
          throw new Error(
            ' MONGODB_URI is not defined in the environment variables',
          );
        }
        return {
          uri,
          dbName: 'driv',
        };
      },
      inject: [ConfigService],
    }),
    ServeStaticModule.forRootAsync({
      useFactory: () => {
        const uploadsFolder = process.env.UPLOADS_FOLDER || 'uploads';
        const uploadsPath = path.join(__dirname, '..', uploadsFolder);

        if (!path.isAbsolute(uploadsPath)) {
          console.warn(
            `⚠️ UPLOADS_FOLDER is not an absolute path: ${uploadsPath}`,
          );
        }

        return [
          {
            rootPath: uploadsPath,
            serveRoot: process.env.UPLOADS_ROUTE || '/uploads',
          },
        ];
      },
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt_Access_hToken_secret'),
      }),
      global: true,
      inject: [ConfigService],
    }),
    UsersModule,

    AuthModule,

    BrandsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

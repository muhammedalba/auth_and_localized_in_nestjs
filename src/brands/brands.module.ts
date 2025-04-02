import { Module } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Brand, BrandSchema } from './schemas/brand.schema';
import * as mongooseI18n from 'mongoose-i18n-localize';

@Module({
  imports: [
    FileUploadDiskStorageModule,
    MongooseModule.forFeatureAsync([
      {
        name: Brand.name,
        useFactory() {
          const schema = BrandSchema;
          schema.plugin(mongooseI18n, {
            locales: ['ar', 'en'],
            defaultLocale: 'ar',
            textCase: 'lowercase',
            autoPopulate: true,
            indexes: {
              name: 1,
              slug: 1,
            },
            timestamps: true,
          });
          return schema;
        },
      },
    ]),
  ],
  controllers: [BrandsController],
  providers: [BrandsService],
})
export class BrandsModule {}

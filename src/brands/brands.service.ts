import { Injectable } from '@nestjs/common';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { Brand } from './schemas/brand.schema';
import { Model } from 'mongoose';
import { I18nContext } from 'nestjs-i18n';

@Injectable()
export class BrandsService {
  constructor(
    @InjectModel(Brand.name) private brandModel: Model<Brand>,
    private readonly fileUploadService: FileUploadService,
  ) {}
  async create(createBrandDto: CreateBrandDto) {
    const brand = await this.brandModel.create(createBrandDto);
    return brand;
  }

  async findAll(): Promise<Brand[]> {
    const brands = await this.brandModel.find();
    const localize_brands =
      this.brandModel.schema.methods.toJSONLocalizedOnly(
        brands,
        I18nContext.current()?.lang,
      );
    return localize_brands;
  }

  findOne(id: number) {
    return `This action returns a #${id} brand`;
  }

  update(id: number, updateBrandDto: UpdateBrandDto) {
    return `This action updates a #${id} brand`;
  }

  remove(id: number) {
    return `This action removes a #${id} brand`;
  }
}

import { Controller, Get, Post, Body, Patch, Param, UseGuards, Delete, UploadedFile, UseInterceptors } from '@nestjs/common';
import { UniversitiesService } from './universities.service';
import { CreateUniversityDto, UpdateUniversityDto } from './university.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';

@Controller('universities')
export class UniversitiesController {
  constructor(private readonly universitiesService: UniversitiesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createUniversityDto: CreateUniversityDto) {
    return this.universitiesService.create(createUniversityDto);
  }

  // Public endpoint for registration to fetch list
  @Get()
  findAll() {
    return this.universitiesService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUniversityDto: UpdateUniversityDto) {
    return this.universitiesService.update(+id, updateUniversityDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = path.resolve(process.cwd(), 'user_profile_images', 'universities');
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch {}
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        const name = `uni_${Date.now()}${ext}`;
        cb(null, name);
      }
    })
  }))
  async uploadLogo(@Param('id') id: string, @UploadedFile() file: any) {
    const relPath = `/user_profile_images/universities/${file.filename}`;
    const updated = await this.universitiesService.update(+id, { logo_url: relPath } as any);
    return { success: true, logo_url: relPath, university: updated };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.universitiesService.remove(+id);
  }
}

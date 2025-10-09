import { Controller, Get, Post, Body, Patch, Param, UseGuards, Delete } from '@nestjs/common';
import { UniversitiesService } from './universities.service';
import { CreateUniversityDto, UpdateUniversityDto } from './university.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('universities')
@UseGuards(JwtAuthGuard)
export class UniversitiesController {
  constructor(private readonly universitiesService: UniversitiesService) {}

  @Post()
  create(@Body() createUniversityDto: CreateUniversityDto) {
    return this.universitiesService.create(createUniversityDto);
  }

  @Get()
  findAll() {
    return this.universitiesService.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUniversityDto: UpdateUniversityDto) {
    return this.universitiesService.update(+id, updateUniversityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.universitiesService.remove(+id);
  }
}

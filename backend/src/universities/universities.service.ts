import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { University } from '../database/entities';
import { CreateUniversityDto, UpdateUniversityDto } from './university.dto';

@Injectable()
export class UniversitiesService {
  constructor(
    @InjectRepository(University)
    private universitiesRepository: Repository<University>,
  ) {}

  create(createUniversityDto: CreateUniversityDto): Promise<University> {
    const university = this.universitiesRepository.create(createUniversityDto);
    return this.universitiesRepository.save(university);
  }

  findAll(): Promise<University[]> {
    return this.universitiesRepository.find();
  }

  async update(id: number, updateUniversityDto: UpdateUniversityDto): Promise<University> {
    const university = await this.universitiesRepository.preload({
      university_id: id,
      ...updateUniversityDto,
    });
    if (!university) {
      throw new NotFoundException(`University with ID ${id} not found`);
    }
    return this.universitiesRepository.save(university);
  }

  async remove(id: number): Promise<{ success: true }> {
    const uni = await this.universitiesRepository.findOne({ where: { university_id: id } });
    if (!uni) {
      throw new NotFoundException(`University with ID ${id} not found`);
    }
    try {
      await this.universitiesRepository.delete({ university_id: id });
    } catch (error) {
      // Likely a foreign key constraint error due to related courses/users/subjects
      throw new BadRequestException(
        'Unable to delete this university because it has related courses or subjects. Please remove them first or set the university status to Inactive.'
      );
    }
    return { success: true };
  }
}

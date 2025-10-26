import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, Admin, Tutor, Student } from '../database/entities';

async function updateUserTypes() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const userRepository = app.get(getRepositoryToken(User));
  const adminRepository = app.get(getRepositoryToken(Admin));
  const tutorRepository = app.get(getRepositoryToken(Tutor));
  const studentRepository = app.get(getRepositoryToken(Student));

  try {
    // Get all users without user_type set
    const users = await userRepository.find({
      where: { user_type: null },
      relations: ['admin_profile', 'tutor_profile', 'student_profile']
    });

    console.log(`Found ${users.length} users without user_type`);

    for (const user of users) {
      let userType: 'tutor' | 'tutee' | 'admin' | null = null;

      // Check if user has admin profile
      if (user.admin_profile) {
        userType = 'admin';
      }
      // Check if user has tutor profile
      else if (user.tutor_profile) {
        userType = 'tutor';
      }
      // Check if user has student profile
      else if (user.student_profile) {
        userType = 'tutee';
      }

      if (userType) {
        user.user_type = userType;
        await userRepository.save(user);
        console.log(`Updated user ${user.email} (ID: ${user.user_id}) to type: ${userType}`);
      } else {
        console.log(`Warning: User ${user.email} (ID: ${user.user_id}) has no profile - setting as tutee by default`);
        user.user_type = 'tutee';
        await userRepository.save(user);
      }
    }

    console.log('User type update completed successfully');
  } catch (error) {
    console.error('Error updating user types:', error);
  } finally {
    await app.close();
  }
}

// Run the script
updateUserTypes().catch(console.error);

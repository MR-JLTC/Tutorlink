export * from './notification';

export interface User {
  user_id: number;
  id?: number;
  name: string;
  email: string;
  role: 'tutor' | 'tutee' | 'admin' | 'student';
  user_type: 'tutor' | 'tutee' | 'admin' | 'student';
  university_id?: number;
  profile_image_url?: string | null;
}

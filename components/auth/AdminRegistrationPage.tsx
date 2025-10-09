import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { logoBase64 } from '../../assets/logo';
import { Eye, EyeOff } from 'lucide-react';
import apiClient from '../../services/api';
import { University } from '../../types';

const RegistrationPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState<number | ''>('');

  useEffect(() => {
    const loadUniversities = async () => {
      try {
        const res = await apiClient.get('/universities');
        setUniversities(res.data);
      } catch (e) {
        // ignore, handled by interceptor
      }
    };
    loadUniversities();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await register({ name, email, password, ...(universityId ? { university_id: Number(universityId) } : {}) });
      // The register function in AuthContext handles navigation on success
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred during registration.');
      setIsLoading(false);
    }
  };

  const inputStyles = "mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 focus:border-primary-600 bg-white text-slate-900 focus:bg-slate-50 transition-colors duration-200";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <img className="mx-auto h-24 w-auto" src={logoBase64} alt="TutorLink" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
            Create an admin account
          </h2>
        </div>
        <Card className="!p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputStyles}
                placeholder="John Doe"
              />
            </div>
            
            <div>
              <label htmlFor="university" className="block text-sm font-medium text-gray-700">
                University (for email validation)
              </label>
              <select
                id="university"
                name="university"
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value ? Number(e.target.value) : '')}
                className={inputStyles}
              >
                <option value="">Select a university (optional)</option>
                {universities.map((u) => (
                  <option key={u.university_id} value={u.university_id}>
                    {u.name} {((u as any).acronym ? `(${(u as any).acronym})` : '')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputStyles}
                placeholder="admin@tutorlink.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputStyles} pr-10`}
                  placeholder="********"
                />
                 <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputStyles} pr-10`}
                  placeholder="********"
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div>
              <Button type="submit" className="w-full justify-center" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create account'}
              </Button>
            </div>
          </form>
          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Sign in here
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
};

export default RegistrationPage;
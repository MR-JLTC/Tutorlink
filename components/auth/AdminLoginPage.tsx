import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { logoBase64 } from '../../assets/logo';
import { Eye, EyeOff } from 'lucide-react';
import ReactDOM from 'react-dom';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (password.length < 7 || password.length > 13) {
        setIsLoading(false);
        return;
      }
      await login(email, password);
      // The login function in AuthContext handles navigation on success
    } catch (err: any) {
      setIsLoading(false);
    }
  };

  const inputStyles = "mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-600 focus:border-primary-600 bg-white text-slate-900 focus:bg-slate-50 transition-colors duration-200";

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-sky-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-24 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] bg-gradient-to-r from-sky-300/10 to-indigo-300/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.035]" style={{backgroundImage:'radial-gradient(circle at 1px 1px, #0ea5e9 1px, transparent 0)', backgroundSize:'24px 24px'}} />
      </div>

      <div className="relative z-10 w-full max-w-6xl">
        {/* Unified card with slideshow + form */}
        <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">
            {/* Slideshow side */}
            <div className="relative hidden md:block">
              <div className="absolute inset-0">
                <AdminLoginSlideshow />
              </div>
              <div className="relative h-full w-full min-h-[420px] bg-gradient-to-tr from-sky-600/10 to-indigo-600/10" />
              {/* Removed redundant logo on left slideshow side */}
              <div className="absolute bottom-4 left-4 right-4 text-white drop-shadow-lg">
                <h2 className="text-xl font-bold">Admin Portal</h2>
                <p className="text-sm text-white/90">Manage users, courses, payments, and tutor applications</p>
              </div>
            </div>

            {/* Form side */}
            <Card className="!p-10 bg-white/85 border-0 rounded-none md:rounded-l-none">
              {/* Logo above form on right side */}
              <div className="mb-6 flex justify-center">
                <div className="inline-block bg-white border border-slate-200 rounded-xl shadow px-5 py-3">
                  <img className="h-14 w-auto" src={logoBase64} alt="TutorLink" />
                </div>
              </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
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

            <div className="pt-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputStyles} pr-10`}
                  minLength={7}
                  maxLength={13}
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            {/* Error toasts are shown globally via interceptor; no inline error here */}

            <div>
              <Button type="submit" className="w-full justify-center shadow-lg hover:shadow-xl" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>
          </form>
          <div className="mt-6 text-center text-sm text-gray-600">
            <span>Don't have an account? </span>
            <Link to="/register" className="font-medium text-primary-600 hover:text-primary-500 underline underline-offset-2">
              Register here
            </Link>
          </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

// Simple fading slideshow for admin-themed images
const AdminLoginSlideshow: React.FC = () => {
  const [index, setIndex] = React.useState(0);
  const slides = React.useMemo(() => [
    {
      src: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?q=80&w=2070&auto=format&fit=crop',
      alt: 'Admin reviewing dashboard analytics charts',
    },
    {
      src: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?q=80&w=2070&auto=format&fit=crop',
      alt: 'Team collaboration with laptops in modern office',
    },
    {
      src: 'https://images.unsplash.com/photo-1552581234-26160f608093?q=80&w=2070&auto=format&fit=crop',
      alt: 'Secure admin operations on computer',
    },
  ], []);

  React.useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 4000);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <div className="absolute inset-0">
      {slides.map((s, i) => (
        <img
          key={i}
          src={s.src}
          alt={s.alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === index ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent"></div>
    </div>
  );
};
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, UserCheck, School, BookOpen, CreditCard } from 'lucide-react';
import { logoBase64 } from '../../assets/logo';

const navLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'User Management' },
  { to: '/tutors', icon: UserCheck, label: 'Tutor Applications' },
  { to: '/universities', icon: School, label: 'Universities' },
  { to: '/courses', icon: BookOpen, label: 'Courses & Subjects' },
  { to: '/payments', icon: CreditCard, label: 'Payments' },
];

const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="h-20 flex items-center justify-center border-b border-slate-200">
        <img src={logoBase64} alt="TutorLink Logo" className="h-16 object-contain" />
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navLinks.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon className="mr-3 h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;

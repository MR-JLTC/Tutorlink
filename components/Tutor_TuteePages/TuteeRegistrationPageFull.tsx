import React from 'react';
import { useNavigate } from 'react-router-dom';
import TuteeRegistrationPage from './TuteeRegistrationPage';

/**
 * Full-page version of Tutee Registration for mobile devices
 * This component always renders as a full page (not a modal)
 */
const TuteeRegistrationPageFull: React.FC = () => {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/LandingPage');
  };

  // Render as full page by not passing isOpen prop
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-50/40 to-sky-50/40">
      <TuteeRegistrationPage isOpen={undefined} onClose={handleClose} />
    </div>
  );
};

export default TuteeRegistrationPageFull;


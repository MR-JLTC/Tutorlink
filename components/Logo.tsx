import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = '' }) => {
  const logoSrc = "assets/images/tutorlink-logo.png";
  // FIX: React functional components must return a ReactNode. This component was returning void, causing a type error.
  return <img src={logoSrc} alt="TutorLink Logo" className={className} />;
};

// FIX: The component was not exported, causing a module resolution error in LandingPage.tsx.
export default Logo;

import React from 'react';

const PesoSignIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M8 19V5h4a4 4 0 0 1 0 8h-4" />
    <path d="M8 13h4" />
    <path d="M6 13H4" />
    <path d="M6 9H4" />
  </svg>
);

export default PesoSignIcon;
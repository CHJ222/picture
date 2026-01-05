
import React from 'react';

interface CardProps {
  color?: 'white' | 'yellow' | 'blue' | 'green' | 'pink';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ 
  color = 'white', 
  children, 
  className = '', 
  onClick 
}) => {
  const colorMap = {
    white: 'bg-white',
    yellow: 'bg-[#FFF9E1]',
    blue: 'bg-[#E3F2FD]',
    green: 'bg-[#F1F8E9]',
    pink: 'bg-[#FCE4EC]',
  };

  return (
    <div
      onClick={onClick}
      className={`
        ${colorMap[color]} 
        rounded-[2.5rem] border-4 border-[#2D3436] 
        neubrutalism-shadow p-6 
        ${onClick ? 'cursor-pointer hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all bouncy' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default Card;

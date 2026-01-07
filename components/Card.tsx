
import React from 'react';

interface CardProps {
  color?: 'white' | 'yellow' | 'blue' | 'green' | 'pink' | 'bg';
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
    bg: 'bg-[#FFF9E1]',
  };

  return (
    <div
      onClick={onClick}
      className={`
        ${colorMap[color]} 
        rounded-[2rem] border-[3px] border-[#2D3436] 
        neubrutalism-shadow-sm p-4
        ${onClick ? 'cursor-pointer hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all bouncy' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default Card;

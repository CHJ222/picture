
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'white';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ 
  color = 'yellow', 
  size = 'md', 
  children, 
  className = '', 
  ...props 
}) => {
  const colorMap = {
    yellow: 'bg-[#FFD93D]',
    blue: 'bg-[#6EB5FF]',
    green: 'bg-[#9ADE7B]',
    pink: 'bg-[#FF8989]',
    purple: 'bg-[#C1A3FF]',
    white: 'bg-white',
  };

  const sizeMap = {
    sm: 'px-4 py-2 text-sm font-black',
    md: 'px-6 py-3 text-lg font-black',
    lg: 'px-8 py-4 text-2xl font-black',
    xl: 'px-12 py-6 text-3xl font-black',
  };

  return (
    <button
      className={`
        ${colorMap[color]} 
        ${sizeMap[size]} 
        rounded-2xl border-[3px] border-[#2D3436] 
        neubrutalism-shadow-sm
        flex items-center justify-center gap-3
        transition-all duration-75
        ${!props.disabled ? 'bouncy hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[4px] active:translate-y-[4px]' : 'opacity-50 grayscale cursor-not-allowed'}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;

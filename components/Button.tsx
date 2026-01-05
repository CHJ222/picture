
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
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
  };

  const sizeMap = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-lg font-bold',
    lg: 'px-8 py-4 text-2xl font-black',
    xl: 'px-12 py-6 text-4xl font-black',
  };

  return (
    <button
      className={`
        ${colorMap[color]} 
        ${sizeMap[size]} 
        rounded-3xl border-4 border-[#2D3436] 
        neubrutalism-shadow bouncy
        hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
        active:translate-x-[6px] active:translate-y-[6px] active:shadow-none
        transition-all duration-75
        flex items-center justify-center gap-3
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;

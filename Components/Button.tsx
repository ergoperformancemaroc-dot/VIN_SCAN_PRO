import React from 'react';

export const Button: React.FC<any> = ({ children, variant = 'primary', isLoading, className = '', ...props }) => {
  const base = "flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg";
  const variants: any = {
    primary: "bg-blue-600 text-white shadow-blue-200",
    danger: "bg-red-500 text-white shadow-red-100",
    outline: "border-2 border-slate-200 text-slate-700 bg-white"
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={isLoading} {...props}>
      {isLoading ? "Chargement..." : children}
    </button>
  );
};
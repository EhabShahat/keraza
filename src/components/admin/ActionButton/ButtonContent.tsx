import React, { ReactNode } from "react";

interface ButtonContentProps {
  loading: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export default function ButtonContent({ loading, icon, children }: ButtonContentProps) {
  if (loading) {
    return <div className="spinner w-4 h-4"></div>;
  }
  
  return (
    <>
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </>
  );
}
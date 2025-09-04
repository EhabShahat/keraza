"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavLinkProps } from './types';

export default function NavLink({ href, children, exact = false }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  
  return (
    <Link 
      href={href} 
      className={`
        inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
        ${isActive 
          ? "bg-blue-100 text-blue-700 shadow-sm" 
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        }
      `}
    >
      {children}
    </Link>
  );
}
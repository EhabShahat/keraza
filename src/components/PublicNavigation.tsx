"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";

export default function PublicNavigation() {
  const pathname = usePathname();
  const { locale } = useStudentLocale();

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 font-bold text-xl text-gray-900 hover:text-blue-600 transition-colors">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                E
              </div>
              <span className="hidden sm:block">{t(locale, 'exam_system')}</span>
            </Link>
            <nav className="hidden lg:flex items-center gap-1" aria-label="Public navigation">
              <NavLink href="/" exact>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {t(locale, 'home')}
              </NavLink>
              <NavLink href="/results">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {t(locale, 'results')}
              </NavLink>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children, exact = false }: { href: string; children: React.ReactNode; exact?: boolean }) {
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
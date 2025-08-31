import React from "react";
import PublicLocaleProvider from "@/components/public/PublicLocaleProvider";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicLocaleProvider>
      <div className="min-h-[100svh] bg-gray-50">
        <main id="main-content" tabIndex={-1} className="outline-none w-[95%] sm:w-[95%] md:w-[95%] lg:w-full mx-auto">
          {children}
        </main>
      </div>
    </PublicLocaleProvider>
  );
}
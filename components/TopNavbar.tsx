'use client';

import React from 'react';
import { Menu, X } from 'lucide-react';

export type AppSection = 'booking' | 'track' | 'admin' | 'php-kit';

interface TopNavbarProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  onBookNow: () => void;
  pendingCount?: number;
}

export default function TopNavbar({
  activeSection,
  onNavigate,
  onBookNow,
}: TopNavbarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const navItems: { id: AppSection; label: string }[] = [
    { id: 'booking', label: 'Estates & Rates' },
    { id: 'track', label: 'Track Booking' },
    { id: 'admin', label: 'Admin Console' },
    { id: 'php-kit', label: 'PHP cPanel Kit' },
  ];

  const handleNav = (id: AppSection) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <header className="no-print sticky top-0 z-40 border-b border-[#E4E4E0] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-8 px-4 sm:px-6">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleNav('booking');
          }}
          className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[#1B4332] whitespace-nowrap shrink-0"
        >
          Nightingale Tea
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7"
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b-2 ${
                  isActive
                    ? 'border-[#1B4332] text-[#141C17]'
                    : 'border-transparent text-[#556159] hover:text-[#141C17]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <a
            href="https://nightingaletea.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#556159] hover:text-[#141C17] transition-colors whitespace-nowrap shrink-0"
          >
            Main Site
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onBookNow}
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white hover:bg-[#143326] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Book a Stay
          </button>

          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex md:hidden items-center justify-center rounded-lg border border-[#E4E4E0] p-2 text-[#141C17] hover:bg-[#F2F4F0] cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[#E4E4E0] bg-white px-4 py-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`block w-full text-left rounded-md px-3 py-2 text-sm font-medium cursor-pointer ${
                activeSection === item.id
                  ? 'bg-[#F2F4F0] text-[#1B4332] font-semibold'
                  : 'text-[#556159] hover:bg-[#F2F4F0]'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onBookNow();
            }}
            className="mt-2 w-full rounded-lg bg-[#1B4332] px-4 py-2.5 text-sm font-semibold text-white cursor-pointer"
          >
            Book a Stay
          </button>
        </div>
      )}
    </header>
  );
}

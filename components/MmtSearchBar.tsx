'use client';

import React from 'react';
import { Calendar, ChevronDown, MapPin, Minus, Plus, Search, Users, Utensils } from 'lucide-react';
import { addDaysIso, type Estate, type MealPlan } from '@/lib/booking-engine';

export interface SearchCriteria {
  estateFilter: string; // 'ALL' or estate slug
  checkIn: string;
  checkOut: string;
  roomsCount: number;
  adults: number;
  children5to12: number;
  childrenUnder5: number;
  mealPlan: MealPlan;
}

interface MmtSearchBarProps {
  estates: Estate[];
  today: string;
  criteria: SearchCriteria;
  onChange: (next: SearchCriteria) => void;
  onSearch: () => void;
  searching?: boolean;
}

export default function MmtSearchBar({
  estates,
  today,
  criteria,
  onChange,
  onSearch,
  searching = false,
}: MmtSearchBarProps) {
  const [guestsOpen, setGuestsOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!guestsOpen) return;
    const handleOutside = (ev: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(ev.target as Node)) {
        setGuestsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [guestsOpen]);

  const nightsCount = React.useMemo(() => {
    const start = Date.parse(`${criteria.checkIn}T00:00:00Z`);
    const end = Date.parse(`${criteria.checkOut}T00:00:00Z`);
    if (Number.isNaN(start) || Number.isNaN(end)) return 1;
    return Math.max(1, Math.round((end - start) / 86400000));
  }, [criteria.checkIn, criteria.checkOut]);

  const totalGuests = criteria.adults + criteria.children5to12 + criteria.childrenUnder5;

  const updateField = <K extends keyof SearchCriteria>(key: K, value: SearchCriteria[K]) => {
    onChange({ ...criteria, [key]: value });
  };

  const handleCheckInChange = (nextCheckIn: string) => {
    const minOut = addDaysIso(nextCheckIn, 1);
    const nextCheckOut = criteria.checkOut <= nextCheckIn ? minOut : criteria.checkOut;
    onChange({ ...criteria, checkIn: nextCheckIn, checkOut: nextCheckOut });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGuestsOpen(false);
    onSearch();
  };

  return (
    <section
      aria-label="Estate and Room Search Engine"
      className="border-b border-[#E4E4E0] bg-[#1B4332]"
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/85">
          <span className="font-medium">
            Search live room inventory across Mateli, Jainti &amp; Chuapara Tea Estates
          </span>
          <span className="font-[family-name:var(--font-mono)] tabular-nums text-white/90">
            {nightsCount} Night{nightsCount > 1 ? 's' : ''} · {criteria.roomsCount} Room{criteria.roomsCount > 1 ? 's' : ''} · {totalGuests} Guest{totalGuests > 1 ? 's' : ''}
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-white border border-[#E4E4E0] shadow-sm p-2"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-2 lg:gap-0 lg:divide-x lg:divide-[#E4E4E0]">
            {/* 1. Estate / Location */}
            <div className="lg:col-span-3 px-3 py-2 flex flex-col justify-center">
              <label
                htmlFor="mmt-estate-select"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#556159]"
              >
                <MapPin className="h-3.5 w-3.5 text-[#1B4332]" />
                Tea Estate / Location
              </label>
              <select
                id="mmt-estate-select"
                value={criteria.estateFilter}
                onChange={(e) => updateField('estateFilter', e.target.value)}
                className="mt-1 w-full bg-transparent text-sm font-bold text-[#141C17] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Dooars Estates (3)</option>
                {estates.map((est) => (
                  <option key={est.id} value={est.slug}>
                    {est.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Check-in */}
            <div className="lg:col-span-2 px-3 py-2 flex flex-col justify-center">
              <label
                htmlFor="mmt-checkin"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#556159]"
              >
                <Calendar className="h-3.5 w-3.5 text-[#1B4332]" />
                Check-In
              </label>
              <input
                id="mmt-checkin"
                type="date"
                min={today}
                required
                value={criteria.checkIn}
                onChange={(e) => handleCheckInChange(e.target.value)}
                className="mt-1 w-full bg-transparent font-[family-name:var(--font-mono)] text-sm font-bold text-[#141C17] focus:outline-none tabular-nums"
              />
            </div>

            {/* 3. Check-out */}
            <div className="lg:col-span-2 px-3 py-2 flex flex-col justify-center">
              <label
                htmlFor="mmt-checkout"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#556159]"
              >
                <Calendar className="h-3.5 w-3.5 text-[#1B4332]" />
                Check-Out ({nightsCount}N)
              </label>
              <input
                id="mmt-checkout"
                type="date"
                min={addDaysIso(criteria.checkIn, 1)}
                required
                value={criteria.checkOut}
                onChange={(e) => updateField('checkOut', e.target.value)}
                className="mt-1 w-full bg-transparent font-[family-name:var(--font-mono)] text-sm font-bold text-[#141C17] focus:outline-none tabular-nums"
              />
            </div>

            {/* 4. Rooms & Guests Picker (MMT style popover) */}
            <div ref={popoverRef} className="lg:col-span-2 relative px-3 py-2 flex flex-col justify-center">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#556159]">
                <Users className="h-3.5 w-3.5 text-[#1B4332]" />
                Rooms &amp; Guests
              </span>
              <button
                type="button"
                aria-expanded={guestsOpen}
                aria-label="Configure rooms and guests"
                onClick={() => setGuestsOpen((prev) => !prev)}
                className="mt-1 flex w-full items-center justify-between text-left text-sm font-bold text-[#141C17] cursor-pointer whitespace-nowrap"
              >
                <span className="truncate font-[family-name:var(--font-mono)] tabular-nums">
                  {criteria.roomsCount}R · {criteria.adults}A
                  {criteria.children5to12 + criteria.childrenUnder5 > 0
                    ? ` · ${criteria.children5to12 + criteria.childrenUnder5}C`
                    : ''}
                </span>
                <ChevronDown className="h-4 w-4 text-[#556159] shrink-0" />
              </button>

              {guestsOpen && (
                <div className="absolute left-0 top-full mt-2 z-50 w-72 rounded-xl border border-[#E4E4E0] bg-white p-4 shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#141C17]">Rooms</div>
                      <div className="text-[11px] text-[#556159]">Multiple rooms supported</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Decrease rooms"
                        onClick={() =>
                          updateField('roomsCount', Math.max(1, criteria.roomsCount - 1))
                        }
                        className="h-7 w-7 rounded border border-[#E4E4E0] flex items-center justify-center hover:bg-[#F2F4F0] cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center font-[family-name:var(--font-mono)] text-sm font-bold tabular-nums">
                        {criteria.roomsCount}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase rooms"
                        onClick={() =>
                          updateField('roomsCount', Math.min(8, criteria.roomsCount + 1))
                        }
                        className="h-7 w-7 rounded border border-[#E4E4E0] flex items-center justify-center hover:bg-[#F2F4F0] cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#F2F4F0] pt-3">
                    <div>
                      <div className="text-xs font-bold text-[#141C17]">Adults (12+ yrs)</div>
                      <div className="text-[11px] text-[#556159]">2 included per room</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Decrease adults"
                        onClick={() => updateField('adults', Math.max(1, criteria.adults - 1))}
                        className="h-7 w-7 rounded border border-[#E4E4E0] flex items-center justify-center hover:bg-[#F2F4F0] cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center font-[family-name:var(--font-mono)] text-sm font-bold tabular-nums">
                        {criteria.adults}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase adults"
                        onClick={() => updateField('adults', Math.min(18, criteria.adults + 1))}
                        className="h-7 w-7 rounded border border-[#E4E4E0] flex items-center justify-center hover:bg-[#F2F4F0] cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#F2F4F0] pt-3">
                    <div>
                      <div className="text-xs font-bold text-[#141C17]">Children (5–12 yrs)</div>
                      <div className="text-[11px] text-[#556159]">Estate child tariff applies</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Decrease children 5 to 12"
                        onClick={() =>
                          updateField('children5to12', Math.max(0, criteria.children5to12 - 1))
                        }
                        className="h-7 w-7 rounded border border-[#E4E4E0] flex items-center justify-center hover:bg-[#F2F4F0] cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center font-[family-name:var(--font-mono)] text-sm font-bold tabular-nums">
                        {criteria.children5to12}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase children 5 to 12"
                        onClick={() =>
                          updateField('children5to12', Math.min(10, criteria.children5to12 + 1))
                        }
                        className="h-7 w-7 rounded border border-[#E4E4E0] flex items-center justify-center hover:bg-[#F2F4F0] cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#F2F4F0] pt-3">
                    <div>
                      <div className="text-xs font-bold text-[#141C17]">Kids (&lt;5 yrs)</div>
                      <div className="text-[11px] text-[#166534] font-medium">Complimentary stay</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Decrease kids under 5"
                        onClick={() =>
                          updateField('childrenUnder5', Math.max(0, criteria.childrenUnder5 - 1))
                        }
                        className="h-7 w-7 rounded border border-[#E4E4E0] flex items-center justify-center hover:bg-[#F2F4F0] cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center font-[family-name:var(--font-mono)] text-sm font-bold tabular-nums">
                        {criteria.childrenUnder5}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase kids under 5"
                        onClick={() =>
                          updateField('childrenUnder5', Math.min(10, criteria.childrenUnder5 + 1))
                        }
                        className="h-7 w-7 rounded border border-[#E4E4E0] flex items-center justify-center hover:bg-[#F2F4F0] cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGuestsOpen(false)}
                    className="w-full rounded-lg bg-[#1B4332] px-3 py-2 text-xs font-semibold text-white hover:bg-[#143326] cursor-pointer"
                  >
                    Apply Guest Selection
                  </button>
                </div>
              )}
            </div>

            {/* 5. Meal Plan */}
            <div className="lg:col-span-2 px-3 py-2 flex flex-col justify-center">
              <label
                htmlFor="mmt-meal-plan"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#556159]"
              >
                <Utensils className="h-3.5 w-3.5 text-[#1B4332]" />
                Meal Plan
              </label>
              <select
                id="mmt-meal-plan"
                value={criteria.mealPlan}
                onChange={(e) => updateField('mealPlan', e.target.value as MealPlan)}
                className="mt-1 w-full bg-transparent text-sm font-bold text-[#141C17] focus:outline-none cursor-pointer"
              >
                <option value="MAP">MAP (B&amp;D)</option>
                <option value="ALL_MEALS">All Meals (B/L/D)</option>
              </select>
            </div>

            {/* 6. Search CTA */}
            <div className="lg:col-span-1 flex items-stretch pl-0 lg:pl-2">
              <button
                type="submit"
                disabled={searching}
                className="w-full rounded-lg bg-[#1B4332] px-4 py-3 text-sm font-bold text-white hover:bg-[#143326] disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Search className="h-4 w-4" />
                <span>{searching ? '...' : 'Search'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

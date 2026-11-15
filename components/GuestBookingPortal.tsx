'use client';

import React from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { motion } from 'motion/react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  CreditCard,
  QrCode,
  ShieldCheck,
  Upload,
  Users,
  Utensils,
} from 'lucide-react';
import {
  addDaysIso,
  calculateBookingTariff,
  formatInr,
  formatIsoDateUtc,
  type Booking,
  type DailyAvailability,
  type Estate,
  type MealPlan,
  type PaymentMethod,
  type RoomCategory,
  type StaySearchSummary,
  type SystemSettings,
} from '@/lib/booking-engine';
import { DigitalReceiptCard } from './DigitalReceiptCard';
import MmtSearchBar, { type SearchCriteria } from './MmtSearchBar';

interface GuestBookingPortalProps {
  initialEstates: Estate[];
  initialCalendars: Record<string, DailyAvailability[]>;
  initialSearchSummaries: Record<string, StaySearchSummary>;
  initialSettings: SystemSettings;
  onBookingCreated?: () => void;
  bookingSectionRef?: React.RefObject<HTMLElement | null>;
}

export default function GuestBookingPortal({
  initialEstates,
  initialCalendars,
  initialSearchSummaries,
  initialSettings,
  onBookingCreated,
  bookingSectionRef,
}: GuestBookingPortalProps) {
  const today = React.useMemo(() => formatIsoDateUtc(new Date()), []);
  const defaultCheckIn = React.useMemo(() => addDaysIso(today, 1), [today]);
  const defaultCheckOut = React.useMemo(() => addDaysIso(today, 3), [today]);

  const [estates, setEstates] = React.useState<Estate[]>(initialEstates);
  const [calendars, setCalendars] =
    React.useState<Record<string, DailyAvailability[]>>(initialCalendars);
  const [searchSummaries, setSearchSummaries] =
    React.useState<Record<string, StaySearchSummary>>(initialSearchSummaries);
  const [settings, setSettings] = React.useState<SystemSettings>(initialSettings);

  const [selectedSlug, setSelectedSlug] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      const est = new URLSearchParams(window.location.search).get('estate');
      if (est && initialEstates.some((e) => e.slug === est)) return est;
    }
    return initialEstates[0]?.slug || 'mateli';
  });
  const [selectedRoomTypeByEstate, setSelectedRoomTypeByEstate] = React.useState<
    Record<string, string>
  >(() => {
    const map: Record<string, string> = {};
    for (const e of initialEstates) {
      const firstActive = e.roomCategories?.find((rc) => rc.isActive);
      if (firstActive) map[e.slug] = firstActive.id;
    }
    return map;
  });
  const [checkIn, setCheckIn] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      const ci = new URLSearchParams(window.location.search).get('checkin');
      if (ci && /^\d{4}-\d{2}-\d{2}$/.test(ci)) return ci;
    }
    return defaultCheckIn;
  });
  const [checkOut, setCheckOut] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      const co = new URLSearchParams(window.location.search).get('checkout');
      if (co && /^\d{4}-\d{2}-\d{2}$/.test(co)) return co;
    }
    return defaultCheckOut;
  });
  const [roomsCount, setRoomsCount] = React.useState<number>(1);
  const [adults, setAdults] = React.useState<number>(2);
  const [children5to12, setChildren5to12] = React.useState<number>(0);
  const [childrenUnder5, setChildrenUnder5] = React.useState<number>(0);
  const [mealPlan, setMealPlan] = React.useState<MealPlan>('MAP');
  const [estateFilter, setEstateFilter] = React.useState<string>('ALL');
  const [appliedSearch, setAppliedSearch] = React.useState<SearchCriteria>(() => ({
    estateFilter: 'ALL',
    checkIn: defaultCheckIn,
    checkOut: defaultCheckOut,
    roomsCount: 1,
    adults: 2,
    children5to12: 0,
    childrenUnder5: 0,
    mealPlan: 'MAP',
  }));
  const [searching, setSearching] = React.useState(false);
  const searchResultsRef = React.useRef<HTMLElement | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('MANUAL_UPI');
  const [sourceChannel] = React.useState<'PORTAL' | 'MAIN_SITE_LINK'>(() => {
    if (typeof window !== 'undefined') {
      if (new URLSearchParams(window.location.search).get('source') === 'main_site') {
        return 'MAIN_SITE_LINK';
      }
    }
    return 'PORTAL';
  });

  const [guestName, setGuestName] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const [guestCity, setGuestCity] = React.useState('');
  const [idProofType, setIdProofType] = React.useState('Aadhaar');
  const [specialRequests, setSpecialRequests] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Post-hold checkout state
  const [activeHold, setActiveHold] = React.useState<{
    booking: Booking;
    upiUri: string;
    qrDataUrl: string;
  } | null>(null);
  const [completedBooking, setCompletedBooking] = React.useState<Booking | null>(null);

  // Manual UPI payment verification submission
  const [utrInput, setUtrInput] = React.useState('');
  const [proofDataUrl, setProofDataUrl] = React.useState<string>('');
  const [proofFileName, setProofFileName] = React.useState<string>('');
  const [copiedVpa, setCopiedVpa] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState<number>(1800);

  // Razorpay simulation modal state
  const [rzpOpen, setRzpOpen] = React.useState(false);
  const [rzpChannel, setRzpChannel] = React.useState<'UPI' | 'CARD' | 'NETBANKING'>('UPI');
  const [verifyingPayment, setVerifyingPayment] = React.useState(false);

  const refreshAllCalendars = React.useCallback(
    async (searchCi = checkIn, searchCo = checkOut) => {
      try {
        const qs = new URLSearchParams({
          start: today,
          days: '21',
          checkIn: searchCi,
          checkOut: searchCo,
        });
        const res = await fetch(`/api/estates?${qs.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.estates) setEstates(data.estates);
        if (data.calendars) setCalendars(data.calendars);
        if (data.searchSummaries) setSearchSummaries(data.searchSummaries);
        if (data.settings) setSettings(data.settings);
      } catch {
        // ignore transient network errors
      }
    },
    [today, checkIn, checkOut]
  );

  // Countdown timer for active hold
  React.useEffect(() => {
    if (!activeHold?.booking.holdExpiresAt) return;
    const targetMs = new Date(activeHold.booking.holdExpiresAt).getTime();
    const tick = () => {
      const rem = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
      setSecondsLeft(rem);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeHold]);

  const selectedEstate =
    estates.find((e) => e.slug === selectedSlug) || estates[0];
  const activeRoomCategories = React.useMemo(
    () => (selectedEstate?.roomCategories || []).filter((rc) => rc.isActive),
    [selectedEstate]
  );
  const selectedRoomTypeId =
    selectedRoomTypeByEstate[selectedEstate?.slug || ''] ||
    activeRoomCategories[0]?.id ||
    '';
  const selectedRoomCategory: RoomCategory | undefined = activeRoomCategories.find(
    (rc) => rc.id === selectedRoomTypeId
  );

  const activeCalendar = React.useMemo(
    () => calendars[selectedEstate?.slug || 'mateli'] || [],
    [calendars, selectedEstate?.slug]
  );

  // Build local overrides map from calendar days for live client quote
  const tariffResult = React.useMemo(() => {
    if (!selectedEstate) return { tariff: null, error: 'No estate selected.' };
    try {
      const ovFromCal = activeCalendar.map((d) => ({
        id: `cal-${d.date}`,
        estateId: selectedEstate.id,
        date: d.date,
        isBlocked: d.isBlocked,
        mapRateOverride:
          d.effectiveMapRate !== selectedEstate.mapBaseRate
            ? d.effectiveMapRate
            : null,
        allMealsRateOverride:
          d.effectiveAllMealsRate !== selectedEstate.allMealsBaseRate
            ? d.effectiveAllMealsRate
            : null,
      }));
      const tariff = calculateBookingTariff({
        estate: selectedEstate,
        roomCategory: selectedRoomCategory,
        checkIn,
        checkOut,
        roomsCount,
        adults,
        children5to12,
        childrenUnder5,
        mealPlan,
        overrides: ovFromCal,
        gstPercentage: settings.gstPercentage,
      });
      return { tariff, error: null };
    } catch (err) {
      return {
        tariff: null,
        error: err instanceof Error ? err.message : 'Select valid dates.',
      };
    }
  }, [
    selectedEstate,
    selectedRoomCategory,
    activeCalendar,
    checkIn,
    checkOut,
    roomsCount,
    adults,
    children5to12,
    childrenUnder5,
    mealPlan,
    settings.gstPercentage,
  ]);

  const handleMmtSearch = async () => {
    setSearching(true);
    setAppliedSearch({
      estateFilter,
      checkIn,
      checkOut,
      roomsCount,
      adults,
      children5to12,
      childrenUnder5,
      mealPlan,
    });
    if (estateFilter !== 'ALL') {
      setSelectedSlug(estateFilter);
    }
    await refreshAllCalendars(checkIn, checkOut);
    setSearching(false);
    searchResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectEstateCard = (slug: string, roomCatId?: string) => {
    setSelectedSlug(slug);
    if (roomCatId) {
      setSelectedRoomTypeByEstate((prev) => ({ ...prev, [slug]: roomCatId }));
    }
    setActiveHold(null);
    setCompletedBooking(null);
    bookingSectionRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCalendarDayClick = (day: DailyAvailability) => {
    if (day.isBlocked || day.availableRooms < 1) return;
    if (!checkIn || day.date <= checkIn || checkOut > checkIn) {
      setCheckIn(day.date);
      setCheckOut(addDaysIso(day.date, Math.max(1, day.minStay)));
    } else {
      setCheckOut(day.date);
    }
  };

  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (tariffResult.error) {
      setFormError(tariffResult.error);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estateSlug: selectedEstate.slug,
          roomTypeId: selectedRoomCategory?.id,
          checkIn,
          checkOut,
          roomsCount,
          adults,
          children5to12,
          childrenUnder5,
          mealPlan,
          paymentMethod,
          guestName,
          guestPhone,
          guestEmail,
          guestCity,
          idProofType,
          specialRequests,
          sourceChannel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Could not complete reservation.');
        return;
      }

      const qrDataUrl = await QRCode.toDataURL(data.upiUri, {
        width: 220,
        margin: 1,
        color: { dark: '#141C17', light: '#FFFFFF' },
      });

      setActiveHold({
        booking: data.booking,
        upiUri: data.upiUri,
        qrDataUrl,
      });
      setCompletedBooking(null);
      setSubmitting(false);
      if (data.booking.paymentMethod === 'RAZORPAY') {
        setRzpOpen(true);
      }
      refreshAllCalendars();
      onBookingCreated?.();
    } catch {
      setFormError('Network error creating reservation. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setFormError('Payment screenshot must be under 4 MB.');
      return;
    }
    setProofFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHold) return;
    setFormError(null);
    setVerifyingPayment(true);
    try {
      const res = await fetch('/api/bookings/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_UPI',
          bookingRef: activeHold.booking.bookingRef,
          utr: utrInput,
          proofDataUrl: proofDataUrl || undefined,
          proofFileName: proofFileName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to submit UTR.');
        return;
      }
      setCompletedBooking(data.booking);
      setActiveHold(null);
      setUtrInput('');
      setProofDataUrl('');
      setProofFileName('');
      await refreshAllCalendars();
      onBookingCreated?.();
    } catch {
      setFormError('Network error submitting payment reference.');
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleRazorpayConfirm = async () => {
    if (!activeHold) return;
    setVerifyingPayment(true);
    setFormError(null);
    try {
      const res = await fetch('/api/bookings/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VERIFY_RAZORPAY',
          bookingRef: activeHold.booking.bookingRef,
          razorpayOrderId: activeHold.booking.razorpayOrderId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Razorpay verification failed.');
        return;
      }
      setRzpOpen(false);
      setCompletedBooking(data.booking);
      setActiveHold(null);
      await refreshAllCalendars();
      onBookingCreated?.();
    } catch {
      setFormError('Unable to verify Razorpay transaction.');
    } finally {
      setVerifyingPayment(false);
    }
  };

  const minsLeft = Math.floor(secondsLeft / 60);
  const secsRem = secondsLeft % 60;

  const filteredEstates =
    appliedSearch.estateFilter === 'ALL'
      ? estates
      : estates.filter((e) => e.slug === appliedSearch.estateFilter);

  return (
    <div id="top" className="space-y-14 pb-16">
      {/* Upper MMT-Style Search Engine */}
      <MmtSearchBar
        estates={estates}
        today={today}
        criteria={{
          estateFilter,
          checkIn,
          checkOut,
          roomsCount,
          adults,
          children5to12,
          childrenUnder5,
          mealPlan,
        }}
        onChange={(next) => {
          setEstateFilter(next.estateFilter);
          setCheckIn(next.checkIn);
          setCheckOut(next.checkOut);
          setRoomsCount(next.roomsCount);
          setAdults(next.adults);
          setChildren5to12(next.children5to12);
          setChildrenUnder5(next.childrenUnder5);
          setMealPlan(next.mealPlan);
        }}
        onSearch={handleMmtSearch}
        searching={searching}
      />

      {/* Hero Split */}
      <section className="border-b border-[#E4E4E0] bg-white">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="lg:col-span-6 flex flex-col justify-center"
            >
              <p className="text-xs font-semibold tracking-wide text-[#556159]">
                Nightingale Tea Tourism · Dooars, West Bengal
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.06] text-[#141C17] text-balance">
                Colonial tea estate stays, reserved with live room availability.
              </h1>
              <p className="mt-4 text-base text-[#556159] max-w-xl leading-relaxed">
                Book heritage bungalows and executive plantation cottages across Mateli, Jainti, and Chuapara Tea Estates with transparent MAP &amp; All Meals tariffs, instant Razorpay checkout, or zero-fee direct UPI transfer.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    bookingSectionRef?.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }
                  className="inline-flex items-center justify-center rounded-lg bg-[#1B4332] px-6 py-3 text-sm font-semibold text-white hover:bg-[#143326] transition-colors cursor-pointer"
                >
                  Check Dates &amp; Reserve
                </button>
                <a
                  href="#estates-showcase"
                  className="inline-flex items-center justify-center rounded-lg border border-[#E4E4E0] bg-white px-5 py-3 text-sm font-semibold text-[#141C17] hover:bg-[#F2F4F0] transition-colors"
                >
                  Compare Estate Tariffs
                </a>
              </div>
            </motion.div>

            <div className="lg:col-span-6 relative min-h-[280px] sm:min-h-[360px] rounded-xl overflow-hidden border border-[#E4E4E0]">
              <Image
                src="/images/hero_tea_estate.jpg"
                alt="Nightingale Tea Heritage Planter Bungalow in the Dooars"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                referrerPolicy="no-referrer"
                className="object-cover"
              />
            </div>
          </div>

          {/* 4-column operational strip */}
          <div className="mt-10 pt-8 border-t border-[#E4E4E0] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-xs font-semibold text-[#556159]">01. Three Dooars Estates</div>
              <div className="mt-1 text-sm font-semibold text-[#141C17]">
                Mateli · Jainti · Chuapara
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#556159]">02. Official Meal Plans</div>
              <div className="mt-1 text-sm font-semibold text-[#141C17]">
                MAP (B&amp;D) · All Meals · Kids &lt;5 Free
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#556159]">03. Dual Settlement</div>
              <div className="mt-1 text-sm font-semibold text-[#141C17]">
                Razorpay Instant · 0% Fee UPI QR
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#556159]">04. Concurrency Safe</div>
              <div className="mt-1 text-sm font-semibold text-[#141C17]">
                Real-Time Locks &amp; Digital Receipts
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Estate Search Results & Multi-Room Inventory Showcase */}
      <section
        ref={searchResultsRef as React.RefObject<HTMLElement>}
        id="estates-showcase"
        className="mx-auto max-w-[1200px] px-4 sm:px-6 scroll-mt-20"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#556159]">
              Live Estate &amp; Room Availability · {appliedSearch.checkIn} to {appliedSearch.checkOut}
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold text-[#141C17]">
              {appliedSearch.estateFilter === 'ALL'
                ? 'Our Tea Estate Retreats & Room Categories'
                : `${filteredEstates[0]?.name || 'Estate'} · Available Rooms`}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#556159]">
            <span>
              Showing {appliedSearch.roomsCount} room(s) ·{' '}
              {appliedSearch.mealPlan === 'ALL_MEALS' ? 'All Meals' : 'MAP (B&D)'} · Kids &lt;5 free
            </span>
            {appliedSearch.estateFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setEstateFilter('ALL');
                  setAppliedSearch((prev) => ({ ...prev, estateFilter: 'ALL' }));
                }}
                className="rounded-lg border border-[#E4E4E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#1B4332] hover:bg-[#F2F4F0] cursor-pointer"
              >
                Show All 3 Estates
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {filteredEstates.map((estate) => {
            const summary = searchSummaries[estate.slug];
            const cal = calendars[estate.slug] || [];
            const totalUnitsCount =
              summary?.maxTotalRooms ??
              (estate.roomCategories?.filter((r) => r.isActive).reduce((s, r) => s + r.totalUnits, 0) ||
                estate.totalRooms);
            const openForSearch = summary?.minAvailableRooms ?? cal[0]?.availableRooms ?? totalUnitsCount;
            const isSelected = selectedEstate?.slug === estate.slug;
            const pickedCatId =
              selectedRoomTypeByEstate[estate.slug] ||
              estate.roomCategories?.find((rc) => rc.isActive)?.id;
            const activeCats = (estate.roomCategories || []).filter((rc) => rc.isActive);
            const pickedCat =
              activeCats.find((rc) => rc.id === pickedCatId) || activeCats[0];
            const estNightRate = pickedCat
              ? appliedSearch.mealPlan === 'ALL_MEALS'
                ? pickedCat.allMealsRate
                : pickedCat.mapRate
              : appliedSearch.mealPlan === 'ALL_MEALS'
                ? estate.allMealsBaseRate
                : estate.mapBaseRate;
            const hasEnoughRooms = !summary?.isBlocked && openForSearch >= appliedSearch.roomsCount;

            return (
              <article
                key={estate.id}
                className={`rounded-xl border bg-white overflow-hidden flex flex-col transition-colors ${
                  isSelected ? 'border-[#1B4332] ring-1 ring-[#1B4332]' : 'border-[#E4E4E0]'
                }`}
              >
                <div className="relative h-48 w-full bg-[#F2F4F0]">
                  <Image
                    src={estate.imageUrl}
                    alt={estate.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    referrerPolicy="no-referrer"
                    className="object-cover"
                  />
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="text-xs text-[#556159] flex flex-wrap items-center gap-1.5">
                    <span>{estate.distanceFromAirport}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{totalUnitsCount} Total Rooms</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        hasEnoughRooms ? 'text-[#166534]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {summary?.isBlocked
                        ? 'Blocked for dates'
                        : `${openForSearch} open for stay`}
                    </span>
                  </div>

                  <h3 className="mt-1.5 font-[family-name:var(--font-display)] text-2xl font-bold text-[#141C17]">
                    {estate.name}
                  </h3>
                  <p className="text-xs font-medium text-[#556159]">{estate.subtitle}</p>

                  {/* Multiple Room Categories Selector */}
                  {activeCats.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-[11px] font-semibold text-[#556159]">
                        Choose Room Category ({activeCats.length} types)
                      </div>
                      <div className="space-y-1.5">
                        {activeCats.map((rc) => {
                          const catAvail = summary?.categoryAvailability.find(
                            (ca) => ca.roomCategory.id === rc.id
                          );
                          const openUnits = catAvail?.availableUnits ?? rc.totalUnits;
                          const isCatPicked = pickedCat?.id === rc.id;
                          const rate =
                            appliedSearch.mealPlan === 'ALL_MEALS'
                              ? rc.allMealsRate
                              : rc.mapRate;

                          return (
                            <button
                              key={rc.id}
                              type="button"
                              onClick={() => {
                                setSelectedSlug(estate.slug);
                                setSelectedRoomTypeByEstate((prev) => ({
                                  ...prev,
                                  [estate.slug]: rc.id,
                                }));
                              }}
                              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                                isCatPicked
                                  ? 'border-[#1B4332] bg-[#F2F4F0]'
                                  : 'border-[#E4E4E0] bg-white hover:bg-[#FAFAF8]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-[#141C17] truncate">
                                  {rc.name}
                                </span>
                                <span className="font-[family-name:var(--font-mono)] text-xs font-semibold text-[#1B4332] shrink-0 tabular-nums">
                                  {formatInr(rate)}/N
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#556159]">
                                <span className="truncate">{rc.bedType}</span>
                                <span
                                  className={`shrink-0 font-semibold tabular-nums ${
                                    openUnits >= appliedSearch.roomsCount
                                      ? 'text-[#166534]'
                                      : 'text-[#B45309]'
                                  }`}
                                >
                                  {openUnits}/{rc.totalUnits} open
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 border-t border-b border-[#E4E4E0] py-2.5 space-y-1 text-xs tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-[#556159]">Selected Room Nightly Rate</span>
                      <span className="font-[family-name:var(--font-mono)] font-semibold text-[#141C17]">
                        {formatInr(estNightRate)} / room
                      </span>
                    </div>
                    <div className="flex justify-between text-[#556159]">
                      <span>Extra Adult (MAP / All)</span>
                      <span className="font-[family-name:var(--font-mono)]">
                        {formatInr(estate.extraAdultMapRate)} / {formatInr(estate.extraAdultAllMealsRate)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#556159]">
                      <span>Child 5–12 Yrs (MAP / All)</span>
                      <span className="font-[family-name:var(--font-mono)]">
                        {formatInr(estate.child5to12MapRate)} / {formatInr(estate.child5to12AllMealsRate)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-[#556159] leading-relaxed">
                    <strong className="text-[#141C17]">Nearby:</strong>{' '}
                    {estate.nearbyAttractions.join(' · ')}
                  </p>

                  <div className="mt-auto pt-4">
                    <button
                      type="button"
                      onClick={() => handleSelectEstateCard(estate.slug, pickedCat?.id)}
                      className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#1B4332] text-white'
                          : 'border border-[#E4E4E0] bg-white text-[#141C17] hover:bg-[#F2F4F0]'
                      }`}
                    >
                      {isSelected
                        ? `Book ${pickedCat?.name || estate.name}`
                        : `Select & Book ${estate.name}`}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Interactive Booking & Payment Engine */}
      <section
        ref={bookingSectionRef as React.RefObject<HTMLElement>}
        id="reserve-workspace"
        className="mx-auto max-w-[1200px] px-4 sm:px-6 scroll-mt-20"
      >
        {completedBooking ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4 flex items-center gap-3 text-sm text-[#166534]">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <strong>
                  {completedBooking.status === 'CONFIRMED'
                    ? 'Reservation Confirmed!'
                    : 'Payment Proof Submitted — Rooms Held!'}
                </strong>{' '}
                Your Reference ID is{' '}
                <span className="font-[family-name:var(--font-mono)] font-bold">
                  {completedBooking.bookingRef}
                </span>
                .
              </div>
            </div>
            <DigitalReceiptCard
              booking={completedBooking}
              estate={estates.find((e) => e.id === completedBooking.estateId)}
              settings={settings}
              onBookAnother={() => {
                setCompletedBooking(null);
                setActiveHold(null);
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 7 columns: Calendar + Reservation Form */}
            <div className="lg:col-span-7 space-y-6">
              {/* Interactive Availability Calendar */}
              <div className="rounded-xl border border-[#E4E4E0] bg-white p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#141C17]">
                      14-Day Live Availability · {selectedEstate?.name}
                    </h2>
                    <p className="text-xs text-[#556159]">
                      Click an open date to set Check-in, or click a later date to adjust Check-out.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[#556159] whitespace-nowrap">
                    {selectedEstate?.totalRooms} total units
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {activeCalendar.slice(0, 14).map((day) => {
                    const isInStay = day.date >= checkIn && day.date < checkOut;
                    const isCheckIn = day.date === checkIn;
                    const isUnavailable = day.isBlocked || day.availableRooms === 0;
                    const dtLabel = new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      timeZone: 'UTC',
                    });

                    return (
                      <button
                        key={day.date}
                        type="button"
                        disabled={isUnavailable}
                        onClick={() => handleCalendarDayClick(day)}
                        className={`rounded-lg border p-2.5 text-left transition-colors ${
                          isUnavailable
                            ? 'border-[#E4E4E0] bg-[#F8F5F2] text-[#9CA3AF] cursor-not-allowed'
                            : isCheckIn || isInStay
                              ? 'border-[#1B4332] bg-[#1B4332] text-white cursor-pointer'
                              : 'border-[#E4E4E0] bg-white hover:border-[#1B4332] cursor-pointer'
                        }`}
                      >
                        <div className="text-[11px] font-medium opacity-80">{dtLabel}</div>
                        <div className="mt-1 text-xs font-semibold">
                          {day.isBlocked
                            ? 'Blocked'
                            : day.availableRooms === 0
                              ? 'Full'
                              : `${day.availableRooms} open`}
                        </div>
                        <div className="mt-0.5 font-[family-name:var(--font-mono)] text-[11px] tabular-nums opacity-90">
                          {formatInr(
                            mealPlan === 'MAP'
                              ? day.effectiveMapRate
                              : day.effectiveAllMealsRate
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Guest Reservation Form */}
              <form
                onSubmit={handleReserveSubmit}
                className="rounded-xl border border-[#E4E4E0] bg-white p-6 space-y-6"
              >
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#141C17]">
                    Guest &amp; Stay Details
                  </h2>
                  <p className="text-xs text-[#556159]">
                    Room inventory is locked atomically once you proceed to payment.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="res-estate" className="block text-xs font-semibold text-[#556159] mb-1.5">
                      Tea Estate
                    </label>
                    <select
                      id="res-estate"
                      value={selectedSlug}
                      onChange={(e) => setSelectedSlug(e.target.value)}
                      className="w-full rounded-lg border border-[#E4E4E0] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                    >
                      {estates.map((e) => (
                        <option key={e.id} value={e.slug}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="res-room-category" className="block text-xs font-semibold text-[#556159] mb-1.5">
                      Room Category / Unit Type
                    </label>
                    <select
                      id="res-room-category"
                      value={selectedRoomCategory?.id || ''}
                      onChange={(e) =>
                        setSelectedRoomTypeByEstate((prev) => ({
                          ...prev,
                          [selectedEstate.slug]: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-[#E4E4E0] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                    >
                      {activeRoomCategories.map((rc) => {
                        const avail = searchSummaries[selectedEstate.slug]?.categoryAvailability.find(
                          (ca) => ca.roomCategory.id === rc.id
                        );
                        const openCount = avail?.availableUnits ?? rc.totalUnits;
                        return (
                          <option key={rc.id} value={rc.id}>
                            {rc.name} ({openCount}/{rc.totalUnits} open)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="res-checkin" className="block text-xs font-semibold text-[#556159] mb-1.5">
                      Check-in Date
                    </label>
                    <input
                      id="res-checkin"
                      type="date"
                      min={today}
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      required
                      className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2.5 text-sm font-[family-name:var(--font-mono)] focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                    />
                  </div>
                  <div>
                    <label htmlFor="res-checkout" className="block text-xs font-semibold text-[#556159] mb-1.5">
                      Check-out Date
                    </label>
                    <input
                      id="res-checkout"
                      type="date"
                      min={addDaysIso(checkIn, 1)}
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      required
                      className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2.5 text-sm font-[family-name:var(--font-mono)] focus:outline-none focus:ring-2 focus:ring-[#1B4332]"
                    />
                  </div>
                </div>

                {/* Occupancy & Meal Plan */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="res-rooms" className="block text-xs font-semibold text-[#556159] mb-1.5">
                      Rooms
                    </label>
                    <input
                      id="res-rooms"
                      type="number"
                      min={1}
                      max={selectedRoomCategory?.totalUnits || selectedEstate?.totalRooms || 8}
                      value={roomsCount}
                      onChange={(e) => setRoomsCount(Math.max(1, Number(e.target.value)))}
                      className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="res-adults" className="block text-xs font-semibold text-[#556159] mb-1.5">
                      Adults (12+ yrs)
                    </label>
                    <input
                      id="res-adults"
                      type="number"
                      min={1}
                      max={15}
                      value={adults}
                      onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))}
                      className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="res-c5" className="block text-xs font-semibold text-[#556159] mb-1.5">
                      Children (5–12)
                    </label>
                    <input
                      id="res-c5"
                      type="number"
                      min={0}
                      max={10}
                      value={children5to12}
                      onChange={(e) => setChildren5to12(Math.max(0, Number(e.target.value)))}
                      className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="res-cu5" className="block text-xs font-semibold text-[#556159] mb-1.5">
                      Kids (&lt;5 Free)
                    </label>
                    <input
                      id="res-cu5"
                      type="number"
                      min={0}
                      max={10}
                      value={childrenUnder5}
                      onChange={(e) => setChildrenUnder5(Math.max(0, Number(e.target.value)))}
                      className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2 text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-[#556159] mb-2">
                    Select Meal Plan
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setMealPlan('MAP')}
                      className={`rounded-lg border p-3.5 text-left transition-colors cursor-pointer ${
                        mealPlan === 'MAP'
                          ? 'border-[#1B4332] bg-[#F2F4F0]'
                          : 'border-[#E4E4E0] bg-white hover:bg-[#FAFAF8]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#141C17]">
                          MAP Plan (Breakfast &amp; Dinner)
                        </span>
                        <Utensils className="h-4 w-4 text-[#1B4332]" />
                      </div>
                      <div className="mt-1 font-[family-name:var(--font-mono)] text-xs text-[#556159]">
                        {formatInr(selectedEstate?.mapBaseRate || 10000)} / night (Double Occupancy)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMealPlan('ALL_MEALS')}
                      className={`rounded-lg border p-3.5 text-left transition-colors cursor-pointer ${
                        mealPlan === 'ALL_MEALS'
                          ? 'border-[#1B4332] bg-[#F2F4F0]'
                          : 'border-[#E4E4E0] bg-white hover:bg-[#FAFAF8]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#141C17]">
                          All Meals Plan (B / L / D)
                        </span>
                        <Utensils className="h-4 w-4 text-[#1B4332]" />
                      </div>
                      <div className="mt-1 font-[family-name:var(--font-mono)] text-xs text-[#556159]">
                        {formatInr(selectedEstate?.allMealsBaseRate || 12000)} / night (Double Occupancy)
                      </div>
                    </button>
                  </div>
                </div>

                {/* Primary Visitor Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E4E4E0]">
                  <div>
                    <label htmlFor="guest-name" className="block text-xs font-semibold text-[#556159] mb-1.5">
                      Primary Visitor Full Name
                    </label>
                    <input
                      id="guest-name"
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Siddhartha Roy"
                      className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="guest-phone" className="block text-xs font-semibold text-[#556159] mb-1.5">
                      Phone / WhatsApp Number
                    </label>
                    <input
                      id="guest-phone"
                      type="tel"
                      required
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="9830012345"
                      className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2.5 text-sm font-[family-name:var(--font-mono)]"
                    />
                  </div>
                  <div>
                    <label htmlFor="guest-email" className="block text-xs font-semibold text-[#556159] mb-1.5">
                      Email Address
                    </label>
                    <input
                      id="guest-email"
                      type="email"
                      required
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="guest@example.com"
                      className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="guest-city" className="block text-xs font-semibold text-[#556159] mb-1.5">
                        City
                      </label>
                      <input
                        id="guest-city"
                        type="text"
                        value={guestCity}
                        onChange={(e) => setGuestCity(e.target.value)}
                        placeholder="Kolkata"
                        className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="guest-idtype" className="block text-xs font-semibold text-[#556159] mb-1.5">
                        ID Type
                      </label>
                      <select
                        id="guest-idtype"
                        value={idProofType}
                        onChange={(e) => setIdProofType(e.target.value)}
                        className="w-full rounded-lg border border-[#E4E4E0] bg-white px-2.5 py-2.5 text-sm"
                      >
                        <option value="Aadhaar">Aadhaar</option>
                        <option value="Passport">Passport</option>
                        <option value="Driving License">Driving License</option>
                        <option value="Voter ID">Voter ID</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="guest-requests" className="block text-xs font-semibold text-[#556159] mb-1.5">
                    Special Requests (Optional)
                  </label>
                  <textarea
                    id="guest-requests"
                    rows={2}
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="Bagdogra pickup request, dietary preferences, tea factory tour timing..."
                    className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2 text-sm"
                  />
                </div>

                {/* Dual Payment Settlement Selector */}
                <div className="pt-2 border-t border-[#E4E4E0]">
                  <span className="block text-xs font-semibold text-[#556159] mb-2">
                    Choose Settlement Method
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('RAZORPAY')}
                      disabled={!settings.razorpayEnabled}
                      className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                        paymentMethod === 'RAZORPAY'
                          ? 'border-[#1B4332] bg-[#F2F4F0]'
                          : 'border-[#E4E4E0] bg-white hover:bg-[#FAFAF8]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#141C17]">
                          Razorpay Gateway
                        </span>
                        <CreditCard className="h-4 w-4 text-[#1B4332]" />
                      </div>
                      <p className="mt-1 text-xs text-[#556159]">
                        Cards, NetBanking, UPI Apps, Wallets · Real-time webhook auto-confirmation.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('MANUAL_UPI')}
                      disabled={!settings.manualUpiEnabled}
                      className={`rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                        paymentMethod === 'MANUAL_UPI'
                          ? 'border-[#1B4332] bg-[#F2F4F0]'
                          : 'border-[#E4E4E0] bg-white hover:bg-[#FAFAF8]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#141C17]">
                          Manual UPI / QR (0% Fee)
                        </span>
                        <QrCode className="h-4 w-4 text-[#1B4332]" />
                      </div>
                      <p className="mt-1 text-xs text-[#556159]">
                        Scan QR or transfer via UPI ID · 30-min inventory hold until UTR verification.
                      </p>
                    </button>
                  </div>
                </div>

                {formError && (
                  <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || Boolean(tariffResult.error)}
                  className="w-full rounded-lg bg-[#1B4332] px-5 py-3 text-sm font-semibold text-white hover:bg-[#143326] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {submitting
                    ? 'Locking Room Inventory...'
                    : paymentMethod === 'RAZORPAY'
                      ? 'Lock Stay & Pay via Razorpay'
                      : 'Lock Stay & Generate UPI QR'}
                </button>
              </form>
            </div>

            {/* Right 5 columns: Sticky Live Tariff Breakdown & Active Payment Panel */}
            <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
              <div className="rounded-xl border border-[#E4E4E0] bg-white p-6">
                <div className="flex items-center justify-between border-b border-[#E4E4E0] pb-4">
                  <div>
                    <div className="text-xs text-[#556159]">
                      Live Tariff · {selectedRoomCategory?.name || selectedEstate?.accommodationType}
                    </div>
                    <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#141C17]">
                      {selectedEstate?.name}
                    </h3>
                  </div>
                  <Calendar className="h-5 w-5 text-[#1B4332]" />
                </div>

                {tariffResult.error || !tariffResult.tariff ? (
                  <p className="mt-4 text-sm text-[#B91C1C]">
                    {tariffResult.error || 'Select valid dates to calculate tariff.'}
                  </p>
                ) : (
                  <div className="mt-4 space-y-3 text-sm tabular-nums">
                    <div className="flex items-center justify-between text-xs text-[#556159]">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {roomsCount} Room(s) · {adults} Adults · {children5to12} Child (5–12) ·{' '}
                        {childrenUnder5} Kids (&lt;5)
                      </span>
                      <span className="font-[family-name:var(--font-mono)]">
                        {tariffResult.tariff.nights} Night(s)
                      </span>
                    </div>

                    <div className="space-y-2 border-t border-[#F2F4F0] pt-3">
                      <div className="flex justify-between">
                        <span className="text-[#556159]">
                          Base Stay ({tariffResult.tariff.nights}N × {roomsCount}R ·{' '}
                          {mealPlan === 'ALL_MEALS' ? 'All Meals' : 'MAP'})
                        </span>
                        <span className="font-[family-name:var(--font-mono)] font-medium">
                          {formatInr(tariffResult.tariff.baseRoomTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#556159]">
                          Extra Adults ({tariffResult.tariff.extraAdults} above double occupancy)
                        </span>
                        <span className="font-[family-name:var(--font-mono)] font-medium">
                          {formatInr(tariffResult.tariff.extraAdultTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#556159]">
                          Children 5–12 Yrs ({children5to12})
                        </span>
                        <span className="font-[family-name:var(--font-mono)] font-medium">
                          {formatInr(tariffResult.tariff.childTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#556159]">
                        <span>Children Below 5 Yrs ({childrenUnder5})</span>
                        <span>Complimentary</span>
                      </div>
                      {tariffResult.tariff.gstAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#556159]">
                            GST ({tariffResult.tariff.gstPercentage}%)
                          </span>
                          <span className="font-[family-name:var(--font-mono)] font-medium">
                            {formatInr(tariffResult.tariff.gstAmount)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#E4E4E0] pt-3 flex items-baseline justify-between">
                      <span className="text-base font-bold text-[#141C17]">Total Payable</span>
                      <span className="font-[family-name:var(--font-mono)] text-2xl font-bold text-[#1B4332]">
                        {formatInr(tariffResult.tariff.totalAmount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Active Payment Settlement Box (shown after hold creation) */}
              {activeHold && (
                <div className="rounded-xl border border-[#1B4332] bg-white p-6 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[#1B4332]">
                        Inventory Held · Ref{' '}
                        <span className="font-[family-name:var(--font-mono)]">
                          {activeHold.booking.bookingRef}
                        </span>
                      </p>
                      <h3 className="mt-0.5 font-[family-name:var(--font-display)] text-2xl font-bold text-[#141C17]">
                        {activeHold.booking.paymentMethod === 'MANUAL_UPI'
                          ? 'Scan & Pay via UPI'
                          : 'Complete Razorpay Payment'}
                      </h3>
                    </div>
                    <div className="inline-flex items-center gap-1 text-xs font-[family-name:var(--font-mono)] font-semibold text-[#B45309] shrink-0">
                      <Clock className="h-3.5 w-3.5" />
                      {String(minsLeft).padStart(2, '0')}:{String(secsRem).padStart(2, '0')}
                    </div>
                  </div>

                  {activeHold.booking.paymentMethod === 'MANUAL_UPI' ? (
                    <form onSubmit={handleUpiSubmit} className="space-y-4">
                      <div className="flex flex-col sm:flex-row items-center gap-4 rounded-lg bg-[#FAFAF8] border border-[#E4E4E0] p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeHold.qrDataUrl}
                          alt="Nightingale Tea Tourism UPI Payment QR Code"
                          className="h-36 w-36 rounded border border-[#E4E4E0] bg-white p-1 shrink-0"
                        />
                        <div className="space-y-2 text-xs">
                          <div className="text-[#556159]">Pay exact amount (0% gateway fee):</div>
                          <div className="font-[family-name:var(--font-mono)] text-xl font-bold text-[#1B4332]">
                            {formatInr(activeHold.booking.totalAmount)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-[family-name:var(--font-mono)] font-semibold text-[#141C17]">
                              {settings.upiId}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(settings.upiId);
                                setCopiedVpa(true);
                                setTimeout(() => setCopiedVpa(false), 1800);
                              }}
                              className="inline-flex items-center gap-1 rounded border border-[#E4E4E0] bg-white px-2 py-1 text-[11px] font-medium hover:bg-[#F2F4F0] cursor-pointer"
                            >
                              {copiedVpa ? (
                                <Check className="h-3 w-3 text-[#166534]" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              {copiedVpa ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <a
                            href={activeHold.upiUri}
                            className="inline-block font-semibold text-[#1B4332] underline"
                          >
                            Open in GPay / PhonePe / Paytm
                          </a>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="upi-utr-input"
                          className="block text-xs font-semibold text-[#556159] mb-1.5"
                        >
                          12-Digit UTR / Transaction Reference Number
                        </label>
                        <input
                          id="upi-utr-input"
                          type="text"
                          required
                          minLength={8}
                          value={utrInput}
                          onChange={(e) => setUtrInput(e.target.value)}
                          placeholder="e.g. 432198765432"
                          className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2.5 text-sm font-[family-name:var(--font-mono)] uppercase"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="upi-proof-file"
                          className="block text-xs font-semibold text-[#556159] mb-1.5"
                        >
                          Upload Payment Screenshot (Optional · JPG/PNG/PDF)
                        </label>
                        <label
                          htmlFor="upi-proof-file"
                          className="flex items-center justify-between rounded-lg border border-dashed border-[#CBD5E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#556159] hover:border-[#1B4332] cursor-pointer"
                        >
                          <span className="truncate">
                            {proofFileName || 'Choose screenshot file...'}
                          </span>
                          <Upload className="h-4 w-4 shrink-0 text-[#1B4332]" />
                        </label>
                        <input
                          id="upi-proof-file"
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleProofFileChange}
                          className="sr-only"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={verifyingPayment}
                        className="w-full rounded-lg bg-[#1B4332] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#143326] disabled:opacity-50 cursor-pointer"
                      >
                        {verifyingPayment
                          ? 'Submitting Verification...'
                          : 'Submit UTR & Generate Receipt'}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-[#556159]">
                        Order ID:{' '}
                        <span className="font-[family-name:var(--font-mono)] text-[#141C17]">
                          {activeHold.booking.razorpayOrderId}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setRzpOpen(true)}
                        className="w-full rounded-lg bg-[#1B4332] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#143326] cursor-pointer"
                      >
                        Open Razorpay Secure Checkout
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Razorpay Interactive Checkout Dialog */}
      {rzpOpen && activeHold && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Razorpay Checkout"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-[#E4E4E0] bg-white overflow-hidden">
            <div className="bg-[#1B4332] p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs opacity-80">Nightingale Tea Tourism</div>
                  <div className="mt-0.5 text-lg font-bold">
                    {formatInr(activeHold.booking.totalAmount)}
                  </div>
                </div>
                <ShieldCheck className="h-6 w-6 opacity-90" />
              </div>
              <div className="mt-2 font-[family-name:var(--font-mono)] text-xs opacity-80">
                Ref {activeHold.booking.bookingRef} · {activeHold.booking.razorpayOrderId}
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-xs font-semibold text-[#556159]">
                Select Payment Instrument
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['UPI', 'CARD', 'NETBANKING'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRzpChannel(mode)}
                    className={`rounded-lg border px-2 py-2.5 text-xs font-semibold cursor-pointer ${
                      rzpChannel === mode
                        ? 'border-[#1B4332] bg-[#F2F4F0] text-[#1B4332]'
                        : 'border-[#E4E4E0] text-[#556159]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="rounded-lg bg-[#FAFAF8] border border-[#E4E4E0] p-3 text-xs text-[#556159]">
                {rzpChannel === 'UPI' &&
                  'Instant UPI Collect / Intent via GPay, PhonePe, BHIM, or Paytm.'}
                {rzpChannel === 'CARD' &&
                  'Visa, Mastercard, RuPay Debit & Credit Cards with 3DS authentication.'}
                {rzpChannel === 'NETBANKING' &&
                  'All major Indian corporate & retail NetBanking portals.'}
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRzpOpen(false)}
                  className="flex-1 rounded-lg border border-[#E4E4E0] px-4 py-2.5 text-sm font-semibold text-[#141C17] hover:bg-[#F2F4F0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={verifyingPayment}
                  onClick={handleRazorpayConfirm}
                  className="flex-1 rounded-lg bg-[#1B4332] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#143326] disabled:opacity-50 cursor-pointer"
                >
                  {verifyingPayment ? 'Verifying...' : 'Pay & Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

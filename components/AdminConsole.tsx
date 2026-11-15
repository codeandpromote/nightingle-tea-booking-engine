'use client';

import React from 'react';
import {
  CalendarCog,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  LayoutDashboard,
  LogOut,
  Plus,
  Printer,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  addDaysIso,
  computeDailyAvailability,
  formatInr,
  formatIsoDateUtc,
  type AuditLog,
  type Booking,
  type Estate,
  type InventoryOverride,
  type MealPlan,
  type SystemSettings,
} from '@/lib/booking-engine';
import { StatusText } from './DigitalReceiptCard';

type AdminTab = 'overview' | 'bookings' | 'inventory' | 'settings' | 'audit';

interface DashboardPayload {
  kpis: {
    today: string;
    checkinsToday: number;
    checkoutsToday: number;
    pendingVerifications: number;
    confirmedRevenue: number;
    razorpayRevenue: number;
    manualUpiRevenue: number;
    monthlyOccupancyPct: number;
    totalBookings: number;
  };
  estates: Estate[];
  bookings: Booking[];
  overrides: InventoryOverride[];
  settings: SystemSettings;
  auditLogs: AuditLog[];
}

interface AdminConsoleProps {
  onDataChanged?: () => void;
}

export default function AdminConsole({ onDataChanged }: AdminConsoleProps) {
  const [signedInUser, setSignedInUser] = React.useState<string | null>(null);
  const [loginUsername, setLoginUsername] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [loginError, setLoginError] = React.useState<string | null>(null);

  const [tab, setTab] = React.useState<AdminTab>('overview');
  const [data, setData] = React.useState<DashboardPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Bookings filters & modals
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');
  const [proofModalBooking, setProofModalBooking] = React.useState<Booking | null>(null);
  const [newBookingOpen, setNewBookingOpen] = React.useState(false);

  // Inventory Calendar state
  const today = React.useMemo(() => formatIsoDateUtc(new Date()), []);
  const [invEstateId, setInvEstateId] = React.useState('est-mateli');
  const [invStartDate, setInvStartDate] = React.useState(today);
  const [invEndDate, setInvEndDate] = React.useState(today);
  const [invBlocked, setInvBlocked] = React.useState(false);
  const [invBlockReason, setInvBlockReason] = React.useState('');
  const [invMinStay, setInvMinStay] = React.useState(1);
  const [invMapOverride, setInvMapOverride] = React.useState('');
  const [invAllMealsOverride, setInvAllMealsOverride] = React.useState('');
  const [invCustomRooms, setInvCustomRooms] = React.useState('');

  // Room Category Creation state
  const [showAddRoom, setShowAddRoom] = React.useState(false);
  const [newRoomName, setNewRoomName] = React.useState('');
  const [newRoomUnits, setNewRoomUnits] = React.useState(2);
  const [newRoomLabels, setNewRoomLabels] = React.useState('');
  const [newRoomBed, setNewRoomBed] = React.useState('King Bed · Tea Garden View');
  const [newRoomMapRate, setNewRoomMapRate] = React.useState('');
  const [newRoomAllRate, setNewRoomAllRate] = React.useState('');

  // Manual desk booking form
  const [manualEstateSlug, setManualEstateSlug] = React.useState('mateli');
  const [manualRoomTypeId, setManualRoomTypeId] = React.useState('');
  const [manualCheckIn, setManualCheckIn] = React.useState(addDaysIso(today, 1));
  const [manualCheckOut, setManualCheckOut] = React.useState(addDaysIso(today, 2));
  const [manualRooms, setManualRooms] = React.useState(1);
  const [manualAdults, setManualAdults] = React.useState(2);
  const [manualMealPlan, setManualMealPlan] = React.useState<MealPlan>('MAP');
  const [manualGuestName, setManualGuestName] = React.useState('');
  const [manualGuestPhone, setManualGuestPhone] = React.useState('');
  const [manualGuestEmail, setManualGuestEmail] = React.useState('');
  const [manualUtr, setManualUtr] = React.useState('');

  // Settings form
  const [upiIdInput, setUpiIdInput] = React.useState('');
  const [holdTtlInput, setHoldTtlInput] = React.useState(30);
  const [gstInput, setGstInput] = React.useState(0);

  const fetchDashboard = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) return;
      const json = (await res.json()) as DashboardPayload;
      setData(json);
      setUpiIdInput(json.settings.upiId);
      setHoldTtlInput(json.settings.holdTtlMinutes);
      setGstInput(json.settings.gstPercentage);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (
      (loginUsername.trim() === 'director' || loginUsername.trim() === 'admin') &&
      loginPassword === 'Nightingale@2026'
    ) {
      setSignedInUser('Estate Director');
      setLoading(true);
      await fetchDashboard();
      return;
    }
    setLoginError('Invalid credentials. Use Demo Credentials button below to preview.');
  };

  const runAdminAction = async (payload: Record<string, unknown>, successMsg: string) => {
    setNotice(null);
    const res = await fetch('/api/admin/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, actor: `ADMIN:${signedInUser || 'director'}` }),
    });
    const json = await res.json();
    if (!res.ok) {
      setNotice(`Error: ${json.error || 'Action failed'}`);
      return false;
    }
    setNotice(successMsg);
    await fetchDashboard();
    onDataChanged?.();
    return true;
  };

  const handleSaveInventoryRule = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAdminAction(
      {
        type: 'INVENTORY_OVERRIDE',
        estateId: invEstateId,
        startDate: invStartDate,
        endDate: invEndDate,
        isBlocked: invBlocked,
        blockReason: invBlockReason,
        minStay: invMinStay,
        mapRateOverride: invMapOverride === '' ? null : Number(invMapOverride),
        allMealsRateOverride: invAllMealsOverride === '' ? null : Number(invAllMealsOverride),
        customTotalRooms: invCustomRooms === '' ? null : Number(invCustomRooms),
      },
      `Inventory rules updated for ${invStartDate}${invEndDate !== invStartDate ? ` to ${invEndDate}` : ''}.`
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAdminAction(
      {
        type: 'UPDATE_SETTINGS',
        upiId: upiIdInput,
        holdTtlMinutes: holdTtlInput,
        gstPercentage: gstInput,
      },
      'Gateway & UPI settlement settings updated.'
    );
  };

  const handleSaveEstateTariff = async (estate: Estate, formData: FormData) => {
    await runAdminAction(
      {
        type: 'UPDATE_ESTATE_TARIFF',
        estateId: estate.id,
        totalRooms: Number(formData.get('totalRooms')),
        mapBaseRate: Number(formData.get('mapBaseRate')),
        allMealsBaseRate: Number(formData.get('allMealsBaseRate')),
        extraAdultMapRate: Number(formData.get('extraAdultMapRate')),
        extraAdultAllMealsRate: Number(formData.get('extraAdultAllMealsRate')),
        child5to12MapRate: Number(formData.get('child5to12MapRate')),
        child5to12AllMealsRate: Number(formData.get('child5to12AllMealsRate')),
      },
      `Updated tariff rates for ${estate.name}.`
    );
  };

  const handleCreateManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await runAdminAction(
      {
        type: 'CREATE_MANUAL_BOOKING',
        estateSlug: manualEstateSlug,
        roomTypeId: manualRoomTypeId || undefined,
        checkIn: manualCheckIn,
        checkOut: manualCheckOut,
        roomsCount: manualRooms,
        adults: manualAdults,
        mealPlan: manualMealPlan,
        guestName: manualGuestName,
        guestPhone: manualGuestPhone,
        guestEmail: manualGuestEmail,
        upiUtr: manualUtr,
      },
      'Confirmed desk booking created and inventory updated.'
    );
    if (ok) {
      setNewBookingOpen(false);
      setManualGuestName('');
      setManualGuestPhone('');
      setManualGuestEmail('');
      setManualUtr('');
      setManualRoomTypeId('');
    }
  };

  const handleSaveRoomCategory = async (
    estateId: string,
    roomCategoryId: string,
    formData: FormData
  ) => {
    await runAdminAction(
      {
        type: 'UPDATE_ROOM_INVENTORY',
        estateId,
        roomCategoryId,
        name: String(formData.get('name') || ''),
        unitLabels: String(formData.get('unitLabels') || ''),
        totalUnits: Number(formData.get('totalUnits') ?? 1),
        mapRate: Number(formData.get('mapRate') ?? 10000),
        allMealsRate: Number(formData.get('allMealsRate') ?? 12000),
        bedType: String(formData.get('bedType') || ''),
      },
      'Room inventory & unit count updated across live booking engine.'
    );
  };

  const handleToggleRoomActive = async (
    estateId: string,
    roomCategoryId: string,
    nextActive: boolean,
    roomName: string
  ) => {
    await runAdminAction(
      {
        type: 'UPDATE_ROOM_INVENTORY',
        estateId,
        roomCategoryId,
        isActive: nextActive,
      },
      `${roomName} marked as ${nextActive ? 'Active' : 'Out of Service / Maintenance'}.`
    );
  };

  const handleAddRoomCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvEstate) return;
    const ok = await runAdminAction(
      {
        type: 'ADD_ROOM_CATEGORY',
        estateId: selectedInvEstate.id,
        name: newRoomName,
        totalUnits: newRoomUnits,
        unitLabels: newRoomLabels,
        bedType: newRoomBed,
        mapRate: newRoomMapRate === '' ? selectedInvEstate.mapBaseRate : Number(newRoomMapRate),
        allMealsRate:
          newRoomAllRate === '' ? selectedInvEstate.allMealsBaseRate : Number(newRoomAllRate),
      },
      `Added ${newRoomName} (${newRoomUnits} units) to ${selectedInvEstate.name}.`
    );
    if (ok) {
      setShowAddRoom(false);
      setNewRoomName('');
      setNewRoomUnits(2);
      setNewRoomLabels('');
      setNewRoomMapRate('');
      setNewRoomAllRate('');
    }
  };

  if (!signedInUser) {
    return (
      <section className="mx-auto max-w-md px-4 py-14">
        <div className="rounded-xl border border-[#E4E4E0] bg-white p-6 sm:p-8">
          <p className="text-xs font-semibold tracking-wide text-[#556159]">
            Nightingale Tea Tourism
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-[#141C17]">
            Admin Management Console
          </h1>
          <p className="mt-2 text-sm text-[#556159]">
            Sign in to verify Manual UPI receipts, manage room blocks &amp; seasonal tariffs, and export compliance guest lists.
          </p>

          {loginError && (
            <div className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-5 space-y-4">
            <div>
              <label htmlFor="admin-user" className="block text-xs font-semibold text-[#556159] mb-1.5">
                Username
              </label>
              <input
                id="admin-user"
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="director"
                className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="admin-pass" className="block text-xs font-semibold text-[#556159] mb-1.5">
                Password
              </label>
              <input
                id="admin-pass"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-[#1B4332] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#143326] cursor-pointer"
            >
              Sign In to Console
            </button>
          </form>

          <div className="mt-4 border-t border-[#E4E4E0] pt-4">
            <button
              type="button"
              onClick={() => {
                setLoginUsername('director');
                setLoginPassword('Nightingale@2026');
              }}
              className="w-full rounded-lg border border-[#E4E4E0] bg-[#FAFAF8] px-3 py-2 text-xs font-semibold text-[#1B4332] hover:bg-[#F2F4F0] cursor-pointer"
            >
              Fill Demo Director Credentials (director)
            </button>
          </div>
        </div>
      </section>
    );
  }

  const filteredBookings = (data?.bookings || []).filter((b) => {
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.bookingRef.toLowerCase().includes(q) ||
      b.guestName.toLowerCase().includes(q) ||
      b.guestPhone.toLowerCase().includes(q) ||
      (b.upiUtr || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const selectedInvEstate =
    data?.estates.find((e) => e.id === invEstateId) || data?.estates[0];
  const invCalendarDays =
    selectedInvEstate && data
      ? computeDailyAvailability(
          selectedInvEstate,
          today,
          21,
          data.bookings,
          data.overrides,
          new Date().toISOString()
        )
      : [];

  const sidebarItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    {
      id: 'bookings',
      label: `Bookings (${data?.kpis.pendingVerifications || 0} Pending)`,
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      id: 'inventory',
      label: 'Rooms & Inventory',
      icon: <CalendarCog className="h-4 w-4" />,
    },
    {
      id: 'settings',
      label: 'Tariffs & Gateways',
      icon: <SlidersHorizontal className="h-4 w-4" />,
    },
    { id: 'audit', label: 'Audit & Reports', icon: <ShieldAlert className="h-4 w-4" /> },
  ];

  return (
    <section className="mx-auto max-w-[1320px] px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar Navigation (240px+ proportion) */}
        <aside className="no-print lg:col-span-3 rounded-xl border border-[#E4E4E0] bg-white p-4 space-y-2">
          <div className="px-3 py-2 border-b border-[#E4E4E0] mb-2">
            <div className="text-xs text-[#556159]">Estate Operations</div>
            <div className="text-sm font-bold text-[#141C17]">{signedInUser}</div>
          </div>

          {sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                tab === item.id
                  ? 'bg-[#1B4332] text-white'
                  : 'text-[#556159] hover:bg-[#F2F4F0] hover:text-[#141C17]'
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          ))}

          <div className="pt-3 border-t border-[#E4E4E0]">
            <button
              type="button"
              onClick={() => setSignedInUser(null)}
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="lg:col-span-9 space-y-6">
          {/* Top Breadcrumb Bar */}
          <div className="no-print rounded-xl border border-[#E4E4E0] bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs text-[#556159]">
                Admin Console / <span className="text-[#141C17] font-semibold capitalize">{tab}</span>
              </div>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#141C17]">
                Nightingale Tea Operations
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setNewBookingOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B4332] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#143326] cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                New Desk Booking
              </button>
              <a
                href="/api/admin/export-csv"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E0] bg-white px-3.5 py-2 text-xs font-semibold text-[#141C17] hover:bg-[#F2F4F0] whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E0] bg-white px-3.5 py-2 text-xs font-semibold text-[#141C17] hover:bg-[#F2F4F0] cursor-pointer whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5" />
                Print PDF
              </button>
            </div>
          </div>

          {notice && (
            <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534] flex items-center justify-between">
              <span>{notice}</span>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setNotice(null)}
                className="cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {loading && !data ? (
            <div className="rounded-xl border border-[#E4E4E0] bg-white p-8 text-sm text-[#556159]">
              Loading live estate telemetry...
            </div>
          ) : data ? (
            <>
              {/* OVERVIEW TAB */}
              {tab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-[#E4E4E0] bg-white p-5">
                      <div className="text-xs font-semibold text-[#556159]">Check-ins Today</div>
                      <div className="mt-2 font-[family-name:var(--font-mono)] text-3xl font-bold text-[#141C17] tabular-nums">
                        {data.kpis.checkinsToday}
                      </div>
                      <div className="mt-1 text-xs text-[#556159]">{data.kpis.today}</div>
                    </div>
                    <div className="rounded-xl border border-[#E4E4E0] bg-white p-5">
                      <div className="text-xs font-semibold text-[#556159]">Check-outs Today</div>
                      <div className="mt-2 font-[family-name:var(--font-mono)] text-3xl font-bold text-[#141C17] tabular-nums">
                        {data.kpis.checkoutsToday}
                      </div>
                      <div className="mt-1 text-xs text-[#556159]">Across 3 Estates</div>
                    </div>
                    <div className="rounded-xl border border-[#E4E4E0] bg-white p-5">
                      <div className="text-xs font-semibold text-[#556159]">
                        Pending UPI Verifications
                      </div>
                      <div className="mt-2 font-[family-name:var(--font-mono)] text-3xl font-bold text-[#B45309] tabular-nums">
                        {data.kpis.pendingVerifications}
                      </div>
                      <div className="mt-1 text-xs text-[#556159]">Requires bank UTR check</div>
                    </div>
                    <div className="rounded-xl border border-[#E4E4E0] bg-white p-5">
                      <div className="text-xs font-semibold text-[#556159]">
                        Monthly Occupancy
                      </div>
                      <div className="mt-2 font-[family-name:var(--font-mono)] text-3xl font-bold text-[#1B4332] tabular-nums">
                        {data.kpis.monthlyOccupancyPct}%
                      </div>
                      <div className="mt-1 font-[family-name:var(--font-mono)] text-xs text-[#556159]">
                        {formatInr(data.kpis.confirmedRevenue)} confirmed
                      </div>
                    </div>
                  </div>

                  {/* Settlement Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-[#E4E4E0] bg-white p-5">
                      <div className="text-xs font-semibold text-[#556159]">
                        Automated Razorpay Gateway Volume
                      </div>
                      <div className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold text-[#141C17]">
                        {formatInr(data.kpis.razorpayRevenue)}
                      </div>
                      <p className="mt-1 text-xs text-[#556159]">
                        Auto-confirmed via webhook · ~2% + GST gateway fee
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E4E4E0] bg-white p-5">
                      <div className="text-xs font-semibold text-[#556159]">
                        Direct Manual UPI / QR Volume
                      </div>
                      <div className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold text-[#1B4332]">
                        {formatInr(data.kpis.manualUpiRevenue)}
                      </div>
                      <p className="mt-1 text-xs text-[#556159]">
                        0% transaction fee · Settled directly to company bank account
                      </p>
                    </div>
                  </div>

                  {/* Pending Verifications Queue */}
                  <div className="rounded-xl border border-[#E4E4E0] bg-white overflow-hidden">
                    <div className="border-b border-[#E4E4E0] px-5 py-4 flex items-center justify-between">
                      <h2 className="text-base font-bold text-[#141C17]">
                        Pending Manual UPI Verification Queue
                      </h2>
                      <button
                        type="button"
                        onClick={() => setTab('bookings')}
                        className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                      >
                        View All Bookings →
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[#F2F4F0] text-xs text-[#556159]">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Ref</th>
                            <th className="px-4 py-3 text-left font-semibold">Guest</th>
                            <th className="px-4 py-3 text-left font-semibold">Estate &amp; Dates</th>
                            <th className="px-4 py-3 text-left font-semibold">UTR Reference</th>
                            <th className="px-4 py-3 text-right font-semibold">Amount</th>
                            <th className="px-4 py-3 text-right font-semibold">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E4E0]">
                          {data.bookings
                            .filter((b) => b.status === 'PENDING_VERIFICATION')
                            .map((b) => (
                              <tr key={b.id} className="hover:bg-[#FAFAF8]">
                                <td className="px-4 py-3 font-[family-name:var(--font-mono)] font-semibold text-[#1B4332]">
                                  {b.bookingRef}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium">{b.guestName}</div>
                                  <div className="text-xs text-[#556159]">{b.guestPhone}</div>
                                </td>
                                <td className="px-4 py-3 text-xs">
                                  <div className="font-medium text-[#141C17]">{b.estateName}</div>
                                  <div className="font-[family-name:var(--font-mono)] text-[#556159]">
                                    {b.checkIn} → {b.checkOut}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                                  {b.upiUtr || '—'}
                                </td>
                                <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] font-semibold">
                                  {formatInr(b.totalAmount)}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => setProofModalBooking(b)}
                                    className="rounded border border-[#E4E4E0] px-2.5 py-1 text-xs font-medium hover:bg-[#F2F4F0] cursor-pointer"
                                  >
                                    Inspect
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      runAdminAction(
                                        {
                                          type: 'BOOKING_STATUS',
                                          bookingRef: b.bookingRef,
                                          action: 'APPROVE_UPI',
                                        },
                                        `Approved payment and confirmed ${b.bookingRef}.`
                                      )
                                    }
                                    className="rounded bg-[#1B4332] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#143326] cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                </td>
                              </tr>
                            ))}
                          {data.bookings.filter((b) => b.status === 'PENDING_VERIFICATION').length ===
                            0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-6 text-center text-sm text-[#556159]">
                                All manual UPI submissions have been verified.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* BOOKINGS TAB */}
              {tab === 'bookings' && (
                <div className="rounded-xl border border-[#E4E4E0] bg-white overflow-hidden">
                  <div className="border-b border-[#E4E4E0] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1 bg-[#F2F4F0] p-1 rounded-lg">
                      {(
                        [
                          'ALL',
                          'PENDING_VERIFICATION',
                          'CONFIRMED',
                          'CHECKED_IN',
                          'CANCELLED',
                        ] as const
                      ).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatusFilter(st)}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                            statusFilter === st
                              ? 'bg-white text-[#141C17] shadow-xs'
                              : 'text-[#556159] hover:text-[#141C17]'
                          }`}
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>

                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search Ref, Guest, Phone, or UTR..."
                      className="w-full md:w-64 rounded-lg border border-[#E4E4E0] px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F2F4F0] text-xs text-[#556159]">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Ref ID</th>
                          <th className="px-4 py-3 text-left font-semibold">Guest</th>
                          <th className="px-4 py-3 text-left font-semibold">Estate &amp; Stay</th>
                          <th className="px-4 py-3 text-left font-semibold">Payment</th>
                          <th className="px-4 py-3 text-right font-semibold">Total</th>
                          <th className="px-4 py-3 text-left font-semibold">Status</th>
                          <th className="px-4 py-3 text-right font-semibold">Controls</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E4E0]">
                        {filteredBookings.map((b) => (
                          <tr key={b.id} className="hover:bg-[#FAFAF8]">
                            <td className="px-4 py-3 font-[family-name:var(--font-mono)] font-semibold text-[#1B4332] whitespace-nowrap">
                              {b.bookingRef}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{b.guestName}</div>
                              <div className="text-xs text-[#556159]">
                                {b.guestPhone} · {b.guestCity || 'India'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <div className="font-semibold">{b.estateName}</div>
                              <div className="font-[family-name:var(--font-mono)] text-[#556159]">
                                {b.checkIn} → {b.checkOut} ({b.roomsCount}R · {b.mealPlan})
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <div>{b.paymentMethod === 'RAZORPAY' ? 'Razorpay' : 'Manual UPI'}</div>
                              {b.upiUtr && (
                                <div className="font-[family-name:var(--font-mono)] text-[#556159]">
                                  UTR: {b.upiUtr}
                                </div>
                              )}
                              {b.razorpayPaymentId && (
                                <div className="font-[family-name:var(--font-mono)] text-[#556159]">
                                  {b.razorpayPaymentId}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] font-semibold whitespace-nowrap">
                              {formatInr(b.totalAmount)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusText status={b.status} />
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                              <button
                                type="button"
                                aria-label={`Inspect ${b.bookingRef}`}
                                onClick={() => setProofModalBooking(b)}
                                className="inline-flex items-center gap-1 rounded border border-[#E4E4E0] px-2 py-1 text-xs hover:bg-[#F2F4F0] cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </button>
                              {(b.status === 'PENDING_VERIFICATION' ||
                                b.status === 'AWAITING_PAYMENT') && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    runAdminAction(
                                      {
                                        type: 'BOOKING_STATUS',
                                        bookingRef: b.bookingRef,
                                        action: 'APPROVE_UPI',
                                      },
                                      `Confirmed booking ${b.bookingRef}.`
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded bg-[#1B4332] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#143326] cursor-pointer"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Approve
                                </button>
                              )}
                              {b.status === 'CONFIRMED' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    runAdminAction(
                                      {
                                        type: 'BOOKING_STATUS',
                                        bookingRef: b.bookingRef,
                                        action: 'MARK_CHECKED_IN',
                                      },
                                      `Marked ${b.bookingRef} as Checked In.`
                                    )
                                  }
                                  className="rounded border border-[#1B4332] px-2.5 py-1 text-xs font-semibold text-[#1B4332] hover:bg-[#F2F4F0] cursor-pointer"
                                >
                                  Check In
                                </button>
                              )}
                              {b.status !== 'CANCELLED' && b.status !== 'EXPIRED' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    runAdminAction(
                                      {
                                        type: 'BOOKING_STATUS',
                                        bookingRef: b.bookingRef,
                                        action: 'CANCEL',
                                      },
                                      `Cancelled ${b.bookingRef} and released room inventory.`
                                    )
                                  }
                                  className="rounded border border-[#FECACA] px-2 py-1 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ROOMS & INVENTORY CALENDAR TAB */}
              {tab === 'inventory' && (
                <div className="space-y-6">
                  {/* Estate Room Categories & Unit Inventory Manager */}
                  <div className="rounded-xl border border-[#E4E4E0] bg-white p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-[#141C17]">
                          Room Inventory &amp; Category Allocation (Multi-Room Estates)
                        </h2>
                        <p className="text-xs text-[#556159]">
                          Adjust available room counts, unit numbers, per-category tariffs, or take rooms offline for maintenance.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddRoom((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B4332] px-3 py-2 text-xs font-semibold text-white hover:bg-[#143326] cursor-pointer whitespace-nowrap self-start"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Room Category
                      </button>
                    </div>

                    {/* Estate Switcher */}
                    <div className="flex flex-wrap gap-2 bg-[#F2F4F0] p-1 rounded-lg">
                      {data.estates.map((est) => {
                        const activeUnits = (est.roomCategories || [])
                          .filter((r) => r.isActive)
                          .reduce((s, r) => s + r.totalUnits, 0);
                        return (
                          <button
                            key={est.id}
                            type="button"
                            onClick={() => setInvEstateId(est.id)}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                              selectedInvEstate?.id === est.id
                                ? 'bg-white text-[#141C17] shadow-xs'
                                : 'text-[#556159] hover:text-[#141C17]'
                            }`}
                          >
                            {est.name} ({activeUnits} Rooms)
                          </button>
                        );
                      })}
                    </div>

                    {showAddRoom && selectedInvEstate && (
                      <form
                        onSubmit={handleAddRoomCategory}
                        className="rounded-lg border border-[#E4E4E0] bg-[#FAFAF8] p-4 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end text-xs"
                      >
                        <div className="sm:col-span-2">
                          <label className="block font-semibold text-[#556159] mb-1">
                            New Category Name
                          </label>
                          <input
                            type="text"
                            required
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            placeholder="e.g. Planter Garden Villa"
                            className="w-full rounded border border-[#E4E4E0] bg-white px-2.5 py-2"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#556159] mb-1">
                            Room Units
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            required
                            value={newRoomUnits}
                            onChange={(e) => setNewRoomUnits(Math.max(1, Number(e.target.value)))}
                            className="w-full rounded border border-[#E4E4E0] bg-white px-2.5 py-2 tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#556159] mb-1">
                            Unit Labels
                          </label>
                          <input
                            type="text"
                            value={newRoomLabels}
                            onChange={(e) => setNewRoomLabels(e.target.value)}
                            placeholder="e.g. M-107, M-108"
                            className="w-full rounded border border-[#E4E4E0] bg-white px-2.5 py-2"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#556159] mb-1">
                            MAP Rate (₹)
                          </label>
                          <input
                            type="number"
                            min={1000}
                            value={newRoomMapRate}
                            onChange={(e) => setNewRoomMapRate(e.target.value)}
                            placeholder={String(selectedInvEstate.mapBaseRate)}
                            className="w-full rounded border border-[#E4E4E0] bg-white px-2.5 py-2 tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#556159] mb-1">
                            All Meals (₹)
                          </label>
                          <input
                            type="number"
                            min={1000}
                            value={newRoomAllRate}
                            onChange={(e) => setNewRoomAllRate(e.target.value)}
                            placeholder={String(selectedInvEstate.allMealsBaseRate)}
                            className="w-full rounded border border-[#E4E4E0] bg-white px-2.5 py-2 tabular-nums"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="block font-semibold text-[#556159] mb-1">
                            Bed &amp; View Summary
                          </label>
                          <input
                            type="text"
                            value={newRoomBed}
                            onChange={(e) => setNewRoomBed(e.target.value)}
                            className="w-full rounded border border-[#E4E4E0] bg-white px-2.5 py-2"
                          />
                        </div>
                        <div className="sm:col-span-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddRoom(false)}
                            className="flex-1 rounded border border-[#E4E4E0] bg-white px-3 py-2 font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 rounded bg-[#1B4332] px-3 py-2 font-semibold text-white hover:bg-[#143326] cursor-pointer"
                          >
                            Create Room Type
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Room Categories List */}
                    <div className="space-y-3">
                      {(selectedInvEstate?.roomCategories || []).map((rc) => (
                        <form
                          key={`${rc.id}-${rc.totalUnits}-${rc.mapRate}-${rc.allMealsRate}-${rc.isActive}`}
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveRoomCategory(
                              selectedInvEstate!.id,
                              rc.id,
                              new FormData(e.currentTarget)
                            );
                          }}
                          className="rounded-lg border border-[#E4E4E0] p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-xs"
                        >
                          <div className="md:col-span-3">
                            <label className="block font-semibold text-[#556159] mb-1">
                              Room Category Name
                            </label>
                            <input
                              name="name"
                              type="text"
                              defaultValue={rc.name}
                              required
                              className="w-full rounded border border-[#E4E4E0] px-2.5 py-1.5 font-semibold text-[#141C17]"
                            />
                            <input
                              name="bedType"
                              type="text"
                              defaultValue={rc.bedType}
                              aria-label={`${rc.name} bed and view description`}
                              className="mt-1.5 w-full rounded border border-[#E4E4E0] px-2.5 py-1 text-[11px] text-[#556159]"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block font-semibold text-[#556159] mb-1">
                              Unit Numbers
                            </label>
                            <input
                              name="unitLabels"
                              type="text"
                              defaultValue={rc.unitLabels.join(', ')}
                              className="w-full rounded border border-[#E4E4E0] px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-[11px]"
                            />
                          </div>
                          <div className="md:col-span-1">
                            <label className="block font-semibold text-[#556159] mb-1">
                              Units
                            </label>
                            <input
                              name="totalUnits"
                              type="number"
                              min={0}
                              max={30}
                              defaultValue={rc.totalUnits}
                              aria-label={`Units for ${rc.name}`}
                              className="w-full rounded border border-[#E4E4E0] px-2 py-1.5 font-[family-name:var(--font-mono)] font-bold tabular-nums"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block font-semibold text-[#556159] mb-1">
                              MAP Rate (₹)
                            </label>
                            <input
                              name="mapRate"
                              type="number"
                              min={1000}
                              defaultValue={rc.mapRate}
                              className="w-full rounded border border-[#E4E4E0] px-2.5 py-1.5 font-[family-name:var(--font-mono)] tabular-nums"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block font-semibold text-[#556159] mb-1">
                              All Meals (₹)
                            </label>
                            <input
                              name="allMealsRate"
                              type="number"
                              min={1000}
                              defaultValue={rc.allMealsRate}
                              className="w-full rounded border border-[#E4E4E0] px-2.5 py-1.5 font-[family-name:var(--font-mono)] tabular-nums"
                            />
                          </div>
                          <div className="md:col-span-2 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleRoomActive(
                                  selectedInvEstate!.id,
                                  rc.id,
                                  !rc.isActive,
                                  rc.name
                                )
                              }
                              className={`flex-1 rounded border px-2 py-1.5 font-semibold cursor-pointer whitespace-nowrap ${
                                rc.isActive
                                  ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]'
                                  : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]'
                              }`}
                            >
                              {rc.isActive ? 'Active' : 'Offline'}
                            </button>
                            <button
                              type="submit"
                              className="flex-1 rounded bg-[#1B4332] px-2.5 py-1.5 font-semibold text-white hover:bg-[#143326] cursor-pointer whitespace-nowrap"
                            >
                              Save
                            </button>
                          </div>
                        </form>
                      ))}
                    </div>
                  </div>

                  {/* Date-Level Calendar Matrix & Overrides */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-7 rounded-xl border border-[#E4E4E0] bg-white p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h2 className="text-base font-bold text-[#141C17]">
                          21-Day Inventory &amp; Seasonal Tariff Matrix · {selectedInvEstate?.name}
                        </h2>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                        {invCalendarDays.map((day) => {
                          const isPicked = day.date >= invStartDate && day.date <= invEndDate;
                          return (
                            <button
                              key={day.date}
                              type="button"
                              onClick={() => {
                                setInvStartDate(day.date);
                                setInvEndDate(day.date);
                                setInvBlocked(day.isBlocked);
                                setInvBlockReason(day.blockReason || '');
                                setInvMinStay(day.minStay);
                              }}
                              className={`rounded-lg border p-2 text-left cursor-pointer transition-colors ${
                                day.isBlocked
                                  ? 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
                                  : isPicked
                                    ? 'border-[#1B4332] bg-[#1B4332] text-white'
                                    : 'border-[#E4E4E0] bg-white hover:border-[#1B4332]'
                              }`}
                            >
                              <div className="text-[11px] font-medium opacity-80">
                                {day.date.slice(5)}
                              </div>
                              <div className="mt-1 text-xs font-bold tabular-nums">
                                {day.isBlocked ? 'BLOCKED' : `${day.availableRooms}/${day.totalRooms}`}
                              </div>
                              <div className="font-[family-name:var(--font-mono)] text-[10px] opacity-85">
                                ₹{(day.effectiveMapRate / 1000).toFixed(1)}k
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <form
                      onSubmit={handleSaveInventoryRule}
                      className="lg:col-span-5 rounded-xl border border-[#E4E4E0] bg-white p-5 space-y-4"
                    >
                      <h3 className="text-base font-bold text-[#141C17]">
                        Edit Date / Range Rules
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#556159] mb-1">
                            From Date
                          </label>
                          <input
                            type="date"
                            required
                            value={invStartDate}
                            onChange={(e) => setInvStartDate(e.target.value)}
                            className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2 text-xs font-[family-name:var(--font-mono)]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#556159] mb-1">
                            To Date
                          </label>
                          <input
                            type="date"
                            required
                            value={invEndDate}
                            onChange={(e) => setInvEndDate(e.target.value)}
                            className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2 text-xs font-[family-name:var(--font-mono)]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#556159] mb-1">
                            Availability Status
                          </label>
                          <select
                            value={invBlocked ? 'BLOCKED' : 'OPEN'}
                            onChange={(e) => setInvBlocked(e.target.value === 'BLOCKED')}
                            className="w-full rounded-lg border border-[#E4E4E0] bg-white px-2.5 py-2 text-xs"
                          >
                            <option value="OPEN">Open for Reservations</option>
                            <option value="BLOCKED">Emergency Closure / Blocked</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#556159] mb-1">
                            Minimum Stay (Nights)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={invMinStay}
                            onChange={(e) => setInvMinStay(Math.max(1, Number(e.target.value)))}
                            className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2 text-xs tabular-nums"
                          />
                        </div>
                      </div>

                      {invBlocked && (
                        <div>
                          <label className="block text-xs font-semibold text-[#556159] mb-1">
                            Closure / Block Reason
                          </label>
                          <input
                            type="text"
                            value={invBlockReason}
                            onChange={(e) => setInvBlockReason(e.target.value)}
                            placeholder="e.g. Corporate Estate Buyout / Maintenance"
                            className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2 text-xs"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#556159] mb-1">
                            Seasonal MAP Rate (₹)
                          </label>
                          <input
                            type="number"
                            value={invMapOverride}
                            onChange={(e) => setInvMapOverride(e.target.value)}
                            placeholder="Default rate"
                            className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2 text-xs tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#556159] mb-1">
                            All Meals Override (₹)
                          </label>
                          <input
                            type="number"
                            value={invAllMealsOverride}
                            onChange={(e) => setInvAllMealsOverride(e.target.value)}
                            placeholder="Default rate"
                            className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2 text-xs tabular-nums"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#556159] mb-1">
                          Date-Specific Room Cap Override (Optional)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={invCustomRooms}
                          onChange={(e) => setInvCustomRooms(e.target.value)}
                          placeholder={`Default (${selectedInvEstate?.totalRooms || 6} rooms)`}
                          className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2 text-xs tabular-nums"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full rounded-lg bg-[#1B4332] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#143326] cursor-pointer"
                      >
                        Save Date Inventory Rule
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TARIFFS & SETTINGS TAB */}
              {tab === 'settings' && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleSaveSettings}
                    className="rounded-xl border border-[#E4E4E0] bg-white p-6 space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-[#1B4332]" />
                      <h2 className="text-base font-bold text-[#141C17]">
                        Payment Gateway &amp; Hold Rules
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#556159] mb-1">
                          Merchant UPI VPA (0% Fee)
                        </label>
                        <input
                          type="text"
                          value={upiIdInput}
                          onChange={(e) => setUpiIdInput(e.target.value)}
                          className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2 text-sm font-[family-name:var(--font-mono)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#556159] mb-1">
                          UPI Hold Expiry (Minutes)
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={120}
                          value={holdTtlInput}
                          onChange={(e) => setHoldTtlInput(Number(e.target.value))}
                          className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2 text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#556159] mb-1">
                          GST Percentage (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={28}
                          value={gstInput}
                          onChange={(e) => setGstInput(Number(e.target.value))}
                          className="w-full rounded-lg border border-[#E4E4E0] px-3 py-2 text-sm tabular-nums"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="rounded-lg bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#143326] cursor-pointer"
                    >
                      Save Payment Settings
                    </button>
                  </form>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.estates.map((estate) => (
                      <form
                        key={estate.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveEstateTariff(estate, new FormData(e.currentTarget));
                        }}
                        className="rounded-xl border border-[#E4E4E0] bg-white p-5 space-y-3"
                      >
                        <h3 className="font-[family-name:var(--font-display)] text-xl font-bold text-[#141C17]">
                          {estate.name}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="block text-[#556159] mb-1">Total Rooms</label>
                            <input
                              name="totalRooms"
                              type="number"
                              defaultValue={estate.totalRooms}
                              className="w-full rounded border border-[#E4E4E0] px-2 py-1.5 tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[#556159] mb-1">MAP Base (₹)</label>
                            <input
                              name="mapBaseRate"
                              type="number"
                              defaultValue={estate.mapBaseRate}
                              className="w-full rounded border border-[#E4E4E0] px-2 py-1.5 tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[#556159] mb-1">All Meals (₹)</label>
                            <input
                              name="allMealsBaseRate"
                              type="number"
                              defaultValue={estate.allMealsBaseRate}
                              className="w-full rounded border border-[#E4E4E0] px-2 py-1.5 tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[#556159] mb-1">Extra Adult MAP</label>
                            <input
                              name="extraAdultMapRate"
                              type="number"
                              defaultValue={estate.extraAdultMapRate}
                              className="w-full rounded border border-[#E4E4E0] px-2 py-1.5 tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[#556159] mb-1">Extra Adult All</label>
                            <input
                              name="extraAdultAllMealsRate"
                              type="number"
                              defaultValue={estate.extraAdultAllMealsRate}
                              className="w-full rounded border border-[#E4E4E0] px-2 py-1.5 tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[#556159] mb-1">Child 5-12 MAP</label>
                            <input
                              name="child5to12MapRate"
                              type="number"
                              defaultValue={estate.child5to12MapRate}
                              className="w-full rounded border border-[#E4E4E0] px-2 py-1.5 tabular-nums"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[#556159] mb-1">Child 5-12 All Meals</label>
                            <input
                              name="child5to12AllMealsRate"
                              type="number"
                              defaultValue={estate.child5to12AllMealsRate}
                              className="w-full rounded border border-[#E4E4E0] px-2 py-1.5 tabular-nums"
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="w-full rounded-lg border border-[#1B4332] px-3 py-2 text-xs font-semibold text-[#1B4332] hover:bg-[#F2F4F0] cursor-pointer"
                        >
                          Update Estate Tariffs
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              )}

              {/* AUDIT TAB */}
              {tab === 'audit' && (
                <div className="rounded-xl border border-[#E4E4E0] bg-white overflow-hidden">
                  <div className="border-b border-[#E4E4E0] px-5 py-4">
                    <h2 className="text-base font-bold text-[#141C17]">
                      System Audit &amp; Compliance Log
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#F2F4F0] text-[#556159]">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
                          <th className="px-4 py-3 text-left font-semibold">Actor</th>
                          <th className="px-4 py-3 text-left font-semibold">Action</th>
                          <th className="px-4 py-3 text-left font-semibold">Target</th>
                          <th className="px-4 py-3 text-left font-semibold">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E4E0]">
                        {data.auditLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-4 py-2.5 font-[family-name:var(--font-mono)] text-[#556159] whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-2.5 font-medium">{log.actor}</td>
                            <td className="px-4 py-2.5 font-[family-name:var(--font-mono)]">
                              {log.action}
                            </td>
                            <td className="px-4 py-2.5 font-[family-name:var(--font-mono)] text-[#1B4332]">
                              {log.targetRef}
                            </td>
                            <td className="px-4 py-2.5 text-[#556159]">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Inspect Payment Proof & Booking Details Modal */}
      {proofModalBooking && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#E4E4E0] bg-white p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-[family-name:var(--font-mono)] text-xs font-semibold text-[#1B4332]">
                  {proofModalBooking.bookingRef}
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold">
                  {proofModalBooking.guestName}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setProofModalBooking(null)}
                className="cursor-pointer p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-lg bg-[#FAFAF8] border border-[#E4E4E0] p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#556159]">Estate &amp; Plan</span>
                <span className="font-semibold">
                  {proofModalBooking.estateName} ({proofModalBooking.mealPlan})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#556159]">Stay Dates</span>
                <span className="font-[family-name:var(--font-mono)]">
                  {proofModalBooking.checkIn} → {proofModalBooking.checkOut}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#556159]">Amount</span>
                <span className="font-[family-name:var(--font-mono)] font-bold">
                  {formatInr(proofModalBooking.totalAmount)}
                </span>
              </div>
              {proofModalBooking.upiUtr && (
                <div className="flex justify-between">
                  <span className="text-[#556159]">Submitted UTR</span>
                  <span className="font-[family-name:var(--font-mono)] font-bold text-[#1B4332]">
                    {proofModalBooking.upiUtr}
                  </span>
                </div>
              )}
              {proofModalBooking.specialRequests && (
                <div className="pt-2 border-t border-[#E4E4E0]">
                  <span className="text-[#556159]">Requests: </span>
                  {proofModalBooking.specialRequests}
                </div>
              )}
            </div>

            {proofModalBooking.upiProofDataUrl ? (
              <div className="rounded-lg border border-[#E4E4E0] p-2 bg-[#FAFAF8]">
                <div className="text-xs font-semibold text-[#556159] mb-2">
                  Uploaded Payment Proof ({proofModalBooking.upiProofFileName || 'receipt'})
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proofModalBooking.upiProofDataUrl}
                  alt="Uploaded UPI Payment Proof"
                  className="max-h-60 w-full object-contain rounded"
                />
              </div>
            ) : (
              <p className="text-xs text-[#556159]">
                No screenshot attachment uploaded (verify UTR against corporate bank statement).
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProofModalBooking(null)}
                className="rounded-lg border border-[#E4E4E0] px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              {proofModalBooking.status === 'PENDING_VERIFICATION' && (
                <button
                  type="button"
                  onClick={async () => {
                    await runAdminAction(
                      {
                        type: 'BOOKING_STATUS',
                        bookingRef: proofModalBooking.bookingRef,
                        action: 'APPROVE_UPI',
                      },
                      `Approved UPI payment for ${proofModalBooking.bookingRef}.`
                    );
                    setProofModalBooking(null);
                  }}
                  className="rounded-lg bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#143326] cursor-pointer"
                >
                  Approve Payment &amp; Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Manual Desk Booking Modal */}
      {newBookingOpen && data && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <form
            onSubmit={handleCreateManualBooking}
            className="w-full max-w-lg rounded-xl border border-[#E4E4E0] bg-white p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold">
                New Confirmed Desk Booking
              </h3>
              <button
                type="button"
                aria-label="Close manual booking dialog"
                onClick={() => setNewBookingOpen(false)}
                className="cursor-pointer p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-[#556159] mb-1">Tea Estate</label>
                <select
                  value={manualEstateSlug}
                  onChange={(e) => {
                    setManualEstateSlug(e.target.value);
                    setManualRoomTypeId('');
                  }}
                  className="w-full rounded-lg border border-[#E4E4E0] bg-white px-3 py-2"
                >
                  {data.estates.map((e) => (
                    <option key={e.id} value={e.slug}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#556159] mb-1">Room Category</label>
                <select
                  value={manualRoomTypeId}
                  onChange={(e) => setManualRoomTypeId(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E4E0] bg-white px-3 py-2"
                >
                  <option value="">Any Available Room</option>
                  {(
                    data.estates.find((e) => e.slug === manualEstateSlug)?.roomCategories || []
                  )
                    .filter((rc) => rc.isActive)
                    .map((rc) => (
                      <option key={rc.id} value={rc.id}>
                        {rc.name} ({rc.totalUnits} units)
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#556159] mb-1">Check-in</label>
                <input
                  type="date"
                  required
                  value={manualCheckIn}
                  onChange={(e) => setManualCheckIn(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#556159] mb-1">Check-out</label>
                <input
                  type="date"
                  required
                  value={manualCheckOut}
                  onChange={(e) => setManualCheckOut(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#556159] mb-1">Rooms</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={manualRooms}
                  onChange={(e) => setManualRooms(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#556159] mb-1">Adults</label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={manualAdults}
                  onChange={(e) => setManualAdults(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#556159] mb-1">Meal Plan</label>
                <select
                  value={manualMealPlan}
                  onChange={(e) => setManualMealPlan(e.target.value as MealPlan)}
                  className="w-full rounded-lg border border-[#E4E4E0] bg-white px-2.5 py-2"
                >
                  <option value="MAP">MAP</option>
                  <option value="ALL_MEALS">All Meals</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#556159] mb-1">
                  Payment Ref / UTR
                </label>
                <input
                  type="text"
                  value={manualUtr}
                  onChange={(e) => setManualUtr(e.target.value)}
                  placeholder="DESK-CASH / UTR"
                  className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#556159] mb-1">Guest Name</label>
                <input
                  type="text"
                  required
                  value={manualGuestName}
                  onChange={(e) => setManualGuestName(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#556159] mb-1">Phone</label>
                <input
                  type="tel"
                  required
                  value={manualGuestPhone}
                  onChange={(e) => setManualGuestPhone(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-semibold text-[#556159] mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={manualGuestEmail}
                  onChange={(e) => setManualGuestEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E4E0] px-2.5 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewBookingOpen(false)}
                className="rounded-lg border border-[#E4E4E0] px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#143326] cursor-pointer"
              >
                Create Confirmed Booking
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

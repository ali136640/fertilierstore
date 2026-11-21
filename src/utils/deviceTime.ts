import { useState, useEffect } from 'react';

export function formatDeviceTime(date: Date = new Date(), withSeconds = false): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      ...(withSeconds ? { second: '2-digit' } : {}),
      hour12: false,
    }).format(date);
  } catch {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return withSeconds ? `${h}:${m}:${s}` : `${h}:${m}`;
  }
}

export function formatDeviceDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleDateString('fa-IR');
  }
}

export function formatDeviceWeekdayDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
  } catch {
    return date.toLocaleDateString('fa-IR');
  }
}

export function formatDeviceDateTime(date: Date = new Date()): string {
  return `${formatDeviceTime(date)} - ${formatDeviceDate(date)}`;
}

function toAsciiNumDigits(str: string): string {
  return String(str || '')
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632 + 48));
}

export function buildClientTelegramFileStamp(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (t: string) => toAsciiNumDigits(parts.find((p) => p.type === t)?.value || '');
    const y = get('year').padStart(4, '0');
    const m = get('month').padStart(2, '0');
    const d = get('day').padStart(2, '0');
    const hh = get('hour').replace('24', '00').padStart(2, '0');
    const mm = get('minute').padStart(2, '0');
    const ss = get('second').padStart(2, '0');
    if (y.length === 4 && m && d) {
      return `${y}${m}${d}-${hh}${mm}${ss}`;
    }
  } catch {
    // fallback below
  }
  const yyyy = String(date.getFullYear()).padStart(4, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const da = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${mo}${da}-${hh}${mi}${ss}`;
}

export function formatClientBackupDateTimeLabel(date: Date = new Date()): string {
  return `${formatDeviceTime(date, true)} - ${formatDeviceDate(date)}`;
}

export function useDeviceClock(tickMs = 1000) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => {
      setNow(new Date());
    }, tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  return {
    now,
    timeStr: formatDeviceTime(now, false),
    timeWithSecStr: formatDeviceTime(now, true),
    dateStr: formatDeviceDate(now),
    weekdayDateStr: formatDeviceWeekdayDate(now),
  };
}

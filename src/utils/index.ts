import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: any) {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleString();
}

export function isUserOnline(lastActive: any): boolean {
  if (!lastActive) return false;
  
  let date: Date;
  if (typeof lastActive.toDate === 'function') {
    date = lastActive.toDate();
  } else if (lastActive instanceof Date) {
    date = lastActive;
  } else if (typeof lastActive === 'number') {
    date = new Date(lastActive);
  } else if (typeof lastActive === 'string') {
    date = new Date(lastActive);
  } else if (lastActive.seconds) { // protobuf timestamp
    date = new Date(lastActive.seconds * 1000);
  } else {
    return false;
  }
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  // Active if timestamp is within the last 2 minutes. We use Math.abs to gracefully
  // tolerate local vs server clock differences (averting false offlines due to time skews)
  return Math.abs(diffMs) < 2 * 60 * 1000;
}

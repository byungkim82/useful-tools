import type { ComponentType } from 'react';
import type { Dictionary } from '@/i18n/dictionaries'; // type-only → no server-only runtime pulled in
import type { Locale } from '@/i18n/config';

type Slug = keyof Dictionary['tools'];

export type ToolProps<S extends Slug = Slug> = {
  t: Dictionary['tools'][S];
  common: Dictionary['common'];
  locale: Locale;
};

// Distributive mapped type: each entry's load() is checked against ITS OWN slug's dict slice.
// (A plain ComponentType<union-props> compiles at N=1 by accident, then breaks EVERY tool at N=2
// due to props contravariance.)
export type ToolMeta = {
  [S in Slug]: {
    slug: S;
    category: keyof Dictionary['categories'];
    icon: string;
    keywords: string[];
    load: () => Promise<{ default: ComponentType<ToolProps<S>> }>;
  };
}[Slug];

export const tools: ToolMeta[] = [
  {
    slug: 'qr',
    category: 'generator',
    icon: '🔳',
    keywords: ['qr', 'qrcode', 'qr코드', '큐알', '큐알코드'],
    load: () => import('@/tools/qr/QrToolClient'),
  },
  {
    slug: 'wifi-qr-code',
    category: 'generator',
    icon: '📶',
    keywords: ['wifi', 'wifi qr', 'qr', '와이파이', '와이파이 qr', '와이파이 큐알'],
    load: () => import('@/tools/qr/WifiQrClient'),
  },
  {
    slug: 'vcard-qr-code',
    category: 'generator',
    icon: '📇',
    keywords: ['vcard', 'contact', 'qr', '명함', '연락처', 'vcard qr'],
    load: () => import('@/tools/qr/VCardQrClient'),
  },
  {
    slug: 'email-qr-code',
    category: 'generator',
    icon: '✉️',
    keywords: ['email', 'mailto', 'qr', '이메일', '메일', '이메일 qr'],
    load: () => import('@/tools/qr/EmailQrClient'),
  },
  {
    slug: 'sms-qr-code',
    category: 'generator',
    icon: '💬',
    keywords: ['sms', 'text', 'message', 'qr', '문자', '문자메시지'],
    load: () => import('@/tools/qr/SmsQrClient'),
  },
  {
    slug: 'phone-qr-code',
    category: 'generator',
    icon: '📞',
    keywords: ['phone', 'call', 'tel', 'qr', '전화', '전화번호'],
    load: () => import('@/tools/qr/PhoneQrClient'),
  },
  {
    slug: 'whatsapp-qr-code',
    category: 'generator',
    icon: '🟢',
    keywords: ['whatsapp', 'wa', 'chat', 'qr', '왓츠앱'],
    load: () => import('@/tools/qr/WhatsAppQrClient'),
  },
  {
    slug: 'location-qr-code',
    category: 'generator',
    icon: '📍',
    keywords: ['location', 'geo', 'map', 'gps', 'qr', '위치', '지도'],
    load: () => import('@/tools/qr/LocationQrClient'),
  },
  {
    slug: 'event-qr-code',
    category: 'generator',
    icon: '📅',
    keywords: ['event', 'calendar', 'ics', 'qr', '이벤트', '캘린더', '일정'],
    load: () => import('@/tools/qr/EventQrClient'),
  },
];

export function getTool(slug: string): ToolMeta | undefined {
  return tools.find((t) => t.slug === slug);
}

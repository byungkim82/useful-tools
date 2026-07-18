import type { ComponentType } from 'react';
import type { Dictionary } from '@/i18n/dictionaries'; // type-only → no server-only runtime pulled in
import type { Locale } from '@/i18n/config';

type Slug = keyof Dictionary['tools'];

export type ToolProps<S extends Slug = Slug> = {
  slug: string; // raw URL slug — lets a shared component (e.g. the converter) pick its variant
  t: Dictionary['tools'][S];
  common: Dictionary['common'];
  locale: Locale;
};

// Distributive mapped type: each entry's load() is checked against ITS OWN slug's dict slice.
// (A plain ComponentType<union-props> compiles at N=1 by accident, then breaks EVERY tool at N=2
// due to props contravariance.)
// `group` clusters variants of one tool (all the QR content types share group 'qr'); `primary` marks
// the one card that represents the group on the home grid. Every tool still gets its own route,
// sitemap entry, and SEO landing page — grouping only affects home-grid and in-tool navigation.
export type ToolMeta = {
  [S in Slug]: {
    slug: S;
    category: keyof Dictionary['categories'];
    icon: string;
    keywords: string[];
    group?: string;
    primary?: boolean;
    load: () => Promise<{ default: ComponentType<ToolProps<S>> }>;
  };
}[Slug];

export const tools: ToolMeta[] = [
  {
    slug: 'qr',
    category: 'generator',
    icon: '🔳',
    keywords: ['qr', 'qrcode', 'qr코드', '큐알', '큐알코드'],
    group: 'qr',
    primary: true,
    load: () => import('@/tools/qr/QrToolClient'),
  },
  {
    slug: 'wifi-qr-code',
    category: 'generator',
    icon: '📶',
    keywords: ['wifi', 'wifi qr', 'qr', '와이파이', '와이파이 qr', '와이파이 큐알'],
    group: 'qr',
    load: () => import('@/tools/qr/WifiQrClient'),
  },
  {
    slug: 'vcard-qr-code',
    category: 'generator',
    icon: '📇',
    keywords: ['vcard', 'contact', 'qr', '명함', '연락처', 'vcard qr'],
    group: 'qr',
    load: () => import('@/tools/qr/VCardQrClient'),
  },
  {
    slug: 'email-qr-code',
    category: 'generator',
    icon: '✉️',
    keywords: ['email', 'mailto', 'qr', '이메일', '메일', '이메일 qr'],
    group: 'qr',
    load: () => import('@/tools/qr/EmailQrClient'),
  },
  {
    slug: 'sms-qr-code',
    category: 'generator',
    icon: '💬',
    keywords: ['sms', 'text', 'message', 'qr', '문자', '문자메시지'],
    group: 'qr',
    load: () => import('@/tools/qr/SmsQrClient'),
  },
  {
    slug: 'phone-qr-code',
    category: 'generator',
    icon: '📞',
    keywords: ['phone', 'call', 'tel', 'qr', '전화', '전화번호'],
    group: 'qr',
    load: () => import('@/tools/qr/PhoneQrClient'),
  },
  {
    slug: 'whatsapp-qr-code',
    category: 'generator',
    icon: '🟢',
    keywords: ['whatsapp', 'wa', 'chat', 'qr', '왓츠앱'],
    group: 'qr',
    load: () => import('@/tools/qr/WhatsAppQrClient'),
  },
  {
    slug: 'location-qr-code',
    category: 'generator',
    icon: '📍',
    keywords: ['location', 'geo', 'map', 'gps', 'qr', '위치', '지도'],
    group: 'qr',
    load: () => import('@/tools/qr/LocationQrClient'),
  },
  {
    slug: 'event-qr-code',
    category: 'generator',
    icon: '📅',
    keywords: ['event', 'calendar', 'ics', 'qr', '이벤트', '캘린더', '일정'],
    group: 'qr',
    load: () => import('@/tools/qr/EventQrClient'),
  },

  // Unit converters — all 8 load the one shared ConverterClient, which picks its category from the slug.
  // `length-converter` is the group's primary (its card represents the suite on the home grid); the rest
  // surface via the in-tool ConverterTypeNav.
  {
    slug: 'length-converter', category: 'converter', icon: '📏',
    keywords: ['length', 'distance', 'cm', 'inch', 'feet', 'meter', 'mile', '길이', '거리', '단위 변환'],
    group: 'converter', primary: true, load: () => import('@/tools/convert/ConverterClient'),
  },
  {
    slug: 'weight-converter', category: 'converter', icon: '⚖️',
    keywords: ['weight', 'mass', 'kg', 'pound', 'lbs', 'ounce', '무게', '질량', '근', '돈'],
    group: 'converter', load: () => import('@/tools/convert/ConverterClient'),
  },
  {
    slug: 'temperature-converter', category: 'converter', icon: '🌡️',
    keywords: ['temperature', 'celsius', 'fahrenheit', 'kelvin', '온도', '섭씨', '화씨'],
    group: 'converter', load: () => import('@/tools/convert/ConverterClient'),
  },
  {
    slug: 'area-converter', category: 'converter', icon: '📐',
    keywords: ['area', 'square', 'pyeong', 'tsubo', 'acre', 'hectare', '넓이', '평', '제곱미터'],
    group: 'converter', load: () => import('@/tools/convert/ConverterClient'),
  },
  {
    slug: 'volume-converter', category: 'converter', icon: '🧪',
    keywords: ['volume', 'liter', 'gallon', 'cup', 'ml', '부피', '리터', '컵', '밀리리터'],
    group: 'converter', load: () => import('@/tools/convert/ConverterClient'),
  },
  {
    slug: 'speed-converter', category: 'converter', icon: '🚀',
    keywords: ['speed', 'kmh', 'mph', 'knot', 'ms', '속도', '시속'],
    group: 'converter', load: () => import('@/tools/convert/ConverterClient'),
  },
  {
    slug: 'time-converter', category: 'converter', icon: '⏱️',
    keywords: ['time', 'seconds', 'minutes', 'hours', 'days', '시간', '초', '분'],
    group: 'converter', load: () => import('@/tools/convert/ConverterClient'),
  },
  {
    slug: 'data-converter', category: 'converter', icon: '💾',
    keywords: ['data', 'storage', 'bytes', 'MB', 'GB', 'KiB', '디지털', '용량', '바이트'],
    group: 'converter', load: () => import('@/tools/convert/ConverterClient'),
  },

  // Image compressor — all three slugs load the one shared ImageCompressorClient, which reads the slug
  // to pick the default output format (auto / jpeg / webp). `image-compressor` is the group's primary
  // (its card represents the suite on the home grid); the rest surface via the in-tool ImageTypeNav.
  {
    slug: 'image-compressor', category: 'image', icon: '🖼️',
    keywords: ['image', 'compress', 'photo', 'shrink', 'reduce size', '이미지', '사진', '용량', '압축', '리사이즈'],
    group: 'image', primary: true, load: () => import('@/tools/image/ImageCompressorClient'),
  },
  {
    slug: 'compress-jpg', category: 'image', icon: '🏞️',
    keywords: ['jpg', 'jpeg', 'compress jpg', 'reduce jpeg', '제이피지', 'jpg 압축', '사진 용량'],
    group: 'image', load: () => import('@/tools/image/ImageCompressorClient'),
  },
  {
    slug: 'compress-webp', category: 'image', icon: '🌐',
    keywords: ['webp', 'convert to webp', 'compress webp', '웹피', 'webp 변환', 'webp 압축'],
    group: 'image', load: () => import('@/tools/image/ImageCompressorClient'),
  },
];

export function getTool(slug: string): ToolMeta | undefined {
  return tools.find((t) => t.slug === slug);
}

// One card per group (its primary) plus any ungrouped tools — what the home grid shows.
export function homeTools(): ToolMeta[] {
  return tools.filter((t) => !t.group || t.primary);
}

// All variants sharing a group — used for the in-tool type switcher.
export function groupTools(group: string): ToolMeta[] {
  return tools.filter((t) => t.group === group);
}

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';

export default function LocaleSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const switchTo = (loc: Locale) => {
    const segs = pathname.split('/'); // ['', 'ko', 'tools', 'qr']
    segs[1] = loc;                    // swap the locale segment, preserve the rest
    router.push(segs.join('/') || `/${loc}`);
  };
  return (
    <div className="flex gap-1 text-sm">
      {locales.map((l) => (
        <button key={l} type="button" onClick={() => switchTo(l)} disabled={l === current}
                aria-current={l === current ? 'true' : undefined}
                className={l === current ? 'font-semibold underline' : 'text-neutral-500 hover:text-neutral-900'}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

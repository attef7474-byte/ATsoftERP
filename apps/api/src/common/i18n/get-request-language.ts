import { Request } from 'express';

export function getRequestLanguage(req: Request): string {
  const xLocale = req.headers['x-locale'];
  if (xLocale && typeof xLocale === 'string') {
    const lang = xLocale.toLowerCase();
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('ar')) return 'ar';
  }

  const acceptLanguage = req.headers['accept-language'];
  if (acceptLanguage && typeof acceptLanguage === 'string') {
    const primary = acceptLanguage.split(',')[0].trim().toLowerCase();
    if (primary.startsWith('en')) return 'en';
    if (primary.startsWith('ar')) return 'ar';
  }

  return 'ar';
}

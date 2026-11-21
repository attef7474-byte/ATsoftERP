/** Safe display normalization only; Arabic letters keep their exact spelling. */
export const normalizePersonName = (value: string) => value.trim().replace(/\s+/gu, ' ');
export const isFullPersonName = (value: string) => normalizePersonName(value).split(' ').filter(Boolean).length >= 4;
export const isLocalYemenPhone = (value: string) => value === '' || /^[0-9]{9}$/.test(value);
export function localYemenPhone(value: string | null | undefined) {
  if (!value) return '';
  return /^(?:\+967|00967)[0-9]{9}$/.test(value) ? value.slice(-9) : value;
}

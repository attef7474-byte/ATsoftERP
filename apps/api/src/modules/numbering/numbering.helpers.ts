export function extractSequenceNumber(generatedNumber: string, prefix: string, suffix?: string): string {
  return generatedNumber.replace(prefix, '').replace(suffix || '', '');
}

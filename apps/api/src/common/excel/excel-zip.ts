import { BadRequestException } from '@nestjs/common';
import { inflateRawSync } from 'node:zlib';
import { EXCEL_LIMITS } from './excel.types';

export function excelFailure(key: string): BadRequestException { return new BadRequestException({ messageKey: `validation.${key}`, message: `validation.${key}` }); }
const invalid = () => excelFailure('excelInvalidWorkbook');
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Inspect and bounded-inflate before ExcelJS can allocate worksheet/shared-string objects. No extraction. */
export function assertSafeXlsxZip(buffer: Buffer): void {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22 || buffer.length > EXCEL_LIMITS.fileBytes) throw excelFailure('excelFileLimit');
  let end = -1;
  for (let at = buffer.length - 22; at >= Math.max(0, buffer.length - 65557); at--) {
    if (buffer.readUInt32LE(at) === 0x06054b50 && at + 22 + buffer.readUInt16LE(at + 20) === buffer.length) { end = at; break; }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) throw invalid();
  const count = buffer.readUInt16LE(end + 10), size = buffer.readUInt32LE(end + 12), start = buffer.readUInt32LE(end + 16);
  if (!count || count > EXCEL_LIMITS.zipEntries || buffer.readUInt16LE(end + 8) !== count || start + size !== end) throw invalid();
  let at = start, total = 0; const names = new Set<string>(), ranges: Array<[number, number]> = [];
  for (let index = 0; index < count; index++) {
    if (at + 46 > end || buffer.readUInt32LE(at) !== 0x02014b50) throw invalid();
    const flags = buffer.readUInt16LE(at + 8), method = buffer.readUInt16LE(at + 10), checksum = buffer.readUInt32LE(at + 16);
    const compressed = buffer.readUInt32LE(at + 20), inflated = buffer.readUInt32LE(at + 24), nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30), commentLength = buffer.readUInt16LE(at + 32), offset = buffer.readUInt32LE(at + 42);
    if (at + 46 + nameLength + extraLength + commentLength > end || (flags & 1) || ![0, 8].includes(method) || buffer.readUInt16LE(at + 34) !== 0) throw invalid();
    const name = buffer.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    if (!name || name.includes('\uFFFD') || name.includes('\\') || name.startsWith('/') || name.includes(':') || name.split('/').some(p => p === '..' || p === '.') || names.has(name.toLowerCase())) throw invalid();
    if (/vbaProject|externalLinks|activeX|embeddings|\.bin$/i.test(name)) throw invalid();
    names.add(name.toLowerCase());
    if (inflated === 0xffffffff || compressed === 0xffffffff || offset === 0xffffffff || inflated > 4 * 1024 * 1024 || inflated > Math.max(1, compressed) * 100 || (total += inflated) > EXCEL_LIMITS.inflatedBytes) throw excelFailure('excelFileLimit');
    if (offset + 30 > start || buffer.readUInt32LE(offset) !== 0x04034b50 || buffer.readUInt16LE(offset + 6) !== flags || buffer.readUInt16LE(offset + 8) !== method) throw invalid();
    const localNameLength = buffer.readUInt16LE(offset + 26), localExtraLength = buffer.readUInt16LE(offset + 28), dataStart = offset + 30 + localNameLength + localExtraLength;
    if (buffer.subarray(offset + 30, offset + 30 + localNameLength).toString('utf8') !== name || dataStart + compressed > start || ranges.some(([left, right]) => offset < right && dataStart + compressed > left)) throw invalid();
    ranges.push([offset, dataStart + compressed]);
    let bytes: Buffer;
    try { bytes = method === 0 ? buffer.subarray(dataStart, dataStart + compressed) : inflateRawSync(buffer.subarray(dataStart, dataStart + compressed), { maxOutputLength: Math.min(4 * 1024 * 1024, EXCEL_LIMITS.inflatedBytes - total + inflated) }); }
    catch { throw excelFailure('excelInvalidWorkbook'); }
    if (bytes.length !== inflated || crc32(bytes) !== checksum) throw invalid();
    if (/\.(xml|rels)$/i.test(name)) {
      const xml = bytes.toString('utf8');
      if (/<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External["']/i.test(xml)) throw invalid();
      if (/xl\/worksheets\/sheet\d+\.xml$/i.test(name)) {
        for (const match of xml.matchAll(/\bref="([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?"/g)) {
          for (const letters of [match[1], match[3]].filter(Boolean)) { let column = 0; for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64; if (column > EXCEL_LIMITS.columns) throw excelFailure('excelRowLimit'); }
          if (Number(match[2]) > 1001 || Number(match[4] || 0) > 1001) throw excelFailure('excelRowLimit');
        }
        const cells = xml.match(/<c\b/g) || []; if (cells.length > 1001 * EXCEL_LIMITS.columns) throw excelFailure('excelRowLimit');
        for (const match of xml.matchAll(/\br="([A-Z]+)(\d+)"/g)) {
          let column = 0; for (const letter of match[1]) column = column * 26 + letter.charCodeAt(0) - 64;
          if (column > EXCEL_LIMITS.columns || Number(match[2]) > 1001) throw excelFailure('excelRowLimit');
        }
        for (const match of xml.matchAll(/<row\b[^>]*\br="(\d+)"/g)) if (Number(match[1]) > 1001) throw excelFailure('excelRowLimit');
      }
    }
    at += 46 + nameLength + extraLength + commentLength;
  }
  if (at !== end || !names.has('[content_types].xml') || !names.has('xl/workbook.xml')) throw invalid();
}

import * as JSZip from 'jszip';

/** Декод основных XML-сущностей. */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

/** Извлекает плоский текст из .docx (word/document.xml внутри zip-контейнера). */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('Некорректный .docx: не найден word/document.xml');
  let xml = await entry.async('string');
  xml = xml
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '');
  return normalizeText(decodeEntities(xml));
}

/** Убирает лишние пустые строки и хвостовые пробелы. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => l.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

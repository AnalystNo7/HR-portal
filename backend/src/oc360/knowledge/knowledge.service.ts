import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_METHODOLOGY, KnowledgeDocInput, MAX_CONTEXT_CHARS, TECHNICAL_PROMPT } from '../report/report.prompt';
import { extractDocxText, normalizeText } from './docx';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 МБ

export interface KnowledgeDocView {
  id: string;
  name: string;
  charCount: number;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class KnowledgeService {
  constructor(private prisma: PrismaService) {}

  // ─── Документы ────────────────────────────────

  async list() {
    const docs = await this.prisma.knowledgeDoc.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, charCount: true, isActive: true, createdAt: true },
    });
    const activeChars = docs.filter(d => d.isActive).reduce((s, d) => s + d.charCount, 0);
    return { docs, activeChars, maxContextChars: MAX_CONTEXT_CHARS };
  }

  async upload(file: Express.Multer.File, uploadedById: string | null): Promise<KnowledgeDocView> {
    if (!file) throw new BadRequestException('Файл не передан');
    if (file.size > MAX_FILE_BYTES) throw new BadRequestException('Файл больше 10 МБ');

    const name = Buffer.from(file.originalname, 'latin1').toString('utf8'); // multer отдаёт имя в latin1
    const lower = name.toLowerCase();
    let text: string;
    if (lower.endsWith('.docx')) {
      try {
        text = await extractDocxText(file.buffer);
      } catch (e: any) {
        throw new BadRequestException(`Не удалось разобрать .docx: ${e?.message ?? 'ошибка'}`);
      }
    } else if (lower.endsWith('.txt') || lower.endsWith('.md')) {
      text = normalizeText(file.buffer.toString('utf8'));
    } else {
      throw new BadRequestException('Поддерживаются файлы .docx, .txt и .md');
    }
    if (!text.trim()) throw new BadRequestException('В файле не найден текст');

    const doc = await this.prisma.knowledgeDoc.create({
      data: { name, mimeType: file.mimetype ?? null, text, charCount: text.length, uploadedById },
      select: { id: true, name: true, charCount: true, isActive: true, createdAt: true },
    });
    return doc;
  }

  async getText(id: string) {
    const doc = await this.prisma.knowledgeDoc.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Документ не найден');
    return { id: doc.id, name: doc.name, text: doc.text };
  }

  async update(id: string, dto: { isActive?: boolean; name?: string }) {
    const exists = await this.prisma.knowledgeDoc.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Документ не найден');
    return this.prisma.knowledgeDoc.update({
      where: { id },
      data: {
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.name?.trim() ? { name: dto.name.trim() } : {}),
      },
      select: { id: true, name: true, charCount: true, isActive: true, createdAt: true },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.knowledgeDoc.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Документ не найден');
    await this.prisma.knowledgeDoc.delete({ where: { id } });
    return { success: true };
  }

  // ─── Системный промпт (методическая часть) ───

  async getPrompt() {
    const row = await this.prisma.reportPrompt.findUnique({ where: { id: 'default' } });
    const custom = row?.text?.trim() || null;
    return { text: custom, defaultText: DEFAULT_METHODOLOGY, technicalText: TECHNICAL_PROMPT, isCustom: custom != null };
  }

  /** text=null или пустой — сброс к стандартной методике. */
  async savePrompt(text: string | null, updatedById: string | null) {
    const value = text?.trim() || null;
    await this.prisma.reportPrompt.upsert({
      where: { id: 'default' },
      create: { id: 'default', text: value, updatedById },
      update: { text: value, updatedById },
    });
    return this.getPrompt();
  }

  // ─── Контекст для генерации отчёта ────────────

  async getGenerationContext(): Promise<{ methodology: string; docs: KnowledgeDocInput[] }> {
    const [prompt, docs] = await Promise.all([
      this.getPrompt(),
      this.prisma.knowledgeDoc.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { name: true, text: true },
      }),
    ]);
    return { methodology: prompt.text ?? prompt.defaultText, docs };
  }
}

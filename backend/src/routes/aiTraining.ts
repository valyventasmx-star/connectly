import { Router, Response } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

// GET /ai-training — list training documents
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const docs = await prisma.trainingDocument.findMany({
      where: { workspaceId: req.params.workspaceId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, fileType: true, tokens: true, active: true, createdAt: true, updatedAt: true },
    });
    res.json(docs);
  } catch {
    res.status(500).json({ error: 'Failed to fetch training documents' });
  }
});

// POST /ai-training/text — add plain text document
router.post('/text', async (req: AuthRequest, res: Response) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content required' });
    const doc = await prisma.trainingDocument.create({
      data: {
        title,
        content,
        fileType: 'manual',
        tokens: content.split(/\s+/).length,
        workspaceId: req.params.workspaceId,
      },
    });
    res.status(201).json(doc);
  } catch {
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// POST /ai-training/upload — upload a text/markdown file
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const content = req.file.buffer.toString('utf-8');
    const title = req.file.originalname;
    const ext = title.split('.').pop()?.toLowerCase() || 'txt';
    const doc = await prisma.trainingDocument.create({
      data: {
        title,
        content,
        fileType: ext,
        tokens: content.split(/\s+/).length,
        workspaceId: req.params.workspaceId,
      },
    });
    res.status(201).json(doc);
  } catch {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// POST /ai-training/url — scrape a URL's text content
router.post('/url', async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    const axios = (await import('axios')).default;
    const html = (await axios.get(url, { timeout: 10000 })).data as string;

    // Basic HTML → text stripping
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .substring(0, 50000); // cap at 50k chars

    const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || url).trim();

    const doc = await prisma.trainingDocument.create({
      data: {
        title,
        content: text,
        fileType: 'url',
        fileUrl: url,
        tokens: text.split(/\s+/).length,
        workspaceId: req.params.workspaceId,
      },
    });
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch URL' });
  }
});

// PATCH /ai-training/:id — toggle active or update title
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { active, title } = req.body;
    const data: any = {};
    if (active !== undefined) data.active = active;
    if (title !== undefined) data.title = title;
    const doc = await prisma.trainingDocument.update({ where: { id: req.params.id }, data });
    res.json(doc);
  } catch {
    res.status(500).json({ error: 'Update failed' });
  }
});

// DELETE /ai-training/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.trainingDocument.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// POST /ai-training/test — test AI with training context
router.post('/test', async (req: AuthRequest, res: Response) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'AI not configured' });
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'question required' });

    const docs = await prisma.trainingDocument.findMany({
      where: { workspaceId: req.params.workspaceId, active: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const context = buildRagContext(docs, question);
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `You are a helpful customer support assistant. Answer questions using ONLY the information provided in the knowledge context below. If the answer is not in the context, say so honestly.\n\n${context}`,
      messages: [{ role: 'user', content: question }],
    });

    res.json({ answer: (response.content[0] as any).text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: build RAG context string from training docs (keyword relevance)
export function buildRagContext(docs: any[], query?: string): string {
  if (!docs.length) return 'No training data available.';

  let relevant = docs;
  if (query) {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    relevant = docs
      .map(d => ({
        ...d,
        score: words.reduce((acc, w) =>
          acc + (d.content.toLowerCase().includes(w) ? 1 : 0) +
                (d.title.toLowerCase().includes(w) ? 2 : 0), 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } else {
    relevant = docs.slice(0, 5);
  }

  return relevant
    .map(d => `### ${d.title}\n${d.content.substring(0, 3000)}`)
    .join('\n\n---\n\n');
}

export default router;

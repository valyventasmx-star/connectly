import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

// List articles
router.get('/', async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  const articles = await prisma.knowledgeArticle.findMany({
    where: {
      workspaceId: req.params.workspaceId,
      ...(q ? {
        OR: [
          { title: { contains: String(q), mode: 'insensitive' } },
          { content: { contains: String(q), mode: 'insensitive' } },
        ],
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(articles);
});

// Create article
router.post('/', async (req: AuthRequest, res: Response) => {
  const { title, content, category } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  const article = await prisma.knowledgeArticle.create({
    data: { title, content, category, workspaceId: req.params.workspaceId },
  });
  res.json(article);
});

// Update article
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { title, content, category } = req.body;
  const article = await prisma.knowledgeArticle.update({
    where: { id: req.params.id },
    data: { title, content, category },
  });
  res.json(article);
});

// Delete article
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await prisma.knowledgeArticle.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// AI-powered search for KB
router.post('/ai-search', async (req: AuthRequest, res: Response) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  const articles = await prisma.knowledgeArticle.findMany({
    where: { workspaceId: req.params.workspaceId },
  });
  if (articles.length === 0) return res.json({ answer: null, articles: [] });

  // Simple keyword search first to find relevant articles
  const q = query.toLowerCase();
  const relevant = articles.filter(a =>
    a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
  ).slice(0, 5);

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ answer: null, articles: relevant });
  }

  try {
    const context = (relevant.length > 0 ? relevant : articles.slice(0, 5))
      .map(a => `## ${a.title}\n${a.content}`)
      .join('\n\n');

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Based on this knowledge base, answer the question concisely. If the answer isn't in the knowledge base, say so.\n\nKnowledge Base:\n${context}\n\nQuestion: ${query}`,
      }],
    });
    res.json({ answer: (response.content[0] as any).text, articles: relevant });
  } catch (err: any) {
    res.json({ answer: null, articles: relevant });
  }
});

export default router;

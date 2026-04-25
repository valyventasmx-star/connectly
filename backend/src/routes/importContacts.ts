import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const router = Router({ mergeParams: true });
router.use(authenticate, requireWorkspace());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/import', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const csv = req.file.buffer.toString('utf-8');
    const records: any[] = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) return res.status(400).json({ error: 'CSV file is empty' });
    if (records.length > 5000) return res.status(400).json({ error: 'Max 5000 contacts per import' });

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const row of records) {
      try {
        // Normalize column names (case-insensitive)
        const get = (keys: string[]) => {
          for (const k of keys) {
            const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
            if (found && row[found]) return row[found];
          }
          return undefined;
        };

        const name = get(['name', 'full name', 'fullname', 'contact name']) || 'Unknown';
        const phone = get(['phone', 'phone number', 'mobile', 'tel']);
        const email = get(['email', 'email address']);
        const company = get(['company', 'organization', 'company name']);
        const notes = get(['notes', 'note', 'description']);
        const lifecycleStage = get(['lifecycle', 'lifecycle stage', 'stage']) || 'new_lead';

        if (!phone && !email) { failed++; continue; }

        // Check existing by phone or email
        const existing = await prisma.contact.findFirst({
          where: {
            workspaceId: req.params.workspaceId,
            OR: [
              ...(phone ? [{ phone }] : []),
              ...(email ? [{ email }] : []),
            ],
          },
        });

        if (existing) {
          await prisma.contact.update({
            where: { id: existing.id },
            data: { name, company, notes, lifecycleStage },
          });
          updated++;
        } else {
          await prisma.contact.create({
            data: { name, phone, email, company, notes, lifecycleStage, workspaceId: req.params.workspaceId },
          });
          created++;
        }
      } catch {
        failed++;
      }
    }

    res.json({ total: records.length, created, updated, failed });
  } catch (err: any) {
    res.status(400).json({ error: 'Invalid CSV: ' + err.message });
  }
});

export default router;

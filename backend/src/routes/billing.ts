import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireWorkspace, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    channels: 1,
    contacts: 100,
    members: 2,
    aiEnabled: false,
    conversationsPerMonth: 500,
  },
  pro: {
    name: 'Pro',
    price: 29,
    channels: 5,
    contacts: 2000,
    members: 10,
    aiEnabled: true,
    conversationsPerMonth: 5000,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
  },
  agency: {
    name: 'Agency',
    price: 99,
    channels: -1, // unlimited
    contacts: -1,
    members: -1,
    aiEnabled: true,
    conversationsPerMonth: -1,
    stripePriceId: process.env.STRIPE_AGENCY_PRICE_ID,
  },
};

// Get plans info (public)
router.get('/plans', (_req: Request, res: Response) => {
  res.json(PLANS);
});

// Get current workspace billing info
router.get('/:workspaceId/billing', authenticate, requireWorkspace(), async (req: AuthRequest, res: Response) => {
  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const plan = PLANS[workspace.plan as keyof typeof PLANS] || PLANS.free;

  // Count usage
  const [channels, contacts, members] = await Promise.all([
    prisma.channel.count({ where: { workspaceId: workspace.id } }),
    prisma.contact.count({ where: { workspaceId: workspace.id } }),
    prisma.workspaceMember.count({ where: { workspaceId: workspace.id } }),
  ]);

  res.json({
    plan: workspace.plan,
    planDetails: plan,
    usage: { channels, contacts, members },
    stripeCustomerId: workspace.stripeCustomerId,
    stripeSubscriptionId: workspace.stripeSubscriptionId,
    planExpiresAt: workspace.planExpiresAt,
  });
});

// Create Stripe checkout session
router.post('/:workspaceId/billing/checkout', authenticate, requireWorkspace(), async (req: AuthRequest, res: Response) => {
  const { planName } = req.body;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(400).json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to environment variables.' });
  }

  const plan = PLANS[planName as keyof typeof PLANS];
  if (!plan || plan.price === 0) return res.status(400).json({ error: 'Invalid plan' });
  if (!(plan as any).stripePriceId) return res.status(400).json({ error: 'Stripe price ID not configured for this plan' });

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });

    const workspace = req.workspace;
    let customerId = workspace.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user!.email,
        name: workspace.name,
        metadata: { workspaceId: workspace.id },
      });
      customerId = customer.id;
      await prisma.workspace.update({ where: { id: workspace.id }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: (plan as any).stripePriceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/billing?success=true&workspace=${workspace.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
      metadata: { workspaceId: workspace.id, planName },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create portal session (manage subscription)
router.post('/:workspaceId/billing/portal', authenticate, requireWorkspace(), async (req: AuthRequest, res: Response) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(400).json({ error: 'Stripe not configured' });

  const workspace = req.workspace;
  if (!workspace.stripeCustomerId) return res.status(400).json({ error: 'No billing account found' });

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });

    const session = await stripe.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/billing`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe webhook
router.post('/stripe-webhook', async (req: Request, res: Response) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send('Stripe not configured');
  }

  const sig = req.headers['stripe-signature'] as string;

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const { workspaceId, planName } = session.metadata;
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            plan: planName,
            stripeSubscriptionId: session.subscription,
            aiEnabled: planName !== 'free',
          },
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        await prisma.workspace.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { plan: 'free', stripeSubscriptionId: null, aiEnabled: false },
        });
        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    res.status(400).send(`Webhook error: ${err.message}`);
  }
});

export default router;

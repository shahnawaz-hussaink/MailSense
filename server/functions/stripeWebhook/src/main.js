import Stripe from 'stripe';
import { Query } from 'node-appwrite';
import { serverDb, DB_ID, COL_USERS, COL_SUBS } from '../../../shared/serverDb.js';

/**
 * stripeWebhook — HTTP Appwrite Function
 *
 * Receives Stripe events and keeps our `subscriptions` + `users` collections
 * in sync with the authoritative Stripe state.
 *
 * Handled events:
 *  - checkout.session.completed      → activate premium
 *  - customer.subscription.updated   → sync plan/status changes
 *  - customer.subscription.deleted   → downgrade to free
 *  - invoice.payment_failed          → mark past_due
 */
export default async ({ req, res, log, error }) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // ── 1. Verify Stripe webhook signature ────────────────────────────────────
  const signature = req.headers['stripe-signature'];
  if (!signature) return res.json({ error: 'Missing signature' }, 400);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody || req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (e) {
    error(`[stripeWebhook] Signature verification failed: ${e.message}`);
    return res.json({ error: 'Webhook signature invalid' }, 400);
  }

  log(`[stripeWebhook] event=${event.type} | id=${event.id}`);

  const db = serverDb();

  // ── 2. Handle events ──────────────────────────────────────────────────────
  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId   = session.customer;
        const subscriptionId = session.subscription;

        // Retrieve subscription details
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(db, customerId, sub, 'premium');
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const plan = determinePlan(sub);
        await syncSubscription(db, sub.customer, sub, plan);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await syncSubscription(db, sub.customer, sub, 'free');
        break;
      }

      case 'invoice.payment_failed': {
        const invoice    = event.data.object;
        const customerId = invoice.customer;
        await updateSubscriptionStatus(db, customerId, 'past_due');
        break;
      }

      default:
        log(`[stripeWebhook] Unhandled event type: ${event.type}`);
    }
  } catch (e) {
    error(`[stripeWebhook] Handler failed: ${e.message}`);
    // Return 200 to prevent Stripe from retrying — log the error internally
  }

  return res.json({ received: true });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function syncSubscription(db, stripeCustomerId, stripeSub, plan) {
  // Find our user by stripeCustomerId
  const users = await db.listDocuments(DB_ID(), COL_USERS, [
    Query.equal('stripeCustomerId', stripeCustomerId),
    Query.limit(1),
  ]);

  if (!users.total) {
    // Customer doesn't exist yet — this is expected on first checkout
    return;
  }

  const userDoc = users.documents[0];
  const userId  = userDoc.appwriteUserId;

  const payload = {
    userId,
    stripeSubscriptionId: stripeSub.id,
    plan,
    status:               stripeSub.status,
    currentPeriodEnd:     new Date(stripeSub.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd:    stripeSub.cancel_at_period_end,
    updatedAt:            new Date().toISOString(),
  };

  // Upsert subscription document
  const existing = await db.listDocuments(DB_ID(), COL_SUBS, [
    Query.equal('userId', userId),
    Query.limit(1),
  ]);

  if (existing.total) {
    await db.updateDocument(DB_ID(), COL_SUBS, existing.documents[0].$id, payload);
  } else {
    const { ID } = await import('node-appwrite');
    await db.createDocument(DB_ID(), COL_SUBS, ID.unique(), payload);
  }

  // Mirror plan on user document for fast reads
  await db.updateDocument(DB_ID(), COL_USERS, userDoc.$id, { plan });
}

async function updateSubscriptionStatus(db, stripeCustomerId, status) {
  const users = await db.listDocuments(DB_ID(), COL_USERS, [
    Query.equal('stripeCustomerId', stripeCustomerId),
    Query.limit(1),
  ]);
  if (!users.total) return;

  const userId = users.documents[0].appwriteUserId;
  const subs   = await db.listDocuments(DB_ID(), COL_SUBS, [
    Query.equal('userId', userId),
    Query.limit(1),
  ]);

  if (subs.total) {
    await db.updateDocument(DB_ID(), COL_SUBS, subs.documents[0].$id, {
      status,
      updatedAt: new Date().toISOString(),
    });
  }
}

function determinePlan(subscription) {
  return subscription.status === 'active' || subscription.status === 'trialing'
    ? 'premium'
    : 'free';
}

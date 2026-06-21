import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const GATEWAY_KEY = process.env.SMS_GATEWAY_API_KEY || 'sms_gateway_secret_token_2026';

export async function POST(request: Request) {
  try {
    const gatewayKeyHeader = request.headers.get('x-gateway-key');
    
    // Check security key
    if (gatewayKeyHeader !== GATEWAY_KEY) {
      return NextResponse.json({ error: 'Unauthorized gateway access' }, { status: 401 });
    }

    const { sender, amount, rawMessage } = await request.json();

    if (amount === undefined || amount === null) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 });
    }

    console.log(`[SMS Webhook Received] Sender: ${sender}, Amount: ${amount}, Msg: ${rawMessage}`);

    // Parse clean digits from sender (e.g. if SMS sender is "+201011223344" -> "01011223344")
    const cleanSender = String(sender).replace(/\D/g, '');
    const searchSender = cleanSender.length > 10 ? cleanSender.substring(cleanSender.length - 11) : cleanSender;

    // Fetch all pending transactions for this amount
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        status: 'PENDING',
        amount: {
          gte: parseFloat(amount) - 0.5, // Allow slight float tolerance
          lte: parseFloat(amount) + 0.5
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (pendingTransactions.length === 0) {
      console.log(`[SMS Match Failure] No pending transactions found for amount: ${amount} EGP`);
      return NextResponse.json({ success: false, message: 'No pending transactions found for this amount' });
    }

    // Attempt to match senderAccount with the SMS data
    // For Vodafone Cash: match by mobile number (sender account should match or be matching)
    // For InstaPay: match if the senderAccount (username/bank name) is mentioned anywhere in the rawMessage
    let matchedTx = null;

    for (const tx of pendingTransactions) {
      const txAccountClean = tx.senderAccount.replace(/\D/g, '');
      const searchTxAccount = txAccountClean.length > 10 ? txAccountClean.substring(txAccountClean.length - 11) : txAccountClean;

      // 1. Mobile number match (Vodafone Cash)
      if (searchSender && searchTxAccount && (searchSender.includes(searchTxAccount) || searchTxAccount.includes(searchSender))) {
        matchedTx = tx;
        break;
      }

      // 2. InstaPay match: check if the user-entered senderAccount (e.g. "ahmed@instapay" or their name "احمد علي") is mentioned in the SMS raw message
      if (rawMessage && tx.senderAccount && rawMessage.toLowerCase().includes(tx.senderAccount.toLowerCase())) {
        matchedTx = tx;
        break;
      }
    }

    // Fallback: If only one transaction is pending for this exact amount, and it's a mobile wallet, we can auto-match it to be user-friendly,
    // but to prevent false validations let's stick to matching sender details.
    if (!matchedTx) {
      console.log(`[SMS Match Failure] Found ${pendingTransactions.length} pending transactions for ${amount} EGP, but sender details did not match.`);
      return NextResponse.json({ success: false, message: 'Sender mismatch' });
    }

    console.log(`[SMS Match Success] Matched Transaction ID: ${matchedTx.id} for User ID: ${matchedTx.userId}`);

    // Update Transaction and user subscription inside transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update Transaction to SUCCESSFUL
      await tx.transaction.update({
        where: { id: matchedTx.id },
        data: {
          status: 'SUCCESSFUL',
          confirmedAt: new Date()
        }
      });

      // 2. Add or extend user subscription
      const existingSub = await tx.subscription.findFirst({
        where: { userId: matchedTx.userId, status: 'ACTIVE' },
        orderBy: { endDate: 'desc' }
      });

      const now = new Date();
      let newEndDate = new Date();

      if (existingSub && existingSub.endDate > now) {
        // Extend existing active subscription by 365 days
        newEndDate = new Date(existingSub.endDate);
        newEndDate.setDate(newEndDate.getDate() + 365);

        await tx.subscription.update({
          where: { id: existingSub.id },
          data: {
            plan: matchedTx.plan, // Update to new plan if changed
            endDate: newEndDate
          }
        });
      } else {
        // Start fresh 365 days subscription
        newEndDate.setDate(now.getDate() + 365);

        await tx.subscription.create({
          data: {
            userId: matchedTx.userId,
            plan: matchedTx.plan,
            status: 'ACTIVE',
            startDate: now,
            endDate: newEndDate
          }
        });
      }
    });

    console.log(`[SMS Activation Completed] User: ${matchedTx.userId} subscription upgraded to ${matchedTx.plan}`);

    return NextResponse.json({ success: true, message: 'Payment confirmed and subscription activated successfully' });

  } catch (error: any) {
    console.error('SMS Gateway Confirm Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

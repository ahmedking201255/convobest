import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan, amount, senderAccount } = await request.json();

    if (!plan || !amount || !senderAccount) {
      return NextResponse.json({ error: 'All fields (plan, amount, senderAccount) are required' }, { status: 400 });
    }

    // Clean sender account (extract only digits if wallet number, or keep if InstaPay username)
    // Vodafone cash numbers are typically 11 digits starting with 01
    const isMobileWallet = /^\d+$/.test(senderAccount.trim());
    const cleanSenderAccount = isMobileWallet ? senderAccount.replace(/\D/g, '') : senderAccount.trim();

    if (cleanSenderAccount.length < 5) {
      return NextResponse.json({ error: 'Sender account reference is too short' }, { status: 400 });
    }

    // Create pending transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.userId,
        plan,
        amount: parseFloat(amount),
        senderAccount: cleanSenderAccount,
        status: 'PENDING'
      }
    });

    return NextResponse.json({
      message: 'Pending payment request generated successfully',
      transactionId: transaction.id
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating checkout transaction:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// GET: Retrieve a transaction status (used for polling on the client side)
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: user.userId }
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({ status: transaction.status });
  } catch (error: any) {
    console.error('Error fetching transaction status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

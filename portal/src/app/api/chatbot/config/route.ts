import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { clearChatbotProductsCache } from '@/lib/chatbot-cache';

// GET: Retrieve ChatbotConfig for a specific instance
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');

    if (!instanceId) {
      return NextResponse.json({ error: 'Instance ID is required' }, { status: 400 });
    }

    // Verify instance ownership
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: instanceId, userId: user.userId },
    });

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found or unauthorized' }, { status: 404 });
    }

    // Verify subscription plan (Requires Pro or Enterprise)
    const activeSub = await prisma.subscription.findFirst({
      where: { userId: user.userId, status: 'ACTIVE' },
      orderBy: { endDate: 'desc' }
    });

    const planName = activeSub?.plan || 'Starter (Trial)';
    const canUseChatbot = planName.toLowerCase().includes('pro') || planName.toLowerCase().includes('enterprise');

    if (!canUseChatbot) {
      return NextResponse.json(
        { error: 'ميزة الشات بوت الذكي غير متاحة في باقتك الحالية، يرجى الترقية إلى Pro أو Enterprise.' },
        { status: 403 }
      );
    }

    // Find chatbot config or create a default one
    let config = await prisma.chatbotConfig.findUnique({
      where: { instanceId },
    });

    if (!config) {
      config = await prisma.chatbotConfig.create({
        data: {
          instanceId,
          enabled: false,
          provider: 'OPENAI',
          apiKey: '',
          systemPrompt: 'أنت مساعد خدمة عملاء ذكي ومحترف. أجب باختصار وبأسلوب ودود.',
          useProductsSheet: false,
          productsSpreadsheetId: null,
          productsSheetName: null,
          productsMapping: null
        },
      });
    }

    return NextResponse.json({ config });
  } catch (error: any) {
    console.error('Error fetching chatbot config:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Save/Update ChatbotConfig
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      instanceId, 
      enabled, 
      provider, 
      apiKey, 
      systemPrompt,
      useProductsSheet,
      productsSpreadsheetId,
      productsSheetName,
      productsMapping
    } = await request.json();

    if (!instanceId) {
      return NextResponse.json({ error: 'Instance ID is required' }, { status: 400 });
    }

    // Verify instance ownership
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: instanceId, userId: user.userId },
    });

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found or unauthorized' }, { status: 404 });
    }

    // Verify subscription plan (Requires Pro or Enterprise)
    const activeSub = await prisma.subscription.findFirst({
      where: { userId: user.userId, status: 'ACTIVE' },
      orderBy: { endDate: 'desc' }
    });

    const planName = activeSub?.plan || 'Starter (Trial)';
    const canUseChatbot = planName.toLowerCase().includes('pro') || planName.toLowerCase().includes('enterprise');

    if (!canUseChatbot) {
      return NextResponse.json(
        { error: 'ميزة الشات بوت الذكي غير متاحة في باقتك الحالية، يرجى الترقية إلى Pro أو Enterprise.' },
        { status: 403 }
      );
    }

    // Clear memory product cache on configuration change
    clearChatbotProductsCache(instanceId);

    // Upsert chatbot config
    const config = await prisma.chatbotConfig.upsert({
      where: { instanceId },
      update: {
        enabled: enabled !== undefined ? enabled : false,
        provider: provider || 'OPENAI',
        apiKey: apiKey !== undefined ? apiKey : null,
        systemPrompt: systemPrompt !== undefined ? systemPrompt : undefined,
        useProductsSheet: useProductsSheet !== undefined ? useProductsSheet : false,
        productsSpreadsheetId: productsSpreadsheetId !== undefined ? productsSpreadsheetId : null,
        productsSheetName: productsSheetName !== undefined ? productsSheetName : null,
        productsMapping: productsMapping !== undefined ? (typeof productsMapping === 'string' ? productsMapping : JSON.stringify(productsMapping)) : null,
      },
      create: {
        instanceId,
        enabled: enabled !== undefined ? enabled : false,
        provider: provider || 'OPENAI',
        apiKey: apiKey || '',
        systemPrompt: systemPrompt || 'أنت مساعد خدمة عملاء ذكي ومحترف. أجب باختصار وبأسلوب ودود.',
        useProductsSheet: useProductsSheet !== undefined ? useProductsSheet : false,
        productsSpreadsheetId: productsSpreadsheetId || null,
        productsSheetName: productsSheetName || null,
        productsMapping: productsMapping ? (typeof productsMapping === 'string' ? productsMapping : JSON.stringify(productsMapping)) : null,
      },
    });

    return NextResponse.json({ message: 'Chatbot configuration saved successfully', config });
  } catch (error: any) {
    console.error('Error saving chatbot config:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

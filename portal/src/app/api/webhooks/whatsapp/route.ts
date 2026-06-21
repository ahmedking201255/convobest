import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { whatsapp } from '@/lib/whatsapp';
import { syncContactsWithRetry } from '@/lib/whatsapp-sync';
import { normalizeJidUser, resolveLidToPn, upsertLidPnMapping } from '@/lib/lid';
import { cleanStoredContactName, getStableContactName, getWhatsAppMessageId, saveInboxMessage, upsertChatContact } from '@/lib/inbox-store';
import { sendWithMessageQuota } from '@/lib/message-quota';
import { getChatbotProductsCache, setChatbotProductsCache } from '@/lib/chatbot-cache';
import { getValidToken } from '@/app/api/integration/google-sheets/helper';

const RECENT_HISTORY_SYNC_DAYS = 7;

function isValidPrivateNumber(number: string) {
  return /^[0-9]{7,15}$/.test(number) && !/^0+$/.test(number);
}

function isValidGroupNumber(number: string) {
  return number.includes('-') || /^120363[0-9]{9,}$/.test(number);
}

function isIgnoredChatJid(jid: string) {
  const normalized = jid.toLowerCase();
  return (
    !normalized ||
    normalized.includes('status@broadcast') ||
    normalized.includes('@broadcast') ||
    normalized.includes('@newsletter')
  );
}

function extractNumberFromJid(jid: any) {
  if (!jid) return null;
  if (typeof jid === 'string') {
    const user = normalizeJidUser(jid);
    return user || null;
  }

  const user = jid.User || jid.user;
  return typeof user === 'string' && user.trim() ? normalizeJidUser(user) : null;
}

function extractJidString(jid: any) {
  if (!jid) return null;
  if (typeof jid === 'string') return jid;
  const user = jid.User || jid.user;
  const server = jid.Server || jid.server || 's.whatsapp.net';
  return user ? `${user}@${server}` : null;
}

function isLidJid(jid?: string | null) {
  return typeof jid === 'string' && jid.includes('@lid');
}

function isPhoneJid(jid?: string | null) {
  return typeof jid === 'string' && jid.includes('@s.whatsapp.net');
}

function extractInfoJids(...sources: any[]) {
  const jids: string[] = [];

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;

    const candidates = [
      source.Chat,
      source.chat,
      source.Sender,
      source.sender,
      source.SenderAlt,
      source.senderAlt,
      source.RecipientAlt,
      source.recipientAlt,
      source.remoteJid,
      source.remoteJID,
      source.RemoteJID,
      source.participant,
      source.Participant
    ];

    for (const candidate of candidates) {
      const jid = extractJidString(candidate);
      if (jid) jids.push(jid);
    }
  }

  return jids;
}

async function mergeLidConversation(instanceId: string, lidOrJid: string, pnOrJid: string) {
  const lid = normalizeJidUser(lidOrJid);
  const pn = normalizeJidUser(pnOrJid);

  if (!lid || !pn || lid === pn || !isValidPrivateNumber(pn)) return;

  const [lidContact, pnContact] = await Promise.all([
    prisma.chatContact.findUnique({
      where: { instanceId_number: { instanceId, number: lid } },
      select: { contactName: true, isGroup: true }
    }),
    prisma.chatContact.findUnique({
      where: { instanceId_number: { instanceId, number: pn } },
      select: { contactName: true, isGroup: true }
    })
  ]);

  const stableName =
    cleanStoredContactName(pnContact?.contactName) ||
    cleanStoredContactName(lidContact?.contactName);

  await prisma.chatContact.upsert({
    where: { instanceId_number: { instanceId, number: pn } },
    create: {
      instanceId,
      number: pn,
      contactName: stableName,
      isGroup: false
    },
    update: {
      ...(stableName ? { contactName: stableName } : {}),
      isGroup: false
    }
  });

  await prisma.chatContact.deleteMany({
    where: {
      instanceId,
      number: lid
    }
  });

  const updateData = stableName ? { number: pn, contactName: stableName } : { number: pn };

  const [logs, inbox] = await Promise.all([
    prisma.messageLog.updateMany({
      where: { instanceId, number: lid },
      data: updateData
    }),
    prisma.inboxMessage.updateMany({
      where: { instanceId, number: lid },
      data: updateData
    })
  ]);

  if (logs.count || inbox.count) {
    console.log(`[Webhook LID Merge] Merged ${lid} into ${pn} for instance ${instanceId}: ${logs.count} logs, ${inbox.count} inbox messages`);
  }
}

async function rememberLidPnMapping(instanceId: string, lidOrJid?: string | null, pnOrJid?: string | null) {
  if (!lidOrJid || !pnOrJid || !isLidJid(lidOrJid) || !isPhoneJid(pnOrJid)) return null;

  const lid = normalizeJidUser(lidOrJid);
  const pn = normalizeJidUser(pnOrJid);
  if (!lid || !pn || lid === pn || !isValidPrivateNumber(pn)) return null;

  await upsertLidPnMapping(lid, pn);
  await mergeLidConversation(instanceId, lid, pn);
  return pn;
}

async function rememberLidMappingsFromPayload(instanceId: string, ...sources: any[]) {
  const jids = extractInfoJids(...sources);
  const lids = jids.filter(isLidJid);
  const pns = jids.filter(isPhoneJid);

  for (const lid of lids) {
    for (const pn of pns) {
      await rememberLidPnMapping(instanceId, lid, pn);
    }
  }
}

function extractReactionPayload(messageContent: any) {
  const reaction =
    messageContent?.reactionMessage ||
    messageContent?.ReactionMessage ||
    messageContent?.reaction ||
    messageContent?.Reaction;

  if (!reaction) return null;

  const key = reaction.key || reaction.Key || {};
  const targetId = key.id || key.ID || reaction.id || reaction.ID || '';
  const targetRemoteJid = key.remoteJid || key.RemoteJID || key.remoteJID || '';
  const text = reaction.text ?? reaction.Text ?? '';

  if (!targetId) return null;

  return {
    targetId,
    targetRemoteJid,
    text: typeof text === 'string' ? text : ''
  };
}

function unwrapMessageContent(messageContent: any): any {
  if (!messageContent || typeof messageContent !== 'object') {
    return messageContent;
  }

  const wrapperCandidates = [
    messageContent.ephemeralMessage,
    messageContent.EphemeralMessage,
    messageContent.viewOnceMessage,
    messageContent.ViewOnceMessage,
    messageContent.viewOnceMessageV2,
    messageContent.ViewOnceMessageV2,
    messageContent.viewOnceMessageV2Extension,
    messageContent.ViewOnceMessageV2Extension,
    messageContent.documentWithCaptionMessage,
    messageContent.DocumentWithCaptionMessage,
    messageContent.deviceSentMessage,
    messageContent.DeviceSentMessage,
    messageContent.editedMessage,
    messageContent.EditedMessage,
  ];

  for (const wrapper of wrapperCandidates) {
    const nested = wrapper?.message || wrapper?.Message;
    if (nested) {
      return unwrapMessageContent(nested);
    }
  }

  return messageContent;
}

function getMessageObject(messageContent: any, keys: string[]) {
  for (const key of keys) {
    const value = messageContent?.[key];
    if (value) return value;
  }
  return null;
}

function parseWhatsAppMessageText(rawMessageContent: any) {
  // Capture base64 and mediaUrl from the root (before unwrapping)
  const rootBase64 = rawMessageContent?.base64 || rawMessageContent?.Base64 || '';
  const rootMediaUrl =
    rawMessageContent?.mediaUrl ||
    rawMessageContent?.MediaUrl ||
    rawMessageContent?.mediaURL ||
    rawMessageContent?.MediaURL ||
    '';

  const messageContent = unwrapMessageContent(rawMessageContent);

  if (typeof messageContent === 'string') {
    const text = messageContent.trim();
    return text ? { shouldSave: true, text } : { shouldSave: false, text: '' };
  }

  if (!messageContent || typeof messageContent !== 'object') {
    return { shouldSave: false, text: '' };
  }

  const conv = messageContent.conversation || messageContent.Conversation;
  const extText = messageContent.extendedTextMessage?.text || messageContent.ExtendedTextMessage?.text;

  if (conv) return { shouldSave: true, text: conv };
  if (extText) return { shouldSave: true, text: extText };

  const mediaDescriptors = [
    { keys: ['imageMessage', 'ImageMessage'], mediaType: 'image' },
    { keys: ['audioMessage', 'AudioMessage'], mediaType: 'audio' },
    { keys: ['videoMessage', 'VideoMessage'], mediaType: 'video' },
    { keys: ['stickerMessage', 'StickerMessage'], mediaType: 'sticker' },
    { keys: ['documentMessage', 'DocumentMessage'], mediaType: 'document' },
  ];

  for (const descriptor of mediaDescriptors) {
    const media = getMessageObject(messageContent, descriptor.keys);
    if (!media) continue;

    const mime = media.mimetype || media.Mimetype || messageContent.mimetype || messageContent.Mimetype || '';
    const caption = media.caption || media.Caption || '';
    const fileName = media.fileName || media.FileName || '';
    const base64 = rootBase64 || messageContent.base64 || messageContent.Base64 || '';
    const mediaUrl =
      rootMediaUrl ||
      messageContent.mediaUrl ||
      messageContent.MediaUrl ||
      messageContent.mediaURL ||
      messageContent.MediaURL ||
      '';

    return {
      shouldSave: true,
      text: JSON.stringify({
        _isMedia: true,
        mediaType: descriptor.mediaType,
        mimetype: mime,
        caption,
        fileName,
        base64,
        mediaUrl
      })
    };
  }

  if (
    rawMessageContent.base64 ||
    rawMessageContent.Base64 ||
    rawMessageContent.mediaUrl ||
    rawMessageContent.MediaUrl ||
    rawMessageContent.mediaURL ||
    rawMessageContent.MediaURL ||
    messageContent.base64 ||
    messageContent.Base64 ||
    messageContent.mediaUrl ||
    messageContent.MediaUrl ||
    messageContent.mediaURL ||
    messageContent.MediaURL ||
    messageContent.mediaType ||
    messageContent.MediaType ||
    messageContent.mimetype ||
    messageContent.Mimetype
  ) {
    const mime = messageContent.mimetype || messageContent.Mimetype || '';
    let mediaType = messageContent.mediaType || messageContent.MediaType || '';
    if (!mediaType) {
      if (mime.startsWith('image/')) mediaType = mime.includes('webp') ? 'sticker' : 'image';
      else if (mime.startsWith('audio/')) mediaType = 'audio';
      else if (mime.startsWith('video/')) mediaType = 'video';
      else mediaType = 'document';
    }

    return {
      shouldSave: true,
      text: JSON.stringify({
        _isMedia: true,
        mediaType,
        mimetype: mime,
        caption: messageContent.caption || messageContent.Caption || '',
        fileName: messageContent.fileName || messageContent.FileName || '',
        base64: rootBase64 || messageContent.base64 || messageContent.Base64 || '',
        mediaUrl:
          rootMediaUrl ||
          messageContent.mediaUrl ||
          messageContent.MediaUrl ||
          messageContent.mediaURL ||
          messageContent.MediaURL ||
          ''
      })
    };
  }

  const contact = messageContent.contactMessage || messageContent.ContactMessage;
  if (contact) {
    const name = contact.displayName || contact.DisplayName || contact.vcard?.match(/FN:(.+)/)?.[1] || '';
    return { shouldSave: true, text: name ? `جهة اتصال: ${name}` : 'جهة اتصال' };
  }

  const contacts = messageContent.contactsArrayMessage || messageContent.ContactsArrayMessage;
  if (contacts) {
    const displayName = contacts.displayName || contacts.DisplayName || '';
    return { shouldSave: true, text: displayName ? `جهات اتصال: ${displayName}` : 'جهات اتصال' };
  }

  const location = messageContent.locationMessage || messageContent.LocationMessage;
  if (location) {
    const name = location.name || location.Name || location.address || location.Address || '';
    return { shouldSave: true, text: name ? `موقع: ${name}` : 'موقع' };
  }

  const liveLocation = messageContent.liveLocationMessage || messageContent.LiveLocationMessage;
  if (liveLocation) {
    return { shouldSave: true, text: 'موقع مباشر' };
  }

  const poll =
    messageContent.pollCreationMessage ||
    messageContent.PollCreationMessage ||
    messageContent.pollCreationMessageV2 ||
    messageContent.PollCreationMessageV2 ||
    messageContent.pollCreationMessageV3 ||
    messageContent.PollCreationMessageV3;
  if (poll) {
    const pollName = poll.name || poll.Name || '';
    return { shouldSave: true, text: pollName ? `استطلاع: ${pollName}` : 'استطلاع' };
  }

  const unsupportedKeys = Object.keys(messageContent).filter(key => {
    const value = messageContent[key];
    return value !== undefined && value !== null;
  });

  return {
    shouldSave: false,
    text: '',
    reason: unsupportedKeys.length ? `unsupported keys: ${unsupportedKeys.join(',')}` : 'empty message'
  };
}

async function resolveOutgoingCrossInstanceNumber(params: {
  instanceId: string;
  userId: string;
  messageId?: string | null;
  currentNumber: string;
}) {
  if (!params.messageId || !isValidPrivateNumber(params.currentNumber)) return null;

  const siblingInstances = await prisma.whatsAppInstance.findMany({
    where: {
      userId: params.userId,
      id: { not: params.instanceId }
    },
    select: { id: true }
  });
  const siblingInstanceIds = siblingInstances.map(instance => instance.id);
  if (siblingInstanceIds.length === 0) return null;
  const candidateMessageIds = [
    params.messageId,
    ...siblingInstanceIds.map(instanceId => `${instanceId}:${params.messageId}`)
  ];

  const existingContact = await prisma.chatContact.findUnique({
    where: {
      instanceId_number: {
        instanceId: params.instanceId,
        number: params.currentNumber
      }
    },
    select: { contactName: true }
  });

  if (cleanStoredContactName(existingContact?.contactName)) {
    return null;
  }

  const siblingMessage = await prisma.inboxMessage.findFirst({
    where: {
      instanceId: { in: siblingInstanceIds },
      id: { in: candidateMessageIds }
    },
    include: {
      instance: {
        select: { jid: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const siblingInstanceNumber = extractNumberFromJid(siblingMessage?.instance?.jid);
  if (siblingInstanceNumber && siblingInstanceNumber !== params.currentNumber) {
    return siblingInstanceNumber;
  }

  return null;
}

async function reconcileCrossInstanceOutgoingMessages(params: {
  userId: string;
  currentInstanceId: string;
  messageId?: string | null;
  currentInstanceJid?: string | null;
}) {
  const currentInstanceNumber = extractNumberFromJid(params.currentInstanceJid);
  if (!params.messageId || !currentInstanceNumber) return;

  const siblingInstances = await prisma.whatsAppInstance.findMany({
    where: {
      userId: params.userId,
      id: { not: params.currentInstanceId }
    },
    select: { id: true }
  });
  const siblingInstanceIds = siblingInstances.map(instance => instance.id);
  if (siblingInstanceIds.length === 0) return;
  const candidateMessageIds = [
    params.messageId,
    ...siblingInstanceIds.map(instanceId => `${instanceId}:${params.messageId}`)
  ];

  const siblingMessages = await prisma.inboxMessage.findMany({
    where: {
      instanceId: { in: siblingInstanceIds },
      type: 'SENT',
      id: { in: candidateMessageIds }
    },
    select: {
      id: true,
      instanceId: true,
      number: true,
      contactName: true
    }
  });

  for (const sibling of siblingMessages) {
    if (sibling.number === currentInstanceNumber || cleanStoredContactName(sibling.contactName)) {
      continue;
    }

    const stableName = await getStableContactName(sibling.instanceId, currentInstanceNumber);
    await prisma.inboxMessage.update({
      where: { id: sibling.id },
      data: {
        number: currentInstanceNumber,
        contactName: stableName
      }
    });

    await prisma.messageLog.updateMany({
      where: {
        instanceId: sibling.instanceId,
        number: sibling.number,
        OR: [
          { id: sibling.id },
          { id: params.messageId }
        ]
      },
      data: {
        number: currentInstanceNumber,
        contactName: stableName
      }
    });

    const remainingOldMessages = await prisma.inboxMessage.count({
      where: {
        instanceId: sibling.instanceId,
        number: sibling.number
      }
    });

    if (remainingOldMessages === 0) {
      await prisma.chatContact.deleteMany({
        where: {
          instanceId: sibling.instanceId,
          number: sibling.number,
          OR: [
            { contactName: null },
            { contactName: '' }
          ]
        }
      });
    }

    console.log(`[Webhook LID Reconcile] Message ${params.messageId} moved from ${sibling.number} to ${currentInstanceNumber}`);
  }
}

// Helper function to fetch and format products from Google Sheets (with local in-memory caching)
async function fetchAndFormatProducts(config: any): Promise<string> {
  const instanceId = config.instanceId;
  
  // 1. Check in-memory cache first
  const cachedProducts = getChatbotProductsCache(instanceId);
  if (cachedProducts !== null) {
    console.log(`[Chatbot Products] Cache HIT for instance ${instanceId}`);
    return cachedProducts;
  }
  
  console.log(`[Chatbot Products] Cache MISS for instance ${instanceId}. Fetching from Google Sheets...`);
  
  try {
    // 2. Fetch google sheets credentials/token
    const token = await getValidToken(instanceId);
    
    const spreadsheetId = config.productsSpreadsheetId;
    const sheetName = config.productsSheetName;
    
    if (!spreadsheetId || !sheetName) {
      console.warn(`[Chatbot Products] Spreadsheet ID or Sheet Name is missing in config.`);
      return '';
    }
    
    // We read A1:Z200 to fetch up to 200 products.
    const range = encodeURIComponent(`${sheetName}!A1:Z200`);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    const data = await response.json();
    if (!response.ok) {
      console.error('[Chatbot Products Sheets API Error]:', data);
      return '';
    }
    
    const rows = data.values || [];
    if (rows.length <= 1) {
      console.log(`[Chatbot Products] Google Sheet is empty or only has headers.`);
      return '';
    }
    
    const headers: string[] = rows[0];
    
    // Parse mapping
    let mapping: Record<string, string> = {};
    if (config.productsMapping) {
      try {
        mapping = typeof config.productsMapping === 'string' 
          ? JSON.parse(config.productsMapping) 
          : config.productsMapping;
      } catch (e) {
        console.error('[Chatbot Products Mapping Parse Error]:', e);
      }
    }
    
    const nameCol = mapping.nameCol;
    const priceCol = mapping.priceCol;
    const descCol = mapping.descCol;
    const stockCol = mapping.stockCol;
    
    const nameIdx = nameCol ? headers.indexOf(nameCol) : -1;
    const priceIdx = priceCol ? headers.indexOf(priceCol) : -1;
    const descIdx = descCol ? headers.indexOf(descCol) : -1;
    const stockIdx = stockCol ? headers.indexOf(stockCol) : -1;
    
    // If the name column index is not found (-1), try finding it by index or fallback to index 0
    let finalNameIdx = nameIdx;
    if (finalNameIdx === -1 && rows[0].length > 0) {
      finalNameIdx = 0; // fallback to first column
    }
    
    let productsList: string[] = [];
    
    // Loop through rows (skipping header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const nameVal = finalNameIdx !== -1 ? (row[finalNameIdx] || '').trim() : '';
      if (!nameVal) continue; // Skip if no product name
      
      const priceVal = priceIdx !== -1 ? (row[priceIdx] || '').trim() : '';
      const descVal = descIdx !== -1 ? (row[descIdx] || '').trim() : '';
      const stockVal = stockIdx !== -1 ? (row[stockIdx] || '').trim() : '';
      
      let productStr = `- المنتج: ${nameVal}`;
      if (priceVal) productStr += ` | السعر: ${priceVal}`;
      if (descVal) productStr += ` | الوصف: ${descVal}`;
      if (stockVal) {
        productStr += ` | الحالة: ${stockVal}`;
      }
      
      productsList.push(productStr);
    }
    
    if (productsList.length === 0) {
      return '';
    }
    
    const formattedText = `\n\nقائمة المنتجات والأسعار المتوفرة حالياً بالمتجر:\n${productsList.join('\n')}\n`;
    
    // Cache the formatted text for 5 minutes (300 seconds)
    setChatbotProductsCache(instanceId, formattedText, 300);
    
    return formattedText;
  } catch (error: any) {
    console.error('[Chatbot Products Fetch Error]:', error.message);
    return '';
  }
}

// Helper function to trigger AI Chatbot response asynchronously
async function triggerChatbotResponse(
  instanceId: string, 
  userId: string,
  token: string, 
  remoteJid: string, 
  userMessage: string
) {
  try {
    // 1. Fetch chatbot config
    const config = await prisma.chatbotConfig.findUnique({
      where: { instanceId }
    });

    if (!config || !config.enabled || !config.apiKey) {
      return;
    }

    console.log(`[Chatbot Triggered] Generating reply for instance: ${instanceId} using ${config.provider}`);

    // Fetch and format products if enabled
    let productsText = '';
    if (config.useProductsSheet) {
      productsText = await fetchAndFormatProducts(config);
    }

    const finalSystemPrompt = productsText 
      ? `${config.systemPrompt}${productsText}` 
      : config.systemPrompt;

    let replyText = '';

    if (config.provider === 'OPENAI') {
      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: finalSystemPrompt },
            { role: 'user', content: userMessage }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI error: ${response.status}`);
      }

      const result = await response.json();
      replyText = result.choices?.[0]?.message?.content?.trim() || '';

    } else if (config.provider === 'GEMINI') {
      // Call Gemini API
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: `System Instructions: ${finalSystemPrompt}\n\nCustomer Message: ${userMessage}` }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Gemini error: ${response.status}`);
      }

      const result = await response.json();
      replyText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }

    if (replyText) {
      const cleanNumber = normalizeJidUser(remoteJid);
      
      // 1. Mark incoming messages as read
      try {
        const unreadLogs = await prisma.inboxMessage.findMany({
          where: {
            instanceId,
            number: cleanNumber,
            type: 'RECEIVED',
            status: { not: 'READ' }
          },
          select: { id: true }
        });
        const unreadIds = unreadLogs.map(l => getWhatsAppMessageId(l.id, instanceId)).filter(Boolean);
        if (unreadIds.length > 0) {
          await whatsapp.markRead(token, cleanNumber, unreadIds);
        }
        await prisma.inboxMessage.updateMany({
          where: {
            instanceId,
            number: cleanNumber,
            type: 'RECEIVED',
            status: { not: 'READ' }
          },
          data: {
            status: 'READ'
          }
        });
      } catch (readErr: any) {
        console.warn('[Chatbot Read Receipt Warning]:', readErr.message);
      }

      // 2. Set typing presence (simulating human behavior)
      try {
        await whatsapp.setPresence(token, cleanNumber, 'composing');
        const delay = Math.min(Math.max(replyText.length * 50, 1200), 3000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (presenceErr: any) {
        console.warn('[Chatbot Presence Warning]:', presenceErr.message);
      }

      // 3. Send automated reply to WhatsApp
      const result = await sendWithMessageQuota(userId, () => whatsapp.sendText(token, cleanNumber, replyText));
      const messageId = result.data?.Info?.ID || result.data?.info?.id || result.data?.key?.id;
 
      // 4. Log automated reply in MessageLog
      await prisma.messageLog.create({
        data: {
          id: messageId || undefined,
          instanceId,
          number: cleanNumber,
          text: replyText,
          type: 'SENT' // Mark as SENT since it's our outgoing reply
        }
      });

      await saveInboxMessage({
        id: messageId,
        instanceId,
        number: cleanNumber,
        text: replyText,
        type: 'SENT'
      });
 
      console.log(`[Chatbot Reply Sent] Automated reply sent to ${cleanNumber}`);
    }
  } catch (err: any) {
    console.error('[Chatbot Error] Error in auto reply generation:', err.message);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { event, instanceId, data, state } = payload;

    console.log(`[Webhook Received] Event: ${event}, Instance: ${instanceId}`);

    if (!event || !instanceId) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    // Verify if this instance is registered in our portal with active subscriptions
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
      include: {
        user: {
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' },
              orderBy: { endDate: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!instance) {
      console.warn(`[Webhook Warning] Instance ${instanceId} is not registered in our ConvoBest Portal database.`);
      return NextResponse.json({ message: 'Instance not found in portal database' }, { status: 200 });
    }

    // Process events
    if (event === 'Connected' || event === 'PairSuccess') {
      const liveJid = extractJidString(data?.jid || data?.JID || data?.Info?.JID || data?.info?.jid);
      
      if (liveJid) {
        const isConflict = await whatsapp.checkConflict(instanceId, instance.userId, instance.token, liveJid);
        if (isConflict) {
          return NextResponse.json({ message: 'Conflict: WhatsApp number is already connected to another account' }, { status: 200 });
        }
      }

      const shouldSyncContacts = event === 'PairSuccess' || instance.status !== 'CONNECTED';

      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: {
          status: 'CONNECTED',
          ...(liveJid ? { jid: liveJid } : {})
        },
      });
      console.log(`[Webhook Update] Instance ${instanceId} status updated to CONNECTED`);

      if (shouldSyncContacts) {
        // Trigger contacts and recent WhatsApp history synchronization once when the instance becomes connected.
        syncContactsWithRetry(instanceId, instance.token, { requestHistorySync: true });
      }
    } else if (
      event === 'Disconnected' ||
      event === 'LoggedOut' ||
      event === 'ConnectFailure' ||
      event === 'QRTimeout'
    ) {
      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: { status: 'DISCONNECTED' },
      });
      console.log(`[Webhook Update] Instance ${instanceId} status updated to DISCONNECTED`);
    } else if (event === 'Message') {
      // Log message in database
      const info = data.Info || data.info || {};
      const key = data.key || {};
      
      const remoteJid = key.remoteJid || info.Chat || info.Sender || '';
      const fromMe = key.fromMe !== undefined ? key.fromMe : (info.IsFromMe || false);
      const messageContent = unwrapMessageContent(data.Message || data.message || {});
      const pushName = data.pushName || info.PushName || '';

      await rememberLidMappingsFromPayload(instanceId, info, key, data);

      const reactionPayload = extractReactionPayload(messageContent);
      if (reactionPayload) {
        let reactionRemoteJid = reactionPayload.targetRemoteJid || remoteJid;
        let reactionNumber = normalizeJidUser(reactionRemoteJid);

        if (reactionRemoteJid.includes('@lid')) {
          const resolvedPn = await resolveLidToPn(reactionNumber);
          if (resolvedPn) {
            reactionNumber = resolvedPn;
          }
        }

        const reactionText = reactionPayload.text && reactionPayload.text !== 'remove'
          ? reactionPayload.text
          : null;
        const updateData = fromMe
          ? { reactionFromMe: reactionText }
          : { reactionFromClient: reactionText };

        const targetIds = [
          reactionPayload.targetId,
          `${instanceId}:${reactionPayload.targetId}`
        ];

        let updateResult = await prisma.inboxMessage.updateMany({
          where: {
            instanceId,
            number: reactionNumber,
            id: { in: targetIds }
          },
          data: updateData
        });

        if (updateResult.count === 0) {
          updateResult = await prisma.inboxMessage.updateMany({
            where: {
              instanceId,
              id: { in: targetIds }
            },
            data: updateData
          });
        }

        if (updateResult.count === 0) {
          console.warn(`[Webhook Reaction] No inbox message matched reaction target ${reactionPayload.targetId} for instance ${instanceId} and number ${reactionNumber}`);
        } else {
          console.log(`[Webhook Reaction] ${fromMe ? 'Owner' : 'Client'} reaction updated for message ${reactionPayload.targetId}: ${reactionText || 'removed'} (${updateResult.count} row${updateResult.count === 1 ? '' : 's'})`);
        }
        return NextResponse.json({ message: 'Reaction processed successfully' });
      }

      const parsedMessage = parseWhatsAppMessageText(data.Message || data.message || {});
      if (!parsedMessage.shouldSave) {
        console.log(`[Webhook Message Skipped] Unsupported message for instance ${instanceId}: ${parsedMessage.reason || 'not displayable'}`);
        return NextResponse.json({ message: 'Unsupported message skipped' });
      }

      let text = parsedMessage.text;

      const type = fromMe ? 'SENT' : 'RECEIVED';
      
      // Resolve LID to PN JID if applicable and handle status updates
      let cleanNumber = normalizeJidUser(remoteJid);
      const isStatus = cleanNumber === 'status';

      if (isStatus) {
        const senderJid = key.participant || info.Sender || '';
        let senderNumber = normalizeJidUser(senderJid);
        if (senderNumber) {
          if (senderJid.includes('@lid')) {
            const resolvedPn = await resolveLidToPn(senderNumber);
            if (resolvedPn) {
              senderNumber = resolvedPn;
            }
          }
          cleanNumber = `status:${senderNumber}`;
        }
      } else {
        if (remoteJid.includes('@lid')) {
          const resolvedPn = await resolveLidToPn(cleanNumber);
          if (resolvedPn) {
            cleanNumber = resolvedPn;
          }
        }
      }
      
      const messageId = key.id || info.ID || info.id;

      if (fromMe && !isValidGroupNumber(cleanNumber)) {
        const resolvedCrossInstanceNumber = await resolveOutgoingCrossInstanceNumber({
          instanceId,
          userId: instance.userId,
          messageId,
          currentNumber: cleanNumber
        });

        if (resolvedCrossInstanceNumber) {
          console.log(`[Webhook LID Resolve] Outgoing message ${messageId} remapped from ${cleanNumber} to ${resolvedCrossInstanceNumber}`);
          cleanNumber = resolvedCrossInstanceNumber;
        }
      }

      // Extract quoted message context if available
      const quoted = data.quoted || data.Quoted;
      let dbText = text;
      if (quoted) {
        const quotedId = quoted.stanzaID || quoted.stanzaId || '';
        const quotedMsgContent = quoted.quotedMessage || {};
        
        let quotedText = '';
        const qConv = quotedMsgContent.conversation || quotedMsgContent.Conversation;
        const qExtText = quotedMsgContent.extendedTextMessage?.text || quotedMsgContent.ExtendedTextMessage?.text;
        
        if (typeof quotedMsgContent === 'string') {
          quotedText = quotedMsgContent;
        } else if (qConv) {
          quotedText = qConv;
        } else if (qExtText) {
          quotedText = qExtText;
        } else if (quotedMsgContent.imageMessage || quotedMsgContent.ImageMessage) {
          quotedText = '📷 صورة';
        } else if (quotedMsgContent.audioMessage || quotedMsgContent.AudioMessage) {
          quotedText = '🎙️ رسالة صوتية';
        } else if (quotedMsgContent.videoMessage || quotedMsgContent.VideoMessage) {
          quotedText = '🎥 فيديو';
        } else if (quotedMsgContent.stickerMessage || quotedMsgContent.StickerMessage) {
          quotedText = '✨ ملصق';
        } else if (quotedMsgContent.documentMessage || quotedMsgContent.DocumentMessage) {
          quotedText = '📄 مستند';
        } else {
          quotedText = 'رسالة وسائط';
        }

        const quotedParticipant = quoted.participant || (quotedMsgContent.participant || '');
        let cleanQuotedParticipant = quotedParticipant ? normalizeJidUser(quotedParticipant) : '';
        if (quotedParticipant && quotedParticipant.includes('@lid')) {
          const resolvedQuotedPn = await resolveLidToPn(cleanQuotedParticipant);
          if (resolvedQuotedPn) {
            cleanQuotedParticipant = resolvedQuotedPn;
          }
        }

        dbText = JSON.stringify({
          _isReply: true,
          text: text,
          quotedId,
          quotedText,
          quotedParticipant: cleanQuotedParticipant
        });
      }

      // Filter pushName or get group name to prevent owner or numeric name overwrites
      const isGroup = remoteJid.includes('@g.us');
      let cleanPush = null;
      
      if (isGroup) {
        const gName = data.groupData?.Name || data.groupData?.name || data.groupData?.subject;
        if (gName && gName.trim()) {
          cleanPush = gName.trim();
        }
      } else if (pushName && !fromMe) {
        const trimmed = pushName.trim();
        if (trimmed && trimmed !== 'Ahmed Emad' && !/^\+?[0-9]+$/.test(trimmed)) {
          cleanPush = trimmed;
        }
      }

      // If it is a group message received from someone else, wrap the text with sender metadata
      if (isGroup && !fromMe) {
        const senderJid = key.participant || info.Sender || '';
        const senderNumber = senderJid ? normalizeJidUser(senderJid) : '';
        const senderName = pushName || senderNumber || 'مشارك';
        
        dbText = JSON.stringify({
          _isGroupMessage: true,
          senderName: senderName,
          text: dbText
        });
      }

      // 1. Resolve contactName: check if we already have a saved contact name in the database
      let resolvedContactName = null;
      if (isGroup) {
        if (cleanPush) {
          resolvedContactName = cleanPush;
        } else {
          // Fallback to existing group name from DB if cleanPush is not in this webhook
          const existingGroup = await prisma.messageLog.findFirst({
            where: {
              instanceId: instanceId,
              number: cleanNumber,
              contactName: { not: null, notIn: [''] }
            },
            select: { contactName: true },
            orderBy: { createdAt: 'desc' }
          });
          if (existingGroup) {
            resolvedContactName = existingGroup.contactName;
          }
        }
      } else {
        // Private chat: prefer the existing contact name in DB (synced from phone contacts)
        const existingLogWithName = await prisma.messageLog.findFirst({
          where: {
            instanceId: instanceId,
            number: cleanNumber,
            contactName: { not: null, notIn: ['Ahmed Emad', ''] }
          },
          select: { contactName: true },
          orderBy: { createdAt: 'desc' }
        });
        
        if (existingLogWithName && existingLogWithName.contactName) {
          resolvedContactName = existingLogWithName.contactName;
        } else if (cleanPush) {
          resolvedContactName = cleanPush;
        }
      }

      if (!resolvedContactName) {
        resolvedContactName = await getStableContactName(instanceId, cleanNumber, cleanPush);
      }

      try {
        let messageLogId = messageId || undefined;
        if (messageId) {
          const existingMessageLog = await prisma.messageLog.findUnique({
            where: { id: messageId },
            select: { instanceId: true }
          });
          if (existingMessageLog && existingMessageLog.instanceId !== instanceId) {
            messageLogId = `${instanceId}:${messageId}`;
          }
        }

        await prisma.messageLog.create({
          data: {
            id: messageLogId, // use WhatsApp message ID, scoped per instance if another linked instance already stored it
            instanceId: instanceId,
            number: cleanNumber,
            contactName: resolvedContactName,
            text: dbText,
            type: type,
          },
        });
      } catch (logErr: any) {
        if (logErr?.code !== 'P2002') {
          throw logErr;
        }
      }

      await saveInboxMessage({
        id: messageId,
        instanceId,
        number: cleanNumber,
        contactName: resolvedContactName,
        text: dbText,
        type,
        isGroup
      });

      await reconcileCrossInstanceOutgoingMessages({
        userId: instance.userId,
        currentInstanceId: instanceId,
        messageId,
        currentInstanceJid: instance.jid
      });

      // Update contactName on existing logs if we have a pushName and it is a message from the customer
      if (resolvedContactName && !fromMe) {
        const targets = [cleanNumber];
        if (cleanNumber.startsWith('status:')) {
          const rawNum = cleanNumber.split(':')[1];
          if (rawNum) {
            targets.push(rawNum);
          }
        }
        
        for (const targetNum of targets) {
          await prisma.messageLog.updateMany({
            where: {
              instanceId: instanceId,
              number: targetNum,
              OR: [
                { contactName: null },
                { contactName: 'Ahmed Emad' }
              ]
            },
            data: {
              contactName: resolvedContactName
            }
          });
          await prisma.inboxMessage.updateMany({
            where: {
              instanceId: instanceId,
              number: targetNum,
              OR: [
                { contactName: null },
                { contactName: 'Ahmed Emad' }
              ]
            },
            data: {
              contactName: resolvedContactName
            }
          });
        }
      }

      console.log(`[Webhook Message Logged] ${type} message logged for instance ${instanceId}`);

      // If this is an incoming message (and not a status update), check for keyword chatbot rules first (available for all plans)
      if (!fromMe && instance.status === 'CONNECTED' && !cleanNumber.startsWith('status:')) {
        try {
          const cleanNumber = normalizeJidUser(remoteJid);
          
          // 1. Fetch keyword rules for this instance
          const keywordRules = await prisma.keywordRule.findMany({
            where: { instanceId, enabled: true }
          });
          
          let matchedRule = null;
          const cleanText = text.trim().toLowerCase();

          for (const rule of keywordRules) {
            const ruleKeyword = rule.keyword.trim().toLowerCase();
            
            if (rule.matchType === 'EXACT') {
              if (cleanText === ruleKeyword) {
                matchedRule = rule;
                break;
              }
            } else { // CONTAINS
              if (cleanText.includes(ruleKeyword)) {
                matchedRule = rule;
                break;
              }
            }
          }

          if (matchedRule) {
            console.log(`[Keyword Chatbot Match] Instance ${instanceId} matched keyword "${matchedRule.keyword}". Sending reply...`);
            
            // 1. Mark incoming messages as read
            try {
              const unreadLogs = await prisma.inboxMessage.findMany({
                where: {
                  instanceId,
                  number: cleanNumber,
                  type: 'RECEIVED',
                  status: { not: 'READ' }
                },
                select: { id: true }
              });
              const unreadIds = unreadLogs.map(l => getWhatsAppMessageId(l.id, instanceId)).filter(Boolean);
              if (unreadIds.length > 0) {
                await whatsapp.markRead(instance.token, cleanNumber, unreadIds);
              }
              await prisma.inboxMessage.updateMany({
                where: {
                  instanceId,
                  number: cleanNumber,
                  type: 'RECEIVED',
                  status: { not: 'READ' }
                },
                data: {
                  status: 'READ'
                }
              });
            } catch (readErr: any) {
              console.warn('[Keyword Chatbot Read Receipt Warning]:', readErr.message);
            }

            // 2. Set typing presence (simulating human behavior)
            try {
              await whatsapp.setPresence(instance.token, cleanNumber, 'composing');
              const delay = Math.min(Math.max(matchedRule.replyText.length * 50, 1200), 3000);
              await new Promise(resolve => setTimeout(resolve, delay));
            } catch (presenceErr: any) {
              console.warn('[Keyword Chatbot Presence Warning]:', presenceErr.message);
            }

            // 3. Send reply
            const result = await sendWithMessageQuota(instance.userId, () => whatsapp.sendText(instance.token, cleanNumber, matchedRule.replyText));
            const messageId = result.data?.Info?.ID || result.data?.info?.id || result.data?.key?.id;
            
            // 4. Log to message log
            await prisma.messageLog.create({
              data: {
                id: messageId || undefined,
                instanceId,
                number: cleanNumber,
                text: matchedRule.replyText,
                type: 'SENT'
              }
            });

            await saveInboxMessage({
              id: messageId,
              instanceId,
              number: cleanNumber,
              text: matchedRule.replyText,
              type: 'SENT'
            });
            
            // Done matching, exit webhook message processing
            return NextResponse.json({ success: true, message: 'Replied via Keyword Chatbot' }, { status: 200 });
          }
        } catch (keywordErr: any) {
          console.error('[Keyword Chatbot Error] Error checking keywords:', keywordErr.message);
        }

        // 2. If no keywords matched, check AI Chatbot availability based on plan
        const activeSub = instance.user?.subscriptions?.[0];
        const planName = activeSub?.plan || 'Starter (Trial)';
        
        // Block AI Chatbot for non-Pro/non-Enterprise plans
        const canUseChatbot = planName.toLowerCase().includes('pro') || planName.toLowerCase().includes('enterprise');

        if (!canUseChatbot) {
          console.log(`[Chatbot Bypass] Instance ${instanceId} is owned by user on plan (${planName}) which does not include AI Chatbot. Skipping.`);
        } else {
          triggerChatbotResponse(instanceId, instance.userId, instance.token, remoteJid, text).catch(err => {
            console.error('[Chatbot Error] Async handler failed:', err);
          });
        }
      }
    } else if (event === 'Receipt') {
      const messageIds = data.MessageIDs || data.messageIds || [];
      await rememberLidMappingsFromPayload(instanceId, data);
      
      if (state && messageIds.length > 0) {
        const dbStatus = state === 'Read' ? 'READ' : 'DELIVERED';
        const scopedMessageIds = messageIds.map((id: string) => `${instanceId}:${id}`);
        const receiptChat = extractJidString(data.Chat || data.chat);

        if (isLidJid(receiptChat)) {
          const originalMessage = await prisma.inboxMessage.findFirst({
            where: {
              OR: [
                { id: { in: messageIds } },
                { id: { in: scopedMessageIds } }
              ],
              instanceId,
              type: 'SENT'
            },
            select: { number: true }
          });

          if (originalMessage?.number && isValidPrivateNumber(originalMessage.number)) {
            await rememberLidPnMapping(instanceId, receiptChat, `${originalMessage.number}@s.whatsapp.net`);
          }
        }
        
        await prisma.messageLog.updateMany({
          where: {
            OR: [
              { id: { in: messageIds } },
              { id: { in: scopedMessageIds } }
            ],
            type: 'SENT'
          },
          data: {
            status: dbStatus
          }
        });
        await prisma.inboxMessage.updateMany({
          where: {
            OR: [
              { id: { in: messageIds } },
              { id: { in: scopedMessageIds } }
            ],
            type: 'SENT'
          },
          data: {
            status: dbStatus
          }
        });
        console.log(`[Webhook Receipt Logged] Updated status of ${messageIds.length} messages to ${dbStatus}`);
      }
    } else if (event === 'HistorySync') {
      try {
        console.log(`[Webhook HistorySync] Starting history sync for instance ${instanceId}...`);
        const syncData = data.Data || data.data || {};
        const conversations = syncData.Conversations || syncData.conversations || [];
        
        const historySince = new Date();
        historySince.setDate(historySince.getDate() - RECENT_HISTORY_SYNC_DAYS);
        const thresholdSeconds = Math.floor(historySince.getTime() / 1000);
        
        let contactsImported = 0;
        let messagesSeen = 0;
        let messagesImported = 0;
        let messagesSkippedOld = 0;
        let messagesSkippedMissingId = 0;
        let messagesSkippedDuplicate = 0;
        let messagesSkippedUnsupported = 0;
        let conversationsSkippedInvalid = 0;
        let conversationsSkippedLidUnresolved = 0;
        
        for (const conversation of conversations) {
          const jid = conversation.id || conversation.ID || conversation.jid || '';
          const messages = conversation.messages || conversation.Messages || [];
          
          // Resolve contactName from conversation or find a pushName inside messages
          let contactName = conversation.name || conversation.Name || null;
          if (!contactName) {
            for (const msg of messages) {
              const webMessage = msg.message || msg.Message || {};
              const key = webMessage.key || webMessage.Key || {};
              const fromMe = key.fromMe !== undefined ? key.fromMe : (key.FromMe !== undefined ? key.FromMe : false);
              if (!fromMe) {
                const pName = webMessage.pushName || webMessage.PushName || '';
                if (pName) {
                  contactName = pName;
                  break;
                }
              }
            }
          }
          
          let cleanNumber = normalizeJidUser(jid);
          if (!cleanNumber) {
            conversationsSkippedInvalid++;
            continue;
          }

          const isConversationGroup = jid.includes('@g.us');
          const isConversationLid = jid.includes('@lid');
          const isConversationPrivate = jid.includes('@s.whatsapp.net') || isConversationLid;

          if (isIgnoredChatJid(jid) || (!isConversationGroup && !isConversationPrivate)) {
            conversationsSkippedInvalid++;
            continue;
          }

          await rememberLidMappingsFromPayload(instanceId, conversation);
          
          // Resolve LID to PN JID if applicable in HistorySync
          if (isConversationLid) {
            const resolvedPn = await resolveLidToPn(cleanNumber);
            if (!resolvedPn) {
              conversationsSkippedLidUnresolved++;
              continue;
            }
            cleanNumber = resolvedPn;
          }

          if (isConversationGroup) {
            if (!isValidGroupNumber(cleanNumber)) {
              conversationsSkippedInvalid++;
              continue;
            }
          } else if (!isValidPrivateNumber(cleanNumber)) {
            conversationsSkippedInvalid++;
            continue;
          }

          const candidateName = typeof contactName === 'string' ? contactName.trim() : '';
          const cleanConversationName = candidateName && !/^\+?[0-9]+$/.test(candidateName) && candidateName !== 'Ahmed Emad'
            ? candidateName
            : null;
          const stableConversationName = await getStableContactName(instanceId, cleanNumber, cleanConversationName);

          await upsertChatContact({
            instanceId,
            number: cleanNumber,
            contactName: stableConversationName || cleanConversationName,
            isGroup: isConversationGroup
          });
          contactsImported++;
          
          for (const msg of messages) {
            messagesSeen++;
            const webMessage = msg.message || msg.Message || {};
            const key = webMessage.key || webMessage.Key || {};
            const messageContent = unwrapMessageContent(webMessage.message || webMessage.Message || {});
            const timestamp = Number(webMessage.messageTimestamp || webMessage.MessageTimestamp || 0);

            await rememberLidMappingsFromPayload(instanceId, webMessage, key);
            
            if (timestamp < thresholdSeconds) {
              messagesSkippedOld++;
              continue;
            }
            
            const messageId = key.id || key.ID;
            if (!messageId) {
              messagesSkippedMissingId++;
              continue;
            }
            
            const exists = await prisma.inboxMessage.findUnique({
              where: { id: messageId }
            });
            if (exists) {
              messagesSkippedDuplicate++;
              continue;
            }
            
            const fromMe = key.fromMe !== undefined ? key.fromMe : (key.FromMe !== undefined ? key.FromMe : false);
            
            const parsedMessage = parseWhatsAppMessageText(webMessage.message || webMessage.Message || {});
            if (!parsedMessage.shouldSave) {
              console.log(`[Webhook HistorySync] Skipped unsupported message ${messageId}: ${parsedMessage.reason || 'not displayable'}`);
              messagesSkippedUnsupported++;
              continue;
            }

            let text = parsedMessage.text;
            
            // Extract quoted message context if available in HistorySync
            let qMsg = null;
            let qStanzaId = '';
            let qParticipant = '';
            
            const extContext = messageContent.extendedTextMessage?.contextInfo || messageContent.ExtendedTextMessage?.ContextInfo;
            const imgContext = messageContent.imageMessage?.contextInfo || messageContent.ImageMessage?.ContextInfo;
            const audContext = messageContent.audioMessage?.contextInfo || messageContent.AudioMessage?.ContextInfo;
            const vidContext = messageContent.videoMessage?.contextInfo || messageContent.VideoMessage?.ContextInfo;
            const docContext = messageContent.documentMessage?.contextInfo || messageContent.DocumentMessage?.ContextInfo;
            
            const ctxInfo = extContext || imgContext || audContext || vidContext || docContext;
            if (ctxInfo) {
              qMsg = ctxInfo.quotedMessage || ctxInfo.QuotedMessage;
              qStanzaId = ctxInfo.stanzaId || ctxInfo.StanzaId || ctxInfo.stanzaID || ctxInfo.StanzaID || '';
              qParticipant = ctxInfo.participant || ctxInfo.Participant || '';
            }
            
            let dbText = text;
            if (qMsg && qStanzaId) {
              let qText = '';
              const qConv = qMsg.conversation || qMsg.Conversation;
              const qExt = qMsg.extendedTextMessage?.text || qMsg.ExtendedTextMessage?.text;
              
              if (typeof qMsg === 'string') qText = qMsg;
              else if (qConv) qText = qConv;
              else if (qExt) qText = qExt;
              else if (qMsg.imageMessage || qMsg.ImageMessage) qText = '📷 صورة';
              else if (qMsg.audioMessage || qMsg.AudioMessage) qText = '🎙️ رسالة صوتية';
              else if (qMsg.videoMessage || qMsg.VideoMessage) qText = '🎥 فيديو';
              else if (qMsg.stickerMessage || qMsg.StickerMessage) qText = '✨ ملصق';
              else if (qMsg.documentMessage || qMsg.DocumentMessage) qText = '📄 مستند';
              else qText = 'رسالة وسائط';
              
              let cleanQuotedParticipant = qParticipant ? normalizeJidUser(qParticipant) : '';
              if (qParticipant && qParticipant.includes('@lid')) {
                const resolvedQuotedPn = await resolveLidToPn(cleanQuotedParticipant);
                if (resolvedQuotedPn) {
                  cleanQuotedParticipant = resolvedQuotedPn;
                }
              }
              
              dbText = JSON.stringify({
                _isReply: true,
                text: text,
                quotedId: qStanzaId,
                quotedText: qText,
                quotedParticipant: cleanQuotedParticipant
              });
            }

            const type = fromMe ? 'SENT' : 'RECEIVED';
            const msgDate = new Date(timestamp * 1000);
            
            // If it is a group message received from someone else, wrap the text with sender metadata
            const isGroup = isConversationGroup;
            if (isGroup && !fromMe) {
              const senderJid = key.participant || key.Participant || '';
              const senderNumber = senderJid ? normalizeJidUser(senderJid) : '';
              const senderName = webMessage.pushName || webMessage.PushName || senderNumber || 'مشارك';
              
              dbText = JSON.stringify({
                _isGroupMessage: true,
                senderName: senderName,
                text: dbText
              });
            }

            try {
              await prisma.messageLog.create({
                data: {
                  id: messageId,
                  instanceId,
                  number: cleanNumber,
                  contactName: stableConversationName || null,
                  text: dbText,
                  type,
                  status: 'READ',
                  createdAt: msgDate
                }
              });
            } catch (logErr: any) {
              if (logErr?.code !== 'P2002') {
                console.warn('[Webhook HistorySync] MessageLog write warning:', logErr.message);
              }
            }

            await saveInboxMessage({
              id: messageId,
              instanceId,
              number: cleanNumber,
              contactName: stableConversationName || null,
              text: dbText,
              type,
              status: 'READ',
              createdAt: msgDate,
              isGroup
            });
            
            messagesImported++;
          }
        }
        console.log(
          `[Webhook HistorySync] Success. conversations=${conversations.length}, contactsImported=${contactsImported}, messagesSeen=${messagesSeen}, ` +
          `messagesImported=${messagesImported}, skippedOld=${messagesSkippedOld}, skippedMissingId=${messagesSkippedMissingId}, ` +
          `skippedDuplicate=${messagesSkippedDuplicate}, skippedUnsupported=${messagesSkippedUnsupported}, ` +
          `skippedInvalidConversations=${conversationsSkippedInvalid}, skippedLidUnresolved=${conversationsSkippedLidUnresolved}`
        );
      } catch (err: any) {
        console.error('[Webhook HistorySync Error] History sync failed:', err.message);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

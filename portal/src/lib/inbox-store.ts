import { prisma } from '@/lib/db';

const invalidContactNames = new Set(['', 'Ahmed Emad']);

export function isImportPlaceholder(text?: string | null) {
  if (!text) return false;
  return text.startsWith('تم استيراد جهة الاتصال:') || text.startsWith('ØªÙ… Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ø¬Ù‡Ø© Ø§Ù„Ø§ØªØµØ§Ù„:');
}

export function cleanStoredContactName(name?: string | null) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed || invalidContactNames.has(trimmed) || /^\+?[0-9]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function getWhatsAppMessageId(storedId: string, instanceId?: string) {
  if (!storedId) return storedId;
  if (instanceId && storedId.startsWith(`${instanceId}:`)) {
    return storedId.slice(instanceId.length + 1);
  }

  const scopedIdMatch = storedId.match(/^[0-9a-fA-F-]{36}:(.+)$/);
  return scopedIdMatch ? scopedIdMatch[1] : storedId;
}

async function getInboxStorageId(instanceId: string, whatsappMessageId: string) {
  const existing = await prisma.inboxMessage.findUnique({
    where: { id: whatsappMessageId },
    select: { instanceId: true }
  });

  if (!existing || existing.instanceId === instanceId) {
    return whatsappMessageId;
  }

  return `${instanceId}:${whatsappMessageId}`;
}

export async function upsertChatContact(params: {
  instanceId: string;
  number: string;
  contactName?: string | null;
  isGroup?: boolean;
}) {
  const contactName = cleanStoredContactName(params.contactName);

  await prisma.chatContact.upsert({
    where: {
      instanceId_number: {
        instanceId: params.instanceId,
        number: params.number
      }
    },
    create: {
      instanceId: params.instanceId,
      number: params.number,
      contactName,
      isGroup: !!params.isGroup
    },
    update: {
      ...(contactName ? { contactName } : {}),
      isGroup: !!params.isGroup
    }
  });
}

export async function getStableContactName(instanceId: string, number: string, fallback?: string | null) {
  const contact = await prisma.chatContact.findUnique({
    where: {
      instanceId_number: {
        instanceId,
        number
      }
    },
    select: { contactName: true }
  });

  return cleanStoredContactName(contact?.contactName) || cleanStoredContactName(fallback);
}

export async function saveInboxMessage(params: {
  id?: string | null;
  instanceId: string;
  number: string;
  contactName?: string | null;
  text: string;
  type: string;
  status?: string;
  createdAt?: Date;
  isGroup?: boolean;
}) {
  if (!params.number || params.number === 'status' || params.number.startsWith('status:')) {
    return null;
  }

  if (isImportPlaceholder(params.text)) {
    await upsertChatContact({
      instanceId: params.instanceId,
      number: params.number,
      contactName: params.contactName,
      isGroup: params.isGroup
    });
    return null;
  }

  const stableName = await getStableContactName(params.instanceId, params.number, params.contactName);

  await upsertChatContact({
    instanceId: params.instanceId,
    number: params.number,
    contactName: stableName,
    isGroup: params.isGroup
  });

  const data = {
    instanceId: params.instanceId,
    number: params.number,
    contactName: stableName,
    text: params.text,
    type: params.type,
    status: params.status || 'SENT',
    createdAt: params.createdAt
  };

  if (params.id) {
    const storageId = await getInboxStorageId(params.instanceId, params.id);
    return prisma.inboxMessage.upsert({
      where: { id: storageId },
      create: { id: storageId, ...data },
      update: data
    });
  }

  return prisma.inboxMessage.create({ data });
}

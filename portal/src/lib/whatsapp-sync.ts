import { prisma } from '@/lib/db';
import { whatsapp } from './whatsapp';
import { resolveLidToPn } from './lid';
import { cleanStoredContactName, upsertChatContact } from './inbox-store';

const ENGINE_URL = process.env.WHATSAPP_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080';
const RECENT_HISTORY_SYNC_DAYS = 7;

const globalForSync = globalThis as unknown as {
  contactSyncInFlight?: Set<string>;
};

const contactSyncInFlight = globalForSync.contactSyncInFlight ?? new Set<string>();

if (process.env.NODE_ENV !== 'production') {
  globalForSync.contactSyncInFlight = contactSyncInFlight;
}

type SyncContactsOptions = {
  requestHistorySync?: boolean;
};

const shouldFillContactName = {
  OR: [
    { contactName: null },
    { contactName: '' },
    { contactName: 'Ahmed Emad' }
  ]
};

async function requestRecentHistorySync(instanceId: string, token: string) {
  try {
    await whatsapp.requestFullHistorySync(token, RECENT_HISTORY_SYNC_DAYS);
    console.log(`[Auto-Sync Contacts] Requested WhatsApp history sync for last ${RECENT_HISTORY_SYNC_DAYS} days for ${instanceId}`);
    return true;
  } catch (historyErr: any) {
    console.warn('[Auto-Sync Contacts] Full history sync request notice:', historyErr.message);
    try {
      await whatsapp.reconnect(token);
      console.log(`[Auto-Sync Contacts] Requested WhatsApp history sync fallback by reconnecting ${instanceId}`);
      return true;
    } catch (reconnectErr: any) {
      console.warn('[Auto-Sync Contacts] Reconnect history sync fallback notice:', reconnectErr.message);
      return false;
    }
  }
}

export async function syncContacts(instanceId: string, token: string, options: SyncContactsOptions = {}) {
  if (contactSyncInFlight.has(instanceId)) {
    console.log(`[Auto-Sync Contacts] Sync already running for ${instanceId}; skipping duplicate request.`);
    const historySyncRequested = options.requestHistorySync
      ? await requestRecentHistorySync(instanceId, token)
      : false;
    return { success: true, totalContacts: 0, syncedCount: 0, skipped: true, historySyncRequested };
  }

  contactSyncInFlight.add(instanceId);

  try {
    try {
      const portalBaseUrl = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.PORTAL_URL || 'https://convobest.com';
      const webhookUrl = `${portalBaseUrl}/api/webhooks/whatsapp`;
      const subscribe = ['MESSAGE', 'READ_RECEIPT', 'CONNECTION', 'HISTORY_SYNC', 'GROUP'];
      await whatsapp.connect(token, webhookUrl, subscribe);
      console.log(`[Auto-Sync Contacts] Subscriptions updated successfully for ${instanceId}`);
    } catch (subErr: any) {
      console.warn('[Auto-Sync Contacts] Subscription update notice:', subErr.message);
    }

    console.log(`[Auto-Sync Contacts] Fetching contacts for instance ${instanceId}...`);
    const res = await fetch(`${ENGINE_URL}/user/contacts`, {
      method: 'GET',
      headers: {
        apikey: token,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Go Engine responded with ${res.status}: ${errorText}`);
    }

    const body = await res.json();
    const contacts = body.data || [];

    if (!Array.isArray(contacts)) {
      throw new Error('Invalid contacts format returned by Go Engine');
    }

    console.log(`[Auto-Sync Contacts] Fetching groups for instance ${instanceId}...`);
    let groups: any[] = [];
    try {
      const groupRes = await fetch(`${ENGINE_URL}/group/list`, {
        method: 'GET',
        headers: {
          apikey: token,
          'Content-Type': 'application/json'
        }
      });
      if (groupRes.ok) {
        const groupBody = await groupRes.json();
        groups = groupBody.data || [];
        console.log(`[Auto-Sync Contacts] Found ${groups.length} groups.`);
      } else {
        console.warn(`[Auto-Sync Contacts] Failed to fetch groups, status: ${groupRes.status}`);
      }
    } catch (groupErr: any) {
      console.warn('[Auto-Sync Contacts] Error fetching groups:', groupErr.message);
    }

    console.log(`[Auto-Sync Contacts] Found ${contacts.length} contacts. Syncing to local contacts...`);

    let syncedCount = 0;

    for (const contact of contacts) {
      if (!contact.Jid) continue;

      let cleanNumber = contact.Jid.split('@')[0];
      if (!cleanNumber) continue;

      if (contact.Jid.includes('@lid')) {
        const resolvedPn = await resolveLidToPn(cleanNumber);
        if (!resolvedPn) continue;
        cleanNumber = resolvedPn;
      }

      const existingContact = await prisma.chatContact.findUnique({
        where: {
          instanceId_number: {
            instanceId,
            number: cleanNumber
          }
        },
        select: { contactName: true }
      });

      const hasFullName = !!contact.FullName;
      const cleanName = cleanStoredContactName(contact.FullName || contact.PushName);

      await upsertChatContact({
        instanceId,
        number: cleanNumber,
        contactName: cleanName,
        isGroup: false
      });

      if (!existingContact) {
        syncedCount++;
      }

      if (cleanName && (hasFullName || !existingContact?.contactName)) {
        await prisma.inboxMessage.updateMany({
          where: {
            instanceId,
            number: cleanNumber,
            ...(hasFullName ? {} : shouldFillContactName)
          },
          data: { contactName: cleanName }
        });
      }
    }

    console.log(`[Auto-Sync Contacts] Syncing ${groups.length} groups to local contacts...`);
    let groupSyncedCount = 0;

    for (const group of groups) {
      const groupJid = group.JID || group.jid;
      if (!groupJid) continue;

      const cleanNumber = groupJid.split('@')[0];
      if (!cleanNumber) continue;

      const cleanName = cleanStoredContactName(group.Name || group.subject || group.GroupName?.Name || group.GroupName?.name);
      const exists = await prisma.chatContact.findUnique({
        where: {
          instanceId_number: {
            instanceId,
            number: cleanNumber
          }
        },
        select: { id: true }
      });

      await upsertChatContact({
        instanceId,
        number: cleanNumber,
        contactName: cleanName,
        isGroup: true
      });

      if (!exists) {
        groupSyncedCount++;
      }

      if (cleanName) {
        await prisma.inboxMessage.updateMany({
          where: {
            instanceId,
            number: cleanNumber,
            ...shouldFillContactName
          },
          data: { contactName: cleanName }
        });
      }
    }

    const historySyncRequested = options.requestHistorySync
      ? await requestRecentHistorySync(instanceId, token)
      : false;

    return {
      success: true,
      totalContacts: contacts.length + groups.length,
      syncedCount: syncedCount + groupSyncedCount,
      historySyncRequested
    };
  } catch (error: any) {
    console.error('[Auto-Sync Contacts] Contacts/Groups sync error:', error);
    throw error;
  } finally {
    contactSyncInFlight.delete(instanceId);
  }
}

export async function syncContactsWithRetry(instanceId: string, token: string, options: SyncContactsOptions = {}, maxRetries = 5, delayMs = 5000) {
  let attempt = 0;

  const runSync = async () => {
    attempt++;
    console.log(`[Auto-Sync Retry] Attempt ${attempt}/${maxRetries} for instance ${instanceId}...`);
    try {
      const result = await syncContacts(instanceId, token, options);

      if (result.totalContacts > 0 || result.historySyncRequested) {
        console.log(`[Auto-Sync Retry Success] Synced ${result.totalContacts} contacts on attempt ${attempt}. History requested: ${result.historySyncRequested ? 'yes' : 'no'}.`);
        return result;
      }

      if (attempt < maxRetries) {
        console.log(`[Auto-Sync Retry] Found 0 contacts. Retrying in ${delayMs / 1000} seconds...`);
        setTimeout(runSync, delayMs);
      } else {
        console.log('[Auto-Sync Retry] Max retries reached. Found 0 contacts.');
      }
    } catch (err: any) {
      console.error(`[Auto-Sync Retry Error] Attempt ${attempt} failed:`, err.message);
      if (attempt < maxRetries) {
        setTimeout(runSync, delayMs);
      }
    }
  };

  runSync();
}

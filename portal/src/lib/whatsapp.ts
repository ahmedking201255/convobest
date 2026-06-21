import { prisma } from './db';
import { spawn } from 'node:child_process';

const API_URL = process.env.WHATSAPP_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080';
const GLOBAL_API_KEY = process.env.NEXT_PUBLIC_GLOBAL_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';
const ENGINE_ENSURE_SCRIPT = process.env.WHATSAPP_ENGINE_ENSURE_SCRIPT || '/home/u206521676/convobest-go/ensure-engine.sh';

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function recoverLocalEngine() {
  if (process.platform !== 'linux' || !API_URL.includes('127.0.0.1:8080')) return false;

  try {
    const child = spawn('/usr/bin/setsid', [ENGINE_ENSURE_SCRIPT], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    return false;
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await delay(1000);
    try {
      const health = await fetch(`${API_URL}/server/ok`, {
        signal: AbortSignal.timeout(2000),
        cache: 'no-store',
      });
      if (health.ok) return true;
    } catch {
      // Give the runner time to load its database and reconnect instances.
    }
  }

  return false;
}

async function fetchEngine(url: string, options: RequestInit) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (!(await recoverLocalEngine())) throw error;
    return fetch(url, options);
  }
}

// Base helper for Go Engine admin requests
async function adminRequest(path: string, method: string = 'GET', body?: any) {
  const headers = {
    'apikey': GLOBAL_API_KEY,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetchEngine(`${API_URL}${path}`, options);
  } catch (error: any) {
    throw new Error(`محرك واتساب غير متاح على ${API_URL}. تأكد أن Go Engine يعمل وأن المنفذ 8080 مفتوح. ${error?.message || ''}`.trim());
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `API error: ${response.status}`);
  }

  return data;
}

// Base helper for specific instance request (using instance token)
async function instanceRequest(path: string, token: string, method: string = 'GET', body?: any, timeoutMs?: number) {
  const headers = {
    'apikey': token,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  if (timeoutMs) {
    options.signal = AbortSignal.timeout(timeoutMs);
  }

  let response: Response;
  try {
    response = await fetchEngine(`${API_URL}${path}`, options);
  } catch (error: any) {
    throw new Error(`محرك واتساب غير متاح على ${API_URL}. تأكد أن Go Engine يعمل وأن رقم واتساب متصل. ${error?.message || ''}`.trim());
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `API error: ${response.status}`);
  }

  return data;
}

export const whatsapp = {
  // Admin Operations (Create/Delete)
  async createInstance(instanceId: string, token: string) {
    return adminRequest('/instance/create', 'POST', {
      instanceId,
      name: instanceId,
      token,
    });
  },

  async deleteInstance(instanceId: string) {
    return adminRequest(`/instance/delete/${instanceId}`, 'DELETE');
  },

  // Instance specific operations
  async getStatus(token: string) {
    try {
      return await instanceRequest('/instance/status', token, 'GET');
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('client disconnected') || message.includes('not connected')) {
        return {
          data: {
            Connected: false,
            LoggedIn: false
          },
          message: error?.message || 'client disconnected'
        };
      }
      throw error;
    }
  },

  async getQR(token: string) {
    return instanceRequest('/instance/qr', token, 'GET');
  },

  async connect(token: string, webhookUrl?: string, subscribe?: string[]) {
    const body: any = {};
    if (webhookUrl) body.webhookUrl = webhookUrl;
    if (subscribe) body.subscribe = subscribe;
    return instanceRequest('/instance/connect', token, 'POST', body);
  },

  async disconnect(token: string) {
    return instanceRequest('/instance/disconnect', token, 'POST');
  },

  async reconnect(token: string) {
    return instanceRequest('/instance/reconnect', token, 'POST');
  },

  async requestFullHistorySync(token: string, days = 7) {
    return instanceRequest('/chat/full-history-sync', token, 'POST', { days });
  },

  async logout(token: string) {
    return instanceRequest('/instance/logout', token, 'DELETE');
  },

  async checkConflict(instanceId: string, userId: string, token: string, jid: string): Promise<boolean> {
    if (!jid) return false;

    // Extract base phone number from JID (e.g. 201011198155 from 201011198155:1@s.whatsapp.net)
    const phone = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
    if (!phone) return false;

    // Avoid Prisma string filters here. On MariaDB they can emit LIKE with mixed
    // collations after the MySQL migration, which breaks live status checks.
    const connectedInstances = await prisma.whatsAppInstance.findMany({
      where: {
        status: 'CONNECTED',
        userId: { not: userId }
      },
      select: { id: true, userId: true, jid: true }
    });

    const conflict = connectedInstances.find((candidate) => {
      const candidatePhone = candidate.jid?.split('@')[0].split(':')[0].replace(/\D/g, '');
      return candidatePhone === phone;
    });

    if (conflict) {
      console.warn(`[Conflict Detection] Phone ${phone} of instance ${instanceId} conflicts with instance ${conflict.id} of user ${conflict.userId}. Forcing logout.`);
      
      try {
        // Disconnect from Go WhatsApp Engine
        await this.logout(token);
      } catch (err) {
        console.warn(`[Conflict Detection] Failed to force logout instance ${instanceId}:`, err);
      }

      // Mark this instance as conflict in DB and clear any JID
      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: { status: 'CONFLICT', jid: null }
      });

      return true; // Conflict detected and handled
    }

    return false; // No conflict
  },

  // Messaging operations
  async sendText(token: string, number: string, text: string, quoted?: { messageId: string; participant: string }) {
    const body: any = {
      number,
      text,
    };
    if (quoted) {
      body.quoted = {
        messageId: quoted.messageId,
        participant: quoted.participant,
      };
    }
    return instanceRequest('/send/text', token, 'POST', body);
  },

  async sendMedia(token: string, number: string, mediaUrl: string, caption?: string, mediaType: string = 'image', fileName?: string) {
    return instanceRequest('/send/media', token, 'POST', {
      number,
      type: mediaType,
      url: mediaUrl,
      caption,
      filename: fileName,
    });
  },

  async sendSticker(token: string, number: string, stickerUrl: string) {
    return instanceRequest('/send/sticker', token, 'POST', {
      number,
      sticker: stickerUrl,
    });
  },

  async setPresence(token: string, number: string, state: 'composing' | 'recording' | 'paused', isAudio = false) {
    return instanceRequest('/message/presence', token, 'POST', {
      number,
      state,
      isAudio
    });
  },

  async markRead(token: string, number: string, ids: string[]) {
    return instanceRequest('/message/markread', token, 'POST', {
      number,
      id: ids
    });
  },

  async reactToMessage(token: string, number: string, messageId: string, reaction: string, fromMe: boolean, participant?: string) {
    const body: any = {
      number,
      id: messageId,
      reaction: reaction || 'remove',
      fromMe
    };
    if (participant) body.participant = participant;
    return instanceRequest('/message/react', token, 'POST', body);
  },

  async deleteMessageForEveryone(token: string, chat: string, messageId: string) {
    return instanceRequest('/message/delete', token, 'POST', {
      chat,
      number: chat,
      messageId
    });
  },

  async getAvatar(token: string, number: string, preview = true) {
    return instanceRequest('/user/avatar', token, 'POST', {
      number,
      preview
    }, 3000); // 3 seconds timeout
  }
};

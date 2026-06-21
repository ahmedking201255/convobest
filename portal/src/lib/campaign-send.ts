import { whatsapp } from './whatsapp';
import { sendWithMessageQuota } from './message-quota';

const CAMPAIGN_ATTACHMENT_TYPES = new Set(['image', 'video', 'document']);

type CampaignLike = {
  userId: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
};

export function normalizeCampaignAttachment(attachment: any) {
  if (!attachment) return null;

  const mediaUrl = String(attachment.mediaUrl || attachment.url || '').trim();
  const mediaType = String(attachment.mediaType || attachment.type || '').trim().toLowerCase();
  const fileName = String(attachment.fileName || attachment.name || '').trim();
  const mime = String(attachment.mime || attachment.mimetype || '').trim();

  if (!mediaUrl || !CAMPAIGN_ATTACHMENT_TYPES.has(mediaType)) {
    throw new Error('Invalid campaign attachment');
  }

  return {
    attachmentUrl: mediaUrl,
    attachmentType: mediaType,
    attachmentName: fileName || null,
    attachmentMime: mime || null,
  };
}

export async function sendCampaignRecipientMessage(
  campaign: CampaignLike,
  instanceToken: string,
  number: string,
  messageToSend: string
) {
  if (campaign.attachmentUrl && campaign.attachmentType) {
    return sendWithMessageQuota(campaign.userId, () =>
      whatsapp.sendMedia(
        instanceToken,
        number,
        campaign.attachmentUrl || '',
        messageToSend,
        campaign.attachmentType || 'document',
        campaign.attachmentName || undefined
      )
    );
  }

  return sendWithMessageQuota(campaign.userId, () => whatsapp.sendText(instanceToken, number, messageToSend));
}

export function buildCampaignMessageLogText(campaign: CampaignLike, messageToSend: string) {
  if (!campaign.attachmentUrl || !campaign.attachmentType) return messageToSend;

  const mediaUrl = campaign.attachmentUrl;
  const isHttpMedia = /^https?:\/\//i.test(mediaUrl);
  const isDataUrl = mediaUrl.startsWith('data:');

  return JSON.stringify({
    _isMedia: true,
    mediaType: campaign.attachmentType,
    mimetype: campaign.attachmentMime || defaultCampaignMime(campaign.attachmentType),
    caption: messageToSend || '',
    fileName: campaign.attachmentName || defaultCampaignFileName(campaign.attachmentType),
    base64: isDataUrl ? mediaUrl.split(',')[1] || '' : (!isHttpMedia && mediaUrl.length > 200 ? mediaUrl : ''),
    mediaUrl: isHttpMedia ? mediaUrl : '',
  });
}

function defaultCampaignMime(mediaType: string) {
  if (mediaType === 'video') return 'video/mp4';
  if (mediaType === 'document') return 'application/octet-stream';
  return 'image/jpeg';
}

function defaultCampaignFileName(mediaType: string) {
  if (mediaType === 'video') return 'campaign-video.mp4';
  if (mediaType === 'document') return 'campaign-document';
  return 'campaign-image.jpg';
}

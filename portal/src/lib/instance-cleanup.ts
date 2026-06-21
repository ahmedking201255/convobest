import { prisma } from '@/lib/db';

export async function deleteInstanceData(instanceId: string) {
  const campaigns = await prisma.campaign.findMany({
    where: { instanceId },
    select: { id: true }
  });
  const campaignIds = campaigns.map((campaign) => campaign.id);

  await prisma.$transaction([
    prisma.inboxMessage.deleteMany({ where: { instanceId } }),
    prisma.messageLog.deleteMany({ where: { instanceId } }),
    prisma.chatContact.deleteMany({ where: { instanceId } }),
    prisma.keywordRule.deleteMany({ where: { instanceId } }),
    prisma.chatbotConfig.deleteMany({ where: { instanceId } }),
    prisma.wooCommerceConfig.deleteMany({ where: { instanceId } }),
    prisma.googleSheetsConfig.deleteMany({ where: { instanceId } }),
    ...(campaignIds.length
      ? [prisma.campaignRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } })]
      : []),
    prisma.campaign.deleteMany({ where: { instanceId } }),
    prisma.whatsAppInstance.delete({ where: { id: instanceId } })
  ]);
}

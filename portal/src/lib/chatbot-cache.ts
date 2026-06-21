interface CacheItem {
  productsText: string;
  expiry: number;
}

const chatbotCache: Record<string, CacheItem> = {};

export function getChatbotProductsCache(instanceId: string): string | null {
  const item = chatbotCache[instanceId];
  if (item && item.expiry > Date.now()) {
    return item.productsText;
  }
  return null;
}

export function setChatbotProductsCache(instanceId: string, productsText: string, ttlSeconds: number = 300) {
  chatbotCache[instanceId] = {
    productsText,
    expiry: Date.now() + ttlSeconds * 1000
  };
}

export function clearChatbotProductsCache(instanceId: string) {
  delete chatbotCache[instanceId];
}

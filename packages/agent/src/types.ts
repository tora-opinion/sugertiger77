export interface Env {
  AGENT_PAYMENTS_KV: KVNamespace;
  AGENT_CARDS_KV: KVNamespace;
  AGENT_KEYS_KV: KVNamespace;
  CARD_ENCRYPTION_KEY: string;
}

export interface PaymentRequest {
  id: string;
  amount: number;
  currency: string;
  merchant: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  cardId?: string;
  apiKeyId: string;
  apiKeyName: string;
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedCard {
  id: string;
  label: string;
  encryptedData: string;
  createdAt: string;
}

export interface CardPayload {
  number: string;
  expiry: string;
  cvv: string;
  holderName: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  createdAt: string;
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  key: string;
  createdAt: string;
}

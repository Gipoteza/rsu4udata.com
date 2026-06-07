// Shared TypeScript types used by both frontend and backend

export type Channel = 'facebook' | 'google' | 'tiktok' | 'other';

export type DatePreset = 'today' | 'week' | 'month' | 'quarter';

export type BranchId = 1 | 2 | 3 | 4;

export interface GlobalFilters {
  datePreset: DatePreset;
  branchIds: BranchId[];
  channels: Channel[];
  campaignId?: number;
}

export interface MarketingEvent {
  date: string; // YYYY-MM-DD
  channel: Channel;
  campaignId: number;
  branchId: BranchId;
  spend: number;
  clicks: number;
  impressions: number;
  leads: number;
  qualifiedLeads: number;
  sales: number;
  revenue: number;
}

export interface KpiBundle {
  spend: number | null;
  revenue: number | null;
  profit: number | null;
  roas: number | null;
  cac: number | null;
  cpl: number | null;
  cpa: number | null;
  leads: number | null;
  sales: number | null;
  ltv: number | null;
  paybackDays: number | null;
}

export interface FunnelStage {
  name: string;
  value: number;
  conversionRate: number | null; // rate from previous stage
  byChannel: Record<Channel, number>;
}

export interface ChannelMetrics {
  channel: Channel;
  spend: number | null;
  leads: number | null;
  cpa: number | null;
  revenue: number | null;
  roas: number | null;
}

export interface CampaignRow {
  campaignId: number;
  campaignName: string;
  channel: Channel;
  spend: number | null;
  ctr: number | null;
  cpc: number | null;
  leads: number | null;
  cpa: number | null;
  revenue: number | null;
  roas: number | null;
}

export interface CreativeMetrics {
  adId: number;
  creativeName: string;
  previewUrl: string | null;
  campaignName: string;
  ctr: number | null;
  engagement: number | null;
  cpa: number | null;
  conversions: number | null;
}

export interface ForecastResult {
  expectedLeads: number | null;
  expectedQualifiedLeads: number | null;
  expectedSales: number | null;
  expectedRevenue: number | null;
  expectedProfit: number | null;
  lowConfidence: boolean;
}

export type IntegrationStatus = 'connected' | 'requires_reconnect' | 'not_connected';

export interface BranchIntegrationStatus {
  branchId: BranchId;
  branchName: string;
  kommoStatus: IntegrationStatus;
  lastSyncedAt: string | null;
}

export interface IntegrationLogEntry {
  id: number;
  timestamp: string;
  integrationType: 'kommo' | 'facebook';
  branchId: BranchId | null;
  accountId: number | null;
  status: 'success' | 'error';
  recordsSynced: number | null;
  errorMessage: string | null;
}

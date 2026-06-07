# Документ проектирования: RSU4U Marketing Analytics Dashboard

## Обзор

RSU4U Marketing Analytics Dashboard — веб-платформа для Digital Director / Head of Marketing, объединяющая данные из CRM Kommo (4 филиала) и Facebook Ads в единый формат MarketingEvent, рассчитывающая KPI воронки продаж и предоставляющая визуальный анализ через 5 дашбордов, а также модуль прогнозирования бюджета.

### Ключевые задачи системы

- Сбор и нормализация данных из Kommo и Facebook Ads в единый слой `daily_metrics`
- Расчёт KPI: CPL, CPA, CAC, ROAS, Profit, ConversionRate, LTV, PaybackPeriod
- Визуализация аналитики через ApexCharts (CEO Overview, Funnel, Channels, Campaigns, Creatives)
- Прогнозирование результатов по вводимому рекламному бюджету
- Журналирование всех интеграционных операций

### Ограничения первой версии

- Ровно 1 учётная запись Admin
- Ровно 4 филиала (Branch 1..Branch 4)
- Каналы: Facebook, Google, TikTok, Other
- Хостинг: Railway (3 сервиса: Frontend, Backend, Database)

---

## Архитектура

### Общая схема

```
┌─────────────────────────────────────────────────────────────────┐
│                        КЛИЕНТСКИЙ УРОВЕНЬ                        │
│   React + TypeScript + React Router + React Query + ApexCharts  │
│                                                                   │
│  AuthContext → DashboardLayout → GlobalFiltersBar                │
│  Pages: CeoOverview | Funnel | Channel | Campaign | Creative     │
│         Forecasting | Integrations | IntegrationLogs             │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS / REST API
┌──────────────────────────────▼──────────────────────────────────┐
│                         СЕРВЕРНЫЙ УРОВЕНЬ                        │
│              Node.js + Express + TypeScript                      │
│                                                                   │
│  Controllers → Services → Integrations → DB Repositories        │
│                                                                   │
│  Auth     │ Branches  │ KommoSync  │ FacebookSync               │
│  Service  │ Service   │ Service    │ Service                     │
│           │           │            │                              │
│  DataProcessingLayer (MarketingEvent → daily_metrics)            │
│  ForecastingService                                              │
│  LoggingService                                                  │
│                                                                   │
│  node-cron (hourly sync jobs)                                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Knex + pg
┌──────────────────────────────▼──────────────────────────────────┐
│                      УРОВЕНЬ ДАННЫХ                              │
│                   PostgreSQL (Railway)                           │
│                                                                   │
│  users | branches | kommo_accounts | facebook_accounts           │
│  campaigns | ad_spend | leads | deals | sales                    │
│  daily_metrics | forecasts | integration_logs                    │
└─────────────────────────────────────────────────────────────────┘
```

### Принципы архитектуры

1. **Слоистость**: controllers → services → integrations → repositories → DB. Каждый слой зависит только от нижележащего.
2. **Расширяемость каналов**: новый Channel реализует интерфейс `IChannelIntegration` и `IChannelMapper` без изменения схемы MarketingEvent или страниц дашборда.
3. **Единый формат данных**: любая интеграция на выходе поставляет `MarketingEvent[]`; дашборды и forecasting работают только с `daily_metrics`.
4. **Stateless Backend**: состояние сессии хранится в JWT (HTTP-only cookie); состояние фильтров хранится в `sessionStorage` на клиенте.
5. **Шифрование токенов**: OAuth-токены Kommo и Facebook хранятся в DB в зашифрованном виде (AES-256-GCM); ключ — переменная окружения Railway.

### Диаграмма потока данных

```
Kommo API ──► KommoSyncJob ──►┐
                               │
Facebook API ► FacebookSyncJob ─► DataProcessingLayer ──► daily_metrics
                               │         │
                               │    integration_logs
                               │
                         daily_metrics ──► KPI Calculations ──► REST API ──► Frontend
                                      ──► ForecastingService ──► forecasts
```

### Диаграмма фронтенд-навигации

```
/login
  └─► /dashboard (DashboardLayout)
        ├── /dashboard/ceo-overview       ← CeoOverviewPage
        ├── /dashboard/funnel             ← FunnelAnalyticsPage
        ├── /dashboard/channels           ← ChannelAnalyticsPage
        ├── /dashboard/campaigns          ← CampaignAnalyticsPage
        ├── /dashboard/creatives          ← CreativeAnalyticsPage
        ├── /dashboard/forecasting        ← ForecastingPage
        ├── /dashboard/integrations       ← IntegrationsPage
        └── /dashboard/logs               ← IntegrationLogsPage
```

---

## Компоненты и интерфейсы

### Backend-компоненты

#### 1. AuthController / AuthService

```typescript
// POST /api/auth/login
interface LoginRequest  { login: string; password: string }
interface LoginResponse { token: string; expiresAt: string }

// POST /api/auth/logout
// GET  /api/auth/me

interface AuthService {
  login(login: string, password: string): Promise<LoginResponse>
  logout(token: string): Promise<void>
  verifyToken(token: string): Promise<AdminUser>
}
```

JWT хранится в HTTP-only cookie `session_token`; срок — 24 ч; bcrypt cost ≥ 10.

#### 2. BranchController / BranchService

```typescript
// GET /api/branches                   → Branch[]
// GET /api/branches/:id/status        → BranchStatus

interface Branch {
  id: number           // 1..4
  name: string         // "Branch 1"..
  kommoStatus: 'connected' | 'requires_reconnect' | 'not_connected'
}
```

#### 3. KommoIntegration / KommoSyncService

```typescript
interface IChannelIntegration {
  connect(branchId: number, oauthCode: string): Promise<void>
  syncFull(branchId: number): Promise<SyncResult>
  syncIncremental(branchId: number, since: Date): Promise<SyncResult>
}

// POST /api/integrations/kommo/connect
// POST /api/integrations/kommo/:branchId/sync
```

Токены хранятся в `kommo_accounts`, шифруются AES-256-GCM. `node-cron` запускает `syncIncremental` каждый час. Retry при HTTP 429: экспоненциальная задержка, до 5 попыток.

#### 4. FacebookIntegration / FacebookSyncService

```typescript
// Реализует IChannelIntegration
// POST /api/integrations/facebook/connect
// POST /api/integrations/facebook/sync
```

Импортирует Campaign (name, spend, impressions, clicks, CTR, CPC, CPM), Ad (creative, impressions, clicks, spend), конверсии (leads, purchases). Гранулярность: Campaign × день.

#### 5. DataProcessingLayer

```typescript
interface MarketingEvent {
  date: string          // YYYY-MM-DD
  channel: Channel      // 'Facebook' | 'Google' | 'TikTok' | 'Other'
  campaign: string
  branchId: number
  spend: number
  clicks: number
  leads: number
  qualified_leads: number
  sales: number
  revenue: number
}

interface DataProcessingLayer {
  processKommoData(branchId: number): Promise<void>
  processFacebookData(accountId: number): Promise<void>
  rebuildDailyMetrics(branchId: number, dateRange: DateRange): Promise<void>
}
```

После каждой синхронизации вызывается `rebuildDailyMetrics`. Lead без UTM-данных → Channel `Other`.

#### 6. KpiService

```typescript
interface KpiFilters {
  datePreset: 'today' | 'week' | 'month' | 'quarter'
  branchIds: number[]
  channels: Channel[]
  campaignId?: string
}

interface KpiResult {
  spend: number | null
  revenue: number | null
  profit: number | null
  roas: number | null
  cac: number | null
  cpl: number | null
  cpa: number | null
  leads: number | null
  sales: number | null
  conversionRates: { [stage: string]: number | null }
  ltv: number | null
  paybackPeriod: number | null
}

interface KpiService {
  calculate(filters: KpiFilters): Promise<KpiResult>
}
```

Деление на 0 → возвращает `null`.

#### 7. ForecastingService

```typescript
interface ForecastRequest {
  budget: number          // евро
  filters: KpiFilters
}

interface ForecastResult {
  expectedLeads: number
  expectedQualifiedLeads: number
  expectedSales: number
  expectedRevenue: number
  expectedProfit: number
  lowReliabilityWarning: boolean   // true, если < 30 leads за 90 дней
}

interface ForecastingService {
  forecast(req: ForecastRequest): Promise<ForecastResult>
  getHistoricalCoefficients(filters: KpiFilters, days: 90): Promise<HistoricalCoefficients>
}
```

Коэффициенты рассчитываются по последним 90 дням `daily_metrics`.

#### 8. LoggingService

```typescript
interface IntegrationLog {
  id: number
  timestamp: Date
  type: 'kommo' | 'facebook'
  branchId?: number
  accountId?: number
  status: 'success' | 'error' | 'partial'
  errorBody?: string       // токены скрыты/редактированы
}

// GET /api/logs?days=30
```

---

### Frontend-компоненты

#### AuthContext

```typescript
interface AuthContextValue {
  user: AdminUser | null
  isAuthenticated: boolean
  login(login: string, password: string): Promise<void>
  logout(): Promise<void>
}
```

Axios-интерсептор на 401 → `logout()` → redirect `/login`.

#### GlobalFiltersContext / GlobalFiltersBar

```typescript
interface GlobalFilters {
  datePreset: 'today' | 'week' | 'month' | 'quarter'
  branchIds: number[]      // [] = все
  channels: Channel[]      // [] = все
  campaignId: string | null
}
```

Состояние сохраняется в `sessionStorage` (ключ: `gf_state`). При изменении — инвалидация React Query кэша и перезагрузка данных.

#### DashboardLayout

- Левое/верхнее меню: 8 ссылок (CEO Overview, Funnel, Channels, Campaigns, Creatives, Forecasting, Integrations, Logs)
- Активная ссылка визуально выделена
- `GlobalFiltersBar` встроен в шапку
- Без вкладок (Tab-компонентов) внутри страниц

#### Страницы (single-scroll layout, без Tab-компонентов)

**CeoOverviewPage**
- 7 KPI-карточек: Spend, Revenue, Profit, ROAS, CAC, Leads, Sales
- Mixed-чарт: Revenue vs Spend (столбцы + линия, ось X = дни)
- Area-чарт: Growth Trend (Revenue по дням)
- Column-чарт: Channel Performance (Spend / Revenue / ROAS по каналам)
- Плейсхолдер «нет данных» при отсутствии данных

**FunnelAnalyticsPage**
- 5 этапов: Impressions → Clicks → Leads → Qualified Leads → Sales
- Абсолютные значения + ConversionRate между этапами
- Тултип при hover: разбивка по Channel
- 0 / null при отсутствии данных

**ChannelAnalyticsPage**
- Строка метрик для каждого Channel: Spend, Leads, CPA, Revenue, ROAS
- Column-чарт с переключателем Spend / Revenue / ROAS / CPA
- При выборе 1 Channel в фильтре → детализация по Campaign

**CampaignAnalyticsPage**
- Таблица: Campaign, Spend, CTR, CPC, Leads, CPA, Revenue, ROAS
- Сортировка по любому столбцу
- Пагинация при > 50 строк
- CSV-экспорт текущего содержимого таблицы

**CreativeAnalyticsPage**
- Список Creative: превью, название Campaign, CTR, Engagement, CPA, Conversions
- Клик по Creative → детальная карточка с историей метрик по дням
- Плейсхолдер при недоступном превью

**ForecastingPage**
- Поле ввода бюджета (евро)
- Результаты: Expected Leads, Qualified Leads, Sales, Revenue, Profit
- Предупреждение при < 30 leads в истории

**IntegrationsPage**
- 4 строки для Kommo (Branch 1..4): статус + кнопка подключения/ручной синхронизации
- 1 строка для Facebook: статус + кнопка подключения/синхронизации

**IntegrationLogsPage**
- Таблица логов за последние 30 дней: timestamp, тип, Branch/Account, статус, сообщение

---

## Модели данных

### Схема базы данных

```sql
-- Пользователи
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  login      VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,   -- bcrypt, cost >= 10
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Филиалы
CREATE TABLE branches (
  id   INT PRIMARY KEY,              -- 1..4
  name VARCHAR(100) NOT NULL UNIQUE  -- 'Branch 1'..'Branch 4'
);

-- Аккаунты Kommo
CREATE TABLE kommo_accounts (
  id            SERIAL PRIMARY KEY,
  branch_id     INT NOT NULL UNIQUE REFERENCES branches(id),
  subdomain     VARCHAR(255),
  access_token  TEXT,                -- AES-256-GCM encrypted
  refresh_token TEXT,                -- AES-256-GCM encrypted
  token_expires_at TIMESTAMPTZ,
  status        VARCHAR(50) NOT NULL DEFAULT 'not_connected',
  last_sync_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Аккаунты Facebook
CREATE TABLE facebook_accounts (
  id           SERIAL PRIMARY KEY,
  account_id   VARCHAR(100) NOT NULL UNIQUE,
  access_token TEXT,                -- AES-256-GCM encrypted
  status       VARCHAR(50) NOT NULL DEFAULT 'not_connected',
  last_sync_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Рекламные кампании
CREATE TABLE campaigns (
  id                  SERIAL PRIMARY KEY,
  facebook_account_id INT REFERENCES facebook_accounts(id),
  branch_id           INT REFERENCES branches(id),
  external_id         VARCHAR(100) NOT NULL,
  name                VARCHAR(500) NOT NULL,
  channel             VARCHAR(50) NOT NULL DEFAULT 'Facebook',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(external_id, channel)
);

-- Рекламные расходы (гранулярность: Campaign × день)
CREATE TABLE ad_spend (
  id          SERIAL PRIMARY KEY,
  campaign_id INT NOT NULL REFERENCES campaigns(id),
  date        DATE NOT NULL,
  spend       NUMERIC(12,2) DEFAULT 0,
  impressions INT DEFAULT 0,
  clicks      INT DEFAULT 0,
  ctr         NUMERIC(6,4) DEFAULT 0,
  cpc         NUMERIC(10,4) DEFAULT 0,
  cpm         NUMERIC(10,4) DEFAULT 0,
  leads_conv  INT DEFAULT 0,
  purchases   INT DEFAULT 0,
  UNIQUE(campaign_id, date)
);

-- Лиды
CREATE TABLE leads (
  id          SERIAL PRIMARY KEY,
  branch_id   INT NOT NULL REFERENCES branches(id),
  campaign_id INT REFERENCES campaigns(id),
  lead_id     VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  source      VARCHAR(255),
  status      VARCHAR(100),
  pipeline    VARCHAR(255),
  responsible VARCHAR(255),
  amount      NUMERIC(12,2),
  channel     VARCHAR(50) DEFAULT 'Other',
  is_qualified BOOLEAN DEFAULT FALSE,
  UNIQUE(branch_id, lead_id)
);

-- Сделки
CREATE TABLE deals (
  id         SERIAL PRIMARY KEY,
  lead_id    INT NOT NULL REFERENCES leads(id),
  value      NUMERIC(12,2),
  stage      VARCHAR(255),
  close_date DATE,
  revenue    NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Продажи (закрытые сделки)
CREATE TABLE sales (
  id         SERIAL PRIMARY KEY,
  deal_id    INT NOT NULL UNIQUE REFERENCES deals(id),
  revenue    NUMERIC(12,2) NOT NULL,
  closed_at  TIMESTAMPTZ NOT NULL
);

-- Агрегированные ежедневные метрики (MarketingEvent)
CREATE TABLE daily_metrics (
  id              SERIAL PRIMARY KEY,
  date            DATE NOT NULL,
  channel         VARCHAR(50) NOT NULL,
  campaign_id     INT REFERENCES campaigns(id),
  campaign_name   VARCHAR(500),
  branch_id       INT NOT NULL REFERENCES branches(id),
  spend           NUMERIC(12,2) DEFAULT 0,
  impressions     INT DEFAULT 0,
  clicks          INT DEFAULT 0,
  leads           INT DEFAULT 0,
  qualified_leads INT DEFAULT 0,
  sales           INT DEFAULT 0,
  revenue         NUMERIC(12,2) DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, channel, campaign_id, branch_id)
);

-- Прогнозы
CREATE TABLE forecasts (
  id                   SERIAL PRIMARY KEY,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  input_budget         NUMERIC(12,2) NOT NULL,
  filter_branch_ids    INT[],
  filter_channels      VARCHAR(50)[],
  expected_leads       NUMERIC(10,2),
  expected_qual_leads  NUMERIC(10,2),
  expected_sales       NUMERIC(10,2),
  expected_revenue     NUMERIC(12,2),
  expected_profit      NUMERIC(12,2),
  low_reliability      BOOLEAN DEFAULT FALSE
);

-- Журнал интеграций
CREATE TABLE integration_logs (
  id          SERIAL PRIMARY KEY,
  timestamp   TIMESTAMPTZ DEFAULT NOW(),
  type        VARCHAR(50) NOT NULL,    -- 'kommo' | 'facebook'
  branch_id   INT REFERENCES branches(id),
  account_id  INT,
  status      VARCHAR(50) NOT NULL,    -- 'success' | 'error' | 'partial'
  records_processed INT,
  error_body  TEXT                     -- токены скрыты
);
```

### Индексы производительности

```sql
CREATE INDEX idx_daily_metrics_date        ON daily_metrics(date);
CREATE INDEX idx_daily_metrics_branch      ON daily_metrics(branch_id);
CREATE INDEX idx_daily_metrics_channel     ON daily_metrics(channel);
CREATE INDEX idx_daily_metrics_date_branch ON daily_metrics(date, branch_id);
CREATE INDEX idx_leads_branch_created      ON leads(branch_id, created_at);
CREATE INDEX idx_ad_spend_campaign_date    ON ad_spend(campaign_id, date);
CREATE INDEX idx_integration_logs_ts       ON integration_logs(timestamp DESC);
```

### REST API — сводная таблица эндпоинтов

| Метод  | Путь                                          | Описание                              |
|--------|-----------------------------------------------|---------------------------------------|
| POST   | /api/auth/login                               | Вход, возвращает JWT-cookie           |
| POST   | /api/auth/logout                              | Выход                                 |
| GET    | /api/auth/me                                  | Текущий пользователь                  |
| GET    | /api/branches                                 | Список филиалов со статусами          |
| POST   | /api/integrations/kommo/connect               | OAuth redirect URL для Kommo          |
| GET    | /api/integrations/kommo/callback              | OAuth callback Kommo                  |
| POST   | /api/integrations/kommo/:branchId/sync        | Ручная синхронизация Kommo            |
| POST   | /api/integrations/facebook/connect            | OAuth redirect URL для Facebook       |
| GET    | /api/integrations/facebook/callback           | OAuth callback Facebook               |
| POST   | /api/integrations/facebook/sync               | Ручная синхронизация Facebook         |
| GET    | /api/kpi                                      | Расчёт всех KPI по фильтрам           |
| GET    | /api/dashboard/ceo                            | Данные страницы CEO Overview          |
| GET    | /api/dashboard/funnel                         | Данные страницы Funnel Analytics      |
| GET    | /api/dashboard/channels                       | Данные страницы Channel Analytics     |
| GET    | /api/dashboard/campaigns                      | Данные страницы Campaign Analytics    |
| GET    | /api/dashboard/creatives                      | Данные страницы Creative Analytics    |
| POST   | /api/forecasting                              | Запрос прогноза                       |
| GET    | /api/logs                                     | Журнал интеграций (30 дней)           |

---

## Свойства корректности


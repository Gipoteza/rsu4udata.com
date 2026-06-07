# Implementation Plan: RSU4U Marketing Analytics Dashboard

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

## Overview

Реализация выполняется на TypeScript: backend на Node.js + Express + Knex/Prisma + node-cron, frontend на React + ApexCharts + React Query, БД PostgreSQL. Тестирование — Jest + fast-check (backend), Vitest + RTL + fast-check (frontend), Testcontainers + nock (integration), Playwright (e2e). Каждое из 23 свойств раздела Correctness Properties в design.md покрыто отдельной property-based задачей.

## Tasks

- [ ] 1. Подготовка инфраструктуры проекта
  - [x] 1.1 Создать структуру monorepo и базовые файлы
    - Создать каталоги `backend/`, `frontend/`, `shared/` (общие TypeScript типы) с `package.json` для каждого пакета
    - Создать корневой `package.json` с workspaces, `.gitignore`, `README.md`
    - Закрепить версии Node.js (`.nvmrc`) и менеджер пакетов
    - _Requirements: 15.1, 16.1_

  - [ ] 1.2 Настроить TypeScript, ESLint и Prettier
    - Создать `tsconfig.base.json` и `tsconfig.json` для каждого пакета (strict mode)
    - Настроить ESLint и Prettier с общими правилами
    - Настроить npm-скрипты `lint`, `typecheck`
    - _Requirements: 16.1_

  - [ ] 1.3 Подготовить конфигурацию Railway
    - Создать `railway.json` (или `Dockerfile` для backend и frontend)
    - Описать три сервиса: Frontend, Backend, PostgreSQL
    - Подготовить шаблон `.env.example` с DATABASE_URL, TOKEN_ENCRYPTION_KEY, KOMMO_*, FACEBOOK_*
    - _Requirements: 15.1, 15.2, 15.3, 15.5_

  - [ ] 1.4 Настроить тестовое окружение backend (Jest + fast-check)
    - Установить `jest`, `ts-jest`, `fast-check`, `nock`, `testcontainers`
    - Создать `jest.config.ts` с разделением `unit`, `integration`, `perf` через теги
    - Добавить npm-скрипты `test`, `test:integration`, `test:perf`
    - _Requirements: 16.1_

  - [ ] 1.5 Настроить тестовое окружение frontend (Vitest + RTL)
    - Установить `vitest`, `@testing-library/react`, `fast-check`, `@playwright/test`
    - Создать `vitest.config.ts`, базовый `playwright.config.ts`
    - Добавить npm-скрипты `test`, `test:e2e`
    - _Requirements: 17.3_

- [ ] 2. Схема базы данных и слой репозиториев
  - [ ] 2.1 Реализовать миграцию users, session_tokens, branches
    - Создать таблицы `users` (Req 14.1), `session_tokens` (TTL 24ч, Req 1.6), `branches` (CHECK id IN 1..4)
    - Засидить четыре строки `branches` (Req 2.1)
    - _Requirements: 1.1, 1.6, 2.1, 14.1, 14.2_

  - [ ] 2.2 Реализовать миграцию kommo_accounts и facebook_accounts
    - Таблицы с зашифрованными токенами (`bytea`), статусами `connected`/`requires_reconnect`/`not_connected`
    - UNIQUE на `kommo_accounts.branch_id` для связи 1:1 (Req 2.2)
    - _Requirements: 2.2, 2.4, 2.7, 4.2, 4.9, 14.3, 14.4_

  - [ ] 2.3 Реализовать миграцию campaigns, ads, creatives, ad_spend, ad_daily_stats
    - `ad_spend` PK (campaign_id, date) — гранулярность «одна строка на Campaign на день» (Req 4.10, 14.6)
    - `ad_daily_stats` PK (ad_id, date) для Creative Analytics
    - CHECK `channel IN ('facebook','google','tiktok','other')` и UNIQUE (channel, external_id) для `campaigns`
    - _Requirements: 4.10, 14.5, 14.6_

  - [ ] 2.4 Реализовать миграцию leads, deals, sales, channel_mapping
    - `leads` с FK на `branches` NOT NULL и UNIQUE (branch_id, lead_id_external)
    - `deals` с FK на `leads`, `sales` как view над `deals WHERE is_won = true`
    - `channel_mapping(pattern, channel, priority)` для нормализации Lead.source → Channel
    - _Requirements: 3.9, 5.3, 14.7, 14.8, 14.9_

  - [ ] 2.5 Реализовать миграцию daily_metrics, forecasts, integration_logs
    - `daily_metrics` PK (date, channel, campaign_id, branch_id), индексы (date), (branch_id, date), (channel, date)
    - `forecasts` со срезом filters_json и коэффициентами coefficients_json
    - `integration_logs` с CHECK status, `error_body_redacted`
    - _Requirements: 13.10, 14.10, 14.11, 18.1, 18.3_

  - [ ] 2.6 Реализовать слой репозиториев на типобезопасном query-builder
    - Репозитории: `UsersRepo`, `SessionTokensRepo`, `BranchesRepo`, `KommoAccountsRepo`, `FacebookAccountsRepo`, `CampaignsRepo`, `AdsRepo`, `CreativesRepo`, `AdSpendRepo`, `AdDailyStatsRepo`, `LeadsRepo`, `DealsRepo`, `DailyMetricsRepo`, `ForecastsRepo`, `IntegrationLogsRepo`, `ChannelMappingRepo`
    - Транзакционное API через `withTransaction(fn)`
    - _Requirements: 14.12, 16.1_

  - [ ]* 2.7 Написать integration-тесты схемы БД
    - Через Testcontainers поднять PostgreSQL, прогнать миграции, проверить FK ON DELETE, UNIQUE, CHECK
    - Проверить, что `branches` содержит ровно четыре строки после миграции (Req 2.1)
    - _Requirements: 2.1, 14.12_

- [ ] 3. Аутентификация, сессии и middleware
  - [ ] 3.1 Реализовать AuthService
    - `bcrypt` cost ≥ 10 для паролей (Req 1.7)
    - JWT-выпуск с TTL 24ч (Req 1.6); запись `jti` в `session_tokens`
    - `logout` помечает `session_tokens.revoked_at` (Req 1.5)
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7_

  - [ ] 3.2 Реализовать controllers `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
    - `login` устанавливает HTTP-only cookie с JWT
    - `login` при неверных credentials возвращает 401 с обобщённым сообщением (Req 1.3)
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [ ] 3.3 Реализовать middleware проверки сессии
    - Парсит JWT из cookie, проверяет в `session_tokens` (не отозван, не истёк)
    - При 401 frontend через интерсептор перенаправляет на `/login`
    - _Requirements: 1.4, 1.6_

  - [ ]* 3.4 Property test: Property 20 — Logout инвалидирует токен
    - **Property 20:** для любой действительной сессии после `POST /api/auth/logout` любые последующие запросы с тем же токеном возвращают HTTP 401 до естественного истечения
    - **Validates: Requirements 1.5**

  - [ ]* 3.5 Unit-тесты обобщённых сообщений 401
    - Проверить, что текст ответа не раскрывает, какое поле неверно (email vs пароль)
    - _Requirements: 1.3_

- [ ] 4. OAuth helpers и безопасность токенов
  - [ ] 4.1 Реализовать OAuthHelper.encrypt/decrypt
    - AES-256-GCM, ключ из `TOKEN_ENCRYPTION_KEY`
    - Сохранение/чтение зашифрованных токенов в `kommo_accounts` и `facebook_accounts`
    - _Requirements: 2.4, 4.2, 15.3_

  - [ ] 4.2 Реализовать автоматическое обновление access_token
    - `refreshTokenIfNeeded(account)`: запрос refresh, если `expires_at − now < 60s`
    - При недействительном refresh_token — установить `status = 'requires_reconnect'`
    - _Requirements: 2.5, 2.6, 4.9_

  - [ ] 4.3 Реализовать ExponentialBackoff
    - Триггеры HTTP 429 и 5xx, задержки 1/2/4/8/16 секунд, максимум 5 повторов
    - Используется обеими интеграциями
    - _Requirements: 3.7, 4.8_

  - [ ] 4.4 Реализовать LogsService.redact()
    - Маскирование `access_token=...`, `refresh_token=...`, `Authorization: Bearer ...` в теле ошибки
    - _Requirements: 18.3_

  - [ ]* 4.5 Property test: Property 3 — round-trip шифрования OAuth-токенов
    - **Property 3:** для любой строки токена `t` выполняется `decrypt(encrypt(t)) = t`, при этом `encrypt(t) ≠ t` побайтово
    - **Validates: Requirements 2.4, 4.2**

  - [ ]* 4.6 Property test: Property 18 — корректность обновления токена OAuth
    - **Property 18:** `OAuthHelper` вызывает refresh тогда и только тогда, когда `expires_at − now < 60s`
    - **Validates: Requirements 2.5**

  - [ ]* 4.7 Property test: Property 19 — Retry-политика для интеграций
    - **Property 19:** при `k ≤ 5` подряд идущих 429 выполняется ровно `k` повторов с задержками 1/2/4/8/16s; при `k > 5` после пятой попытки — ошибка и запись в `integration_logs`
    - **Validates: Requirements 3.7, 4.8**

  - [ ]* 4.8 Property test: Property 14 — Маскирование токенов в логе ошибок
    - **Property 14:** для любой строки тела ошибки, содержащей `access_token`, `refresh_token` или `Bearer ...`, `error_body_redacted` не содержит этих подстрок в исходном виде
    - **Validates: Requirements 18.3**

- [ ] 5. Чекпоинт — фундамент готов
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Интеграция Kommo
  - [ ] 6.1 Реализовать KommoIntegration (ядро)
    - Реализация `IChannelIntegration` для Kommo: `syncIncremental`, `syncFull`, `refreshTokenIfNeeded`, `getAccountStatus`
    - Использует OAuthHelper и ExponentialBackoff
    - _Requirements: 2.3, 2.5, 3.4, 3.5, 16.2_

  - [ ] 6.2 Реализовать импорт Lead, Deal, User со связью с Branch
    - Поля Lead: lead_id, created_at, source, status, pipeline, responsible, amount; флаг `is_qualified` на основе `pipeline_stage`
    - Поля Deal: value, stage, close_date, revenue, is_won
    - Каждая запись `branch_id = Branch источника Kommo_Account` (Req 3.9)
    - _Requirements: 3.1, 3.2, 3.3, 3.9_

  - [ ] 6.3 Реализовать controllers `/api/integrations/kommo/...`
    - `POST /:branchId/connect` — старт OAuth, `GET /callback` — обработка
    - `GET /api/integrations` — статусы всех Kommo-аккаунтов (Req 2.7)
    - _Requirements: 2.3, 2.4, 2.6, 2.7_

  - [ ] 6.4 Записывать результат каждой синхронизации в integration_logs
    - Поля: timestamp, integration_type, branch_id, status, error_code, error_body_redacted, records_synced
    - При ошибке — статус `error` отображается на странице `/integrations`
    - _Requirements: 3.8, 18.1, 18.3_

  - [ ]* 6.5 Property test: Property 12 — Корректность инкрементальной синхронизации
    - **Property 12:** после `syncIncremental` обновляются ровно те записи, у которых внешний `updated_at > last_synced_at`; остальные не затронуты
    - **Validates: Requirements 3.4**

  - [ ]* 6.6 Property test: Property 13 — Журналирование каждой попытки синхронизации
    - **Property 13:** после любой попытки синхронизации (success или error) число строк в `integration_logs` увеличивается ровно на 1 со всеми обязательными полями
    - **Validates: Requirements 3.8, 18.1**

  - [ ]* 6.7 Property test: Property 21 — Связь импортированных данных с Branch
    - **Property 21:** для любой импортированной из Kommo сущности Lead/Deal/User поле `branch_id` равно идентификатору Branch исходного Kommo_Account
    - **Validates: Requirements 3.9**

  - [ ]* 6.8 Property test: Property 22 — Уникальность Kommo_Account на Branch
    - **Property 22:** для любого Branch в Database существует не более одного Kommo_Account; попытка привязать второй — отклоняется
    - **Validates: Requirements 2.2**

  - [ ]* 6.9 Integration test полного цикла Kommo
    - Через `nock` мок Kommo API + Testcontainers PostgreSQL: connect → импорт Lead/Deal → пересчёт `daily_metrics`
    - _Requirements: 2.3, 3.1, 3.2_

- [ ] 7. Интеграция Facebook Ads
  - [ ] 7.1 Реализовать FacebookIntegration (ядро)
    - Реализация `IChannelIntegration`: `syncIncremental`, `syncFull`, `refreshTokenIfNeeded`, `getAccountStatus`
    - Long-lived access token, шифруется через OAuthHelper
    - _Requirements: 4.1, 4.2, 4.6, 4.9, 16.2_

  - [ ] 7.2 Реализовать импорт Campaign, Ad, Creative, ad_spend, ad_daily_stats
    - Campaign: name, spend, impressions, clicks, CTR, CPC, CPM (Req 4.3)
    - Ad: creative, impressions, clicks, spend (Req 4.4); конверсии leads и purchases (Req 4.5)
    - Гранулярность ad_spend: одна строка на (campaign_id, date) (Req 4.10)
    - _Requirements: 4.3, 4.4, 4.5, 4.10, 14.6_

  - [ ] 7.3 Реализовать controllers `/api/integrations/facebook/...`
    - `POST /connect`, `GET /callback`
    - Статус Facebook-аккаунта в `GET /api/integrations`
    - _Requirements: 4.1, 4.2, 4.9_

  - [ ]* 7.4 Property test: Property 4 — Гранулярность ad_spend
    - **Property 4:** после любой последовательности синхронизаций Facebook не существует двух разных строк `ad_spend` с одинаковой парой `(campaign_id, date)`
    - **Validates: Requirements 4.10, 14.6**

  - [ ]* 7.5 Integration test OAuth callback Facebook
    - Через `nock` мок Facebook OAuth, проверка сохранения зашифрованного токена в `facebook_accounts`
    - _Requirements: 4.1, 4.2_

- [ ] 8. Scheduler и IntegrationOrchestrator
  - [ ] 8.1 Реализовать node-cron планировщик (часовой триггер)
    - `syncAllKommo` итерирует все подключённые Kommo_Account
    - `syncAllFacebook` итерирует все Facebook_Account
    - После завершения триггерит `DataProcessingLayer.recompute()` затронутых дат
    - _Requirements: 3.5, 4.6, 5.5_

  - [ ] 8.2 Реализовать IntegrationOrchestrator с Promise.allSettled
    - Изоляция сбоя одного аккаунта от других
    - Агрегирование результатов в массив `integration_logs`
    - _Requirements: 3.8, 18.1_

  - [ ] 8.3 Реализовать controller `POST /api/integrations/sync` для ручного запуска
    - Параметры `{ source, branchId?, accountId?, periodFrom?, periodTo? }`
    - _Requirements: 3.6, 4.7_

  - [ ]* 8.4 Unit-тесты изоляции сбоя одного аккаунта от других
    - Один Kommo_Account возвращает ошибку — три остальных продолжают синхронизироваться
    - _Requirements: 3.8_

- [ ] 9. Чекпоинт — интеграции и журналирование работают
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Data Processing Layer (MarketingEvent → daily_metrics)
  - [ ] 10.1 Реализовать channel_mapping и нормализацию Lead.source → Channel
    - Применение правил из таблицы `channel_mapping` по приоритету
    - Если ни одно правило не совпало — `channel = 'other'` (Req 5.4)
    - _Requirements: 5.3, 5.4_

  - [ ] 10.2 Реализовать алгоритм recompute() для daily_metrics
    - Для каждой затронутой даты собирать (date, channel, campaign_id, branch_id) из `ad_spend` и `leads/deals`
    - Upsert в `daily_metrics`, удаление строк без источников после пересчёта
    - _Requirements: 5.1, 5.2, 5.6, 14.10_

  - [ ] 10.3 Реализовать инкрементальный пересчёт по затронутым датам
    - Пересчитываются только даты с изменениями после последней синхронизации (Req 5.5)
    - Транзакционная семантика: при ошибке `daily_metrics` откатывается, исходные таблицы не затронуты
    - _Requirements: 5.5, 5.7_

  - [ ]* 10.4 Property test: Property 5 — Идемпотентность пересчёта daily_metrics
    - **Property 5:** повторный вызов `recompute()` без изменений исходных данных оставляет `daily_metrics` неизменным
    - **Validates: Requirements 5.5**

  - [ ]* 10.5 Property test: Property 6 — Корректность агрегации MarketingEvent
    - **Property 6:** для каждого ключа `(date, channel, campaign_id, branch_id)` сумма полей `spend, clicks, leads, qualified_leads, sales, revenue` в `daily_metrics` равна сумме соответствующих величин по всем исходным записям с тем же ключом
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 10.6 Property test: Property 7 — Fallback channel mapping в Other
    - **Property 7:** для любого Lead, чьё значение `source` не совпадает ни с одним правилом, после нормализации Lead учитывается со значением `channel = 'other'`
    - **Validates: Requirements 5.4**

  - [ ]* 10.7 Property test: Property 8 — Аддитивность метрик по Branch
    - **Property 8:** для любого подмножества `B ⊆ {Branch 1..4}` и любых аддитивных метрик `M ∈ {spend, leads, qualified_leads, sales, revenue}`: `M(branchIds=B) = Σ_{b∈B} M(branchIds=[b])`
    - **Validates: Requirements 5.6**

- [ ] 11. KpiService
  - [ ] 11.1 Реализовать чистые функции KPI
    - `safeDiv`, `cpl`, `cpa`, `cac`, `roas`, `profit`, `conversionRate`, `ltv`, `paybackDays`
    - При нулевом знаменателе — возврат `null`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [ ] 11.2 Реализовать computeKpi(filters) над daily_metrics
    - Чтение агрегированных строк по срезу Global_Filters, применение формул
    - Возврат `KpiBundle`
    - _Requirements: 6.1–6.9, 7.6_

  - [ ] 11.3 Реализовать controllers `/api/kpi`, `/api/charts/revenue-vs-spend`, `/api/charts/growth-trend`, `/api/charts/channel-performance`
    - Все эндпоинты принимают одинаковые query-параметры Global_Filters
    - Все KPI вычисляются единственным `KpiService` (одна реализация на все страницы)
    - _Requirements: 6.10, 7.1, 7.6, 8.1, 8.2, 8.3, 8.4_

  - [ ]* 11.4 Property test: Property 1 — Безопасное деление в формулах KPI
    - **Property 1:** для любого набора `(spend, leads, qualifiedLeads, sales, revenue)` рассчитанные KPI удовлетворяют формулам `cpl=spend/leads`, `cpa=spend/qualifiedLeads`, `cac=spend/sales`, `roas=revenue/spend`, `profit=revenue−spend`, `conversionRate(prev,next)=(next/prev)×100`, `ltv=totalRevenue/uniqueCustomers`, `paybackDays=(cac/avgMonthlyRevenuePerCustomer)×30`; при нулевом знаменателе или отсутствии данных KPI равен `null`
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 9.3**

  - [ ]* 11.5 Property test: Property 2 — Консистентность KPI на всех страницах
    - **Property 2:** для любого Global_Filters значение каждого KPI, возвращаемое `/api/kpi`, `/api/channels`, `/api/campaigns`, `/api/funnel`, идентично
    - **Validates: Requirements 6.10**

- [ ] 12. Funnel Analytics endpoint
  - [ ] 12.1 Реализовать controller `GET /api/funnel`
    - Этапы Impressions → Clicks → Leads → Qualified Leads → Sales
    - Conversion_Rate между соседними этапами; при пустом этапе — `value=0` и `rate=null`
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [ ] 12.2 Поддержать разбивку по Channel для тултипов
    - Для каждого этапа отдавать `byChannel: { facebook, google, tiktok, other }`
    - _Requirements: 9.4_

  - [ ]* 12.3 Unit-тесты пустых этапов воронки
    - Срез без данных → все `value=0`, `rate=null`
    - _Requirements: 9.5_

- [ ] 13. Channels / Campaigns / Creatives endpoints
  - [ ] 13.1 Реализовать `/api/channels` и `/api/channels/:channel/campaigns`
    - Строка метрик для каждого Channel из {facebook, google, tiktok, other} (Req 10.1, 10.2)
    - Детализация при выборе одного Channel (Req 10.4)
    - _Requirements: 10.1, 10.2, 10.4_

  - [ ] 13.2 Реализовать `/api/campaigns?sort=&page=&pageSize=`
    - Столбцы Campaign, Spend, CTR, CPC, Leads, CPA, Revenue, ROAS
    - Сортировка по любому столбцу (asc/desc), пагинация
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 13.3 Реализовать `GET /api/campaigns/export.csv`
    - Выгрузка текущего среза Global_Filters в CSV
    - _Requirements: 11.5_

  - [ ] 13.4 Реализовать `/api/creatives` и `/api/creatives/:id`
    - Список с превью, названием Campaign, CTR, Engagement, CPA, Conversions
    - История метрик по дням за выбранный период; обработка отсутствия preview_url
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 13.5 Property test: Property 15 — Round-trip экспорта в CSV
    - **Property 15:** для любого набора строк таблицы Campaign Analytics выполняется `parseCsv(exportToCsv(rows)) = rows` (с точностью до представления чисел и `null`)
    - **Validates: Requirements 11.5**

  - [ ]* 13.6 Property test: Property 16 — Корректность пагинации Campaign Analytics
    - **Property 16:** для любого `R` и `pageSize > 0` конкатенация всех страниц = `R` без перестановок, страницы попарно не пересекаются, размер каждой страницы кроме последней = `pageSize`
    - **Validates: Requirements 11.4**

  - [ ]* 13.7 Property test: Property 17 — Монотонность сортировки таблицы Campaign
    - **Property 17:** после клика по заголовку столбца для любых соседних строк выполняется отношение порядка по выбранному столбцу (asc или desc)
    - **Validates: Requirements 11.3**

- [ ] 14. Forecasting_Service
  - [ ] 14.1 Реализовать readHistoricalCoefficients(filters, last 90 days)
    - Расчёт `avgCpl`, `leadToQualifiedRate`, `qualifiedToSaleRate`, `averageTicket`, `historicalLeads`
    - Использование данных `daily_metrics` за последние 90 дней
    - _Requirements: 13.7, 13.8_

  - [ ] 14.2 Реализовать алгоритм прогноза в ForecastingService
    - Цепочка `expectedLeads → expectedQualifiedLeads → expectedSales → expectedRevenue → expectedProfit`
    - `lowConfidence = historicalLeads < 30`
    - При нулевых/неопределённых коэффициентах соответствующие выходные показатели = `null`
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.6, 13.9_

  - [ ] 14.3 Реализовать controller `POST /api/forecast`
    - Принимает `{ budgetEur, filters: GlobalFilters }`
    - Записывает запрос и результат в `forecasts` (timestamp, budget_eur, filters_json, coefficients_json, expected_*, low_confidence)
    - _Requirements: 13.1, 13.10, 14.11_

  - [ ]* 14.4 Property test: Property 9 — Цепочка формул прогнозирования
    - **Property 9:** для любого `budget ≥ 0` и набора коэффициентов выполняется `expectedLeads=budget/avgCpl`, `expectedQualifiedLeads=expectedLeads×leadToQualifiedRate`, `expectedSales=expectedQualifiedLeads×qualifiedToSaleRate`, `expectedRevenue=expectedSales×averageTicket`, `expectedProfit=expectedRevenue−budget`; при нулевых коэффициентах — `null`
    - **Validates: Requirements 13.2, 13.3, 13.4, 13.5, 13.6, 13.8**

  - [ ]* 14.5 Property test: Property 10 — Признак низкой надёжности прогноза
    - **Property 10:** `lowConfidence = true` тогда и только тогда, когда суммарное число Lead за последние 90 дней по срезу строго меньше 30
    - **Validates: Requirements 13.9**

  - [ ]* 14.6 Property test: Property 11 — Persistence результата прогноза
    - **Property 11:** после успешного `POST /api/forecast` в таблице `forecasts` появляется ровно одна новая строка, поля которой соответствуют отправленным/возвращённым значениям
    - **Validates: Requirements 13.10**

- [ ] 15. Журнал интеграций
  - [ ] 15.1 Реализовать controller `GET /api/logs?days=30`
    - Возвращает строки `integration_logs` за последние 30 дней с маскированными токенами
    - _Requirements: 18.1, 18.2, 18.3_

- [ ] 16. Чекпоинт — backend полностью функционален
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Frontend — основа
  - [ ] 17.1 Настроить React Router и базовый bootstrap App
    - Маршруты: `/login`, `/`, `/funnel`, `/channels`, `/campaigns`, `/creatives`, `/forecast`, `/integrations`, `/logs`
    - Подключить React Query, базовую тему (белый фон — Req 17.1)
    - _Requirements: 17.1, 17.2_

  - [ ] 17.2 Реализовать AuthContext + axios-интерсептор 401
    - HTTP-only cookie на сервере + хранение пользователя в памяти
    - При 401 — редирект на `/login`
    - _Requirements: 1.4, 1.8_

  - [ ] 17.3 Реализовать GlobalFiltersContext и GlobalFiltersBar
    - Хранение `{ datePreset, branchIds, channels, campaignId }` в Context + sessionStorage
    - При изменении значений — инвалидация и перезапрос всех активных запросов страницы
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 17.4 Реализовать DashboardLayout с навигацией
    - Левое или верхнее меню со ссылками на пять страниц + Forecasting
    - Подсветка текущего пункта (Req 17.4)
    - _Requirements: 17.1, 17.2, 17.4_

  - [ ] 17.5 Реализовать LoginPage и редирект после логина на CEO Overview
    - Сообщение «Неверный email или пароль» при 401
    - _Requirements: 1.2, 1.3, 1.8_

  - [ ]* 17.6 Property test: Property 23 — Сохранение Global_Filters при навигации
    - **Property 23:** для любых Global_Filters и любой последовательности переходов между страницами Dashboard_System в рамках одной сессии значения Global_Filters после переходов идентичны исходным
    - **Validates: Requirements 7.7**

- [ ] 18. Страницы дашборда
  - [ ] 18.1 Реализовать CeoOverviewPage
    - KPI-карточки Spend, Revenue, Profit, ROAS, CAC, Leads, Sales
    - Графики ApexCharts: Mixed (Revenue vs Spend), Area (Growth Trend), Column (Channel Performance)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 17.3_

  - [ ] 18.2 Реализовать FunnelAnalyticsPage
    - Кастомный SVG `FunnelChart` с пятью этапами
    - Подсказки с разбивкой по Channel при наведении
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 18.3 Реализовать ChannelAnalyticsPage
    - Строка метрик на Channel; Column-чарт с переключателем Spend/Revenue/ROAS/CPA
    - Детализация по Campaign при выборе одного Channel в Global_Filters
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 18.4 Реализовать CampaignAnalyticsPage
    - Таблица со столбцами Campaign, Spend, CTR, CPC, Leads, CPA, Revenue, ROAS
    - Сортировка по клику на заголовок, пагинация при > 50 строк, экспорт CSV
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 18.5 Реализовать CreativeAnalyticsPage
    - Список карточек с превью / плейсхолдером, метриками и Line-чартом истории в детальной карточке
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ] 18.6 Реализовать ForecastingPage
    - Поле бюджета в евро, отображение Expected Leads/Qualified/Sales/Revenue/Profit
    - Жёлтый баннер при `lowConfidence = true`
    - _Requirements: 13.1, 13.9, 13.10_

  - [ ] 18.7 Реализовать IntegrationsPage
    - Кнопки подключения для каждого Branch (Kommo) и Facebook
    - Индикаторы статуса «подключён» / «требует повторного подключения» / «не подключён»
    - Кнопка ручной синхронизации
    - _Requirements: 2.7, 3.6, 4.7, 4.9_

  - [ ] 18.8 Реализовать IntegrationLogsPage
    - Список из `GET /api/logs?days=30`
    - _Requirements: 18.2_

  - [ ] 18.9 Реализовать общий компонент EmptyState «нет данных»
    - Используется во всех страницах для пустых KPI/графиков
    - _Requirements: 8.5, 9.5, 12.4_

  - [ ]* 18.10 Snapshot/component-тесты страниц
    - Vitest + RTL для каждой страницы (рендер с моками React Query)
    - _Requirements: 17.3, 17.4_

  - [ ]* 18.11 e2e тест Playwright основного user flow
    - login → CEO Overview → смена Global_Filters → переход между страницами → logout
    - _Requirements: 1.2, 1.5, 7.7, 17.4_

- [ ] 19. Развёртывание и CI
  - [ ] 19.1 Настроить три сервиса Railway (Frontend, Backend, PostgreSQL)
    - Связать сервисы, проверить публичный HTTPS-URL Frontend → Backend
    - _Requirements: 15.1, 15.5_

  - [ ] 19.2 Прокинуть переменные окружения через Railway
    - DATABASE_URL, TOKEN_ENCRYPTION_KEY, KOMMO_CLIENT_ID/SECRET, FACEBOOK_CLIENT_ID/SECRET, JWT_SECRET
    - _Requirements: 15.2, 15.3_

  - [ ] 19.3 Настроить CI (GitHub Actions): lint + typecheck + npm test + integration
    - Этапы: `npm test`, `npm run test:integration`, lint, typecheck; деплой блокируется при провале
    - Автодеплой `main` через Railway после успешного CI
    - _Requirements: 15.4_

- [ ] 20. Финальный чекпоинт — все тесты, integration и e2e зелёные
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Задачи, помеченные `*`, — опциональные тестовые сабтаски, которые можно пропустить для ускоренного MVP, но они являются единственным способом верификации соответствующих свойств из design.md.
- Каждая задача ссылается на конкретные пункты requirements.md (sub-criteria, не только user stories).
- Каждое из 23 свойств раздела Correctness Properties покрыто отдельной property-based задачей.
- Чекпоинты (5, 9, 16, 20) обеспечивают инкрементальную валидацию между крупными слоями.
- Top-level задачи без декимальной нумерации не входят в Task Dependency Graph.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["2.1", "4.1", "4.3", "4.4", "11.1", "17.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "4.2", "4.5", "4.7", "4.8", "11.4", "17.2", "17.3", "17.4"] },
    { "id": 4, "tasks": ["2.6", "4.6", "17.5", "17.6", "18.9"] },
    { "id": 5, "tasks": ["2.7", "3.1", "10.1", "11.2", "14.1"] },
    { "id": 6, "tasks": ["3.2", "3.3", "6.1", "7.1", "10.2", "11.5"] },
    { "id": 7, "tasks": ["3.4", "3.5", "6.2", "6.4", "7.2", "10.3", "14.2"] },
    { "id": 8, "tasks": ["6.3", "6.5", "6.6", "6.7", "6.8", "6.9", "7.3", "7.4", "7.5", "8.1", "8.2", "10.4", "10.5", "10.6", "10.7", "11.3", "12.1", "13.1", "13.2", "13.4", "14.3", "15.1"] },
    { "id": 9, "tasks": ["8.3", "8.4", "12.2", "12.3", "13.3", "14.4", "14.5", "14.6", "18.1", "18.2", "18.3", "18.5", "18.6", "18.7", "18.8"] },
    { "id": 10, "tasks": ["13.5", "13.6", "13.7", "18.4", "19.1", "19.2", "19.3"] },
    { "id": 11, "tasks": ["18.10", "18.11"] }
  ]
}
```

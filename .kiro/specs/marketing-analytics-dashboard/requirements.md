# Requirements Document

## Introduction

RSU4U Marketing Analytics Dashboard — веб-приложение для digital-директора, которое агрегирует данные из CRM-системы Kommo и рекламных платформ (Facebook Ads), строит аналитику по воронке продаж, оценивает эффективность каналов и позволяет прогнозировать результаты при изменении рекламного бюджета.

Ключевой принцип системы отражает полный путь клиента:
**Клик → Лид → Квалифицированный лид → Продажа → Revenue → Profit**

Система разворачивается на Railway.app (frontend + backend + PostgreSQL) и рассчитана на масштабирование: подключение Google Ads, TikTok Ads, Email-маркетинга, SEO-аналитики и AI-рекомендаций в будущем.

---

## Glossary

- **Dashboard** — веб-интерфейс с визуализацией аналитических данных
- **Branch (Филиал)** — одна из четырёх бизнес-единиц компании, каждая с отдельным аккаунтом Kommo
- **Channel (Канал)** — рекламный источник трафика: Meta (Facebook/Instagram), Google, TikTok, Other
- **Lead (Лид)** — потенциальный клиент, зафиксированный в CRM
- **Qualified Lead (Квалифицированный лид)** — лид, прошедший первичную квалификацию менеджером
- **Deal (Сделка)** — коммерческая возможность в CRM с привязанной суммой
- **Sale (Продажа)** — закрытая сделка с подтверждённым Revenue
- **Revenue** — выручка от закрытых сделок
- **Profit** — прибыль после вычета рекламных расходов
- **Spend** — рекламные расходы за период
- **Impression** — один показ рекламного объявления
- **Click** — переход по рекламному объявлению
- **CTR (Click-Through Rate)** — отношение кликов к показам, в процентах
- **CPC (Cost Per Click)** — стоимость одного клика
- **CPM (Cost Per Mille)** — стоимость тысячи показов
- **CPL (Cost Per Lead)** — стоимость одного лида
- **CPA (Cost Per Acquisition)** — стоимость одного целевого действия
- **CAC (Customer Acquisition Cost)** — стоимость привлечения одного клиента (продажи)
- **ROAS (Return On Ad Spend)** — отношение Revenue к Spend
- **LTV (Lifetime Value)** — суммарная ценность клиента за весь период
- **Payback Period** — срок окупаемости рекламных инвестиций
- **Conversion Rate** — процент конверсии между этапами воронки
- **MarketingEvent** — унифицированная запись события: date, channel, campaign, spend, clicks, leads, qualified_leads, sales, revenue
- **Campaign** — рекламная кампания в рамках одного канала
- **Creative** — рекламный креатив (объявление) внутри кампании
- **Forecast** — прогноз результатов на основе исторических коэффициентов
- **KPI** — ключевой показатель эффективности
- **Admin** — единственная роль пользователя в системе
- **Session** — аутентифицированная пользовательская сессия
- **Railway** — облачная платформа для деплоя приложений и баз данных
- **Kommo** — CRM-система с OAuth-интеграцией, используемая четырьмя филиалами
- **Facebook Marketing API** — API Facebook для получения данных рекламных кампаний
- **Dashboard_System** — подсистема визуализации аналитики
- **Auth_System** — подсистема аутентификации и управления сессиями
- **CRM_Integration** — подсистема интеграции с Kommo CRM
- **Ads_Integration** — подсистема интеграции с рекламными платформами
- **Analytics_Engine** — подсистема расчёта аналитических метрик
- **Forecast_Engine** — подсистема прогнозирования бюджетов
- **Filter_System** — подсистема глобальных фильтров

---

## Requirements

### Requirement 1: Аутентификация и управление сессиями

**User Story:** Как Admin, я хочу безопасно входить в систему и управлять сессией, чтобы иметь защищённый доступ ко всем аналитическим данным.

#### Критерии приёмки

1. THE Auth_System SHALL предоставлять страницу входа с полями email и password
2. WHEN Admin вводит корректные credentials, THE Auth_System SHALL создать сессию и перенаправить на Dashboard Home
3. WHEN Admin вводит некорректные credentials, THE Auth_System SHALL отобразить сообщение об ошибке без раскрытия причины отказа
4. WHILE сессия активна, THE Auth_System SHALL предоставлять доступ ко всем защищённым маршрутам
5. WHEN Admin нажимает Logout, THE Auth_System SHALL завершить сессию и перенаправить на страницу входа
6. WHEN неаутентифицированный пользователь обращается к защищённому маршруту, THE Auth_System SHALL перенаправить его на страницу входа
7. WHILE сессия неактивна более 8 часов, THE Auth_System SHALL автоматически завершить сессию
8. IF токен сессии истёк или недействителен, THEN THE Auth_System SHALL вернуть HTTP 401 и очистить клиентский токен

---

### Requirement 2: Интеграция с Kommo CRM

**User Story:** Как Admin, я хочу подключить четыре аккаунта Kommo (по одному на филиал) и синхронизировать данные о лидах и сделках, чтобы видеть единую аналитику по всем филиалам.

#### Критерии приёмки

1. THE CRM_Integration SHALL поддерживать подключение до 4 аккаунтов Kommo через OAuth 2.0
2. WHEN Admin инициирует подключение аккаунта Kommo, THE CRM_Integration SHALL пройти OAuth-авторизацию и сохранить access_token и refresh_token в базе данных
3. WHEN access_token истекает, THE CRM_Integration SHALL автоматически обновить его через refresh_token без участия пользователя
4. THE CRM_Integration SHALL синхронизировать данные каждого аккаунта Kommo с интервалом не более 15 минут
5. WHEN выполняется синхронизация, THE CRM_Integration SHALL сохранить для каждого лида поля: lead_id, created_at, source, status, pipeline, responsible, amount
6. WHEN выполняется синхронизация, THE CRM_Integration SHALL сохранить для каждой сделки поля: deal value, stage, close_date, revenue
7. IF синхронизация с аккаунтом Kommo завершается ошибкой, THEN THE CRM_Integration SHALL зафиксировать ошибку в логах и продолжить синхронизацию остальных аккаунтов
8. THE CRM_Integration SHALL сопоставлять каждый аккаунт Kommo с соответствующим Branch для единой кросс-филиальной аналитики
9. WHERE аккаунт Kommo отключён, THE CRM_Integration SHALL отображать статус «отключён» в административном интерфейсе без прерывания работы других аккаунтов

---

### Requirement 3: Интеграция с Facebook Ads

**User Story:** Как Admin, я хочу получать данные рекламных кампаний из Facebook Marketing API, чтобы анализировать расходы, охват и конверсии в единой системе.

#### Критерии приёмки

1. THE Ads_Integration SHALL подключаться к Facebook Marketing API и хранить API-токены в зашифрованном виде в базе данных
2. WHEN выполняется импорт данных, THE Ads_Integration SHALL получить для каждой кампании поля: campaign_name, spend, impressions, clicks, CTR, CPC, CPM
3. WHEN выполняется импорт данных, THE Ads_Integration SHALL получить для каждого объявления поля: creative, impressions, clicks, spend
4. WHEN выполняется импорт данных, THE Ads_Integration SHALL получить данные по конверсиям: leads, purchases
5. THE Ads_Integration SHALL синхронизировать данные Facebook Ads с интервалом не более 1 часа
6. IF запрос к Facebook Marketing API возвращает ошибку, THEN THE Ads_Integration SHALL зафиксировать ошибку, выждать интервал повторной попытки и повторить запрос не более 3 раз
7. THE Ads_Integration SHALL нормализовать полученные данные в формат MarketingEvent для единого хранения и аналитики

---

### Requirement 4: Слой обработки данных

**User Story:** Как Admin, я хочу, чтобы все данные из разных источников хранились в едином формате, чтобы аналитика была консистентной независимо от источника.

#### Критерии приёмки

1. THE Analytics_Engine SHALL преобразовывать все входящие данные из CRM и рекламных платформ в формат MarketingEvent со полями: date, channel, campaign, spend, clicks, leads, qualified_leads, sales, revenue
2. THE Analytics_Engine SHALL рассчитывать производные метрики: CTR = clicks / impressions × 100, CPC = spend / clicks, CPL = spend / leads, CPA = spend / sales, ROAS = revenue / spend, CAC = spend / sales
3. IF значение знаменателя при расчёте метрики равно нулю, THEN THE Analytics_Engine SHALL вернуть null для данной метрики вместо деления на ноль
4. THE Analytics_Engine SHALL агрегировать MarketingEvent записи по измерениям: date, channel, campaign, branch для построения daily_metrics
5. THE Analytics_Engine SHALL хранить агрегированные daily_metrics в PostgreSQL-таблице для последующей аналитики

---

### Requirement 5: Глобальные фильтры

**User Story:** Как Admin, я хочу фильтровать все дашборды по дате, филиалу, каналу и кампании, чтобы видеть срез данных в нужном контексте.

#### Критерии приёмки

1. THE Filter_System SHALL предоставлять фильтр по периоду с пресетами: Today, This Week, This Month, This Quarter, и произвольным диапазоном дат
2. THE Filter_System SHALL предоставлять фильтр по филиалу с вариантами: All Branches, Branch 1, Branch 2, Branch 3, Branch 4
3. THE Filter_System SHALL предоставлять фильтр по каналу с вариантами: All Channels, Facebook, Google, TikTok, Other
4. THE Filter_System SHALL предоставлять фильтр по кампании, зависящий от выбранного канала
5. WHEN пользователь изменяет значение любого фильтра, THE Dashboard_System SHALL обновить все виджеты текущего дашборда в течение 2 секунд
6. THE Filter_System SHALL сохранять выбранные значения фильтров в рамках пользовательской сессии при переходе между дашбордами

---

### Requirement 6: Dashboard 1 — CEO Overview

**User Story:** Как Admin, я хочу видеть сводный дашборд с ключевыми KPI и трендами, чтобы быстро оценить общее состояние маркетинга.

#### Критерии приёмки

1. THE Dashboard_System SHALL отображать KPI-карточки: Spend, Revenue, Profit, ROAS, CAC, Leads, Sales за выбранный период
2. THE Dashboard_System SHALL отображать смешанный график (line + column) Revenue vs Spend в разбивке по дням/неделям выбранного периода
3. THE Dashboard_System SHALL отображать area-график Growth Trend с динамикой ключевых метрик за выбранный период
4. THE Dashboard_System SHALL отображать column-график Channel Performance с показателями Spend и Revenue по каналам
5. WHEN данных за выбранный период нет, THE Dashboard_System SHALL отображать пустые состояния с пояснительными сообщениями вместо пустых графиков
6. THE Dashboard_System SHALL реализовывать все графики с использованием библиотеки ApexCharts React

---

### Requirement 7: Dashboard 2 — Funnel Analytics

**User Story:** Как Admin, я хочу видеть воронку продаж от показов до продаж с конверсией на каждом этапе, чтобы находить узкие места.

#### Критерии приёмки

1. THE Dashboard_System SHALL отображать воронку продаж с этапами в порядке: Impressions → Clicks → Leads → Qualified Leads → Sales
2. THE Dashboard_System SHALL отображать абсолютное значение и Conversion Rate для каждого перехода между соседними этапами воронки
3. THE Dashboard_System SHALL отображать воронку в разрезе выбранных фильтров (период, филиал, канал)
4. WHEN Conversion Rate на каком-либо этапе воронки ниже среднеисторического значения более чем на 20%, THE Dashboard_System SHALL визуально выделить данный этап

---

### Requirement 8: Dashboard 3 — Channel Analytics

**User Story:** Как Admin, я хочу сравнивать эффективность рекламных каналов по ключевым метрикам, чтобы перераспределять бюджет в пользу наиболее эффективных каналов.

#### Критерии приёмки

1. THE Dashboard_System SHALL отображать для каждого канала (Meta, Google, TikTok, Other) метрики: Spend, Leads, CPA, Revenue, ROAS
2. THE Dashboard_System SHALL отображать сравнительную визуализацию каналов по выбранным метрикам в виде column-графика
3. THE Dashboard_System SHALL позволять переключаться между метриками для сравнения каналов без перезагрузки страницы
4. WHEN канал не имеет данных за выбранный период, THE Dashboard_System SHALL отображать его с нулевыми значениями и пометкой «Нет данных»

---

### Requirement 9: Dashboard 4 — Campaign Analytics

**User Story:** Как Admin, я хочу видеть детальную таблицу кампаний с фильтрацией и ключевыми метриками, чтобы управлять эффективностью каждой кампании.

#### Критерии приёмки

1. THE Dashboard_System SHALL отображать таблицу кампаний со столбцами: Campaign, Channel, Branch, Spend, CTR, CPC, Leads, CPA, Revenue, ROAS
2. THE Dashboard_System SHALL поддерживать сортировку таблицы по любому числовому столбцу
3. THE Dashboard_System SHALL поддерживать фильтрацию таблицы по дате, каналу и филиалу через глобальный Filter_System
4. THE Dashboard_System SHALL поддерживать поиск по названию кампании в таблице
5. WHEN таблица содержит более 50 записей, THE Dashboard_System SHALL применить пагинацию с размером страницы 25 записей

---

### Requirement 10: Dashboard 5 — Creative Analytics

**User Story:** Как Admin, я хочу анализировать эффективность рекламных креативов, чтобы определять лучшие объявления и масштабировать их.

#### Критерии приёмки

1. THE Dashboard_System SHALL отображать таблицу креативов со столбцами: Creative, Channel, Campaign, CTR, Engagement, CPA, Conversions
2. THE Dashboard_System SHALL поддерживать сортировку таблицы креативов по CTR, CPA и Conversions
3. THE Dashboard_System SHALL поддерживать фильтрацию таблицы по каналу и кампании через глобальный Filter_System
4. WHEN CTR креатива превышает среднее значение по каналу, THE Dashboard_System SHALL визуально отмечать данный креатив как высокоэффективный

---

### Requirement 11: Модуль прогнозирования

**User Story:** Как Admin, я хочу вводить плановый бюджет и получать прогноз ключевых результатов, чтобы обосновывать маркетинговые инвестиции и планировать рост.

#### Критерии приёмки

1. THE Forecast_Engine SHALL предоставлять интерфейс ввода планового бюджета в числовом поле с указанием валюты
2. WHEN Admin вводит бюджет, THE Forecast_Engine SHALL рассчитать прогноз по формуле:
   - Expected Leads = Budget / Avg CPL
   - Expected Qualified Leads = Expected Leads × Lead Qualification Rate
   - Expected Sales = Expected Qualified Leads × Qualified Lead Conversion Rate
   - Expected Revenue = Expected Sales × Avg Ticket
   - Expected Profit = Expected Revenue − Budget
3. THE Forecast_Engine SHALL рассчитывать исторические коэффициенты (Avg CPL, Lead Qualification Rate, Qualified Lead Conversion Rate, Avg Ticket) на основе данных за последние 90 дней
4. THE Forecast_Engine SHALL отображать прогнозные значения: Expected Leads, Qualified Leads, Sales, Revenue, Profit одновременно с обновлением ввода бюджета
5. THE Forecast_Engine SHALL отображать значения исторических коэффициентов, использованных для расчёта, с возможностью их ручной корректировки
6. WHEN исторических данных недостаточно (менее 30 дней), THE Forecast_Engine SHALL отобразить предупреждение о низкой точности прогноза
7. IF введённое значение бюджета не является положительным числом, THEN THE Forecast_Engine SHALL отобразить сообщение об ошибке валидации

---

### Requirement 12: KPI-система

**User Story:** Как Admin, я хочу видеть стандартизированные KPI по всей системе, чтобы оценивать эффективность маркетинга по единым метрикам.

#### Критерии приёмки

1. THE Analytics_Engine SHALL рассчитывать и предоставлять следующие KPI: CAC, CPL, CPA, ROAS, Conversion Rate, LTV, Payback Period
2. THE Analytics_Engine SHALL рассчитывать LTV по формуле: Avg Revenue per Sale × Avg Purchases per Customer
3. THE Analytics_Engine SHALL рассчитывать Payback Period по формуле: CAC / (Avg Revenue per Sale × Gross Margin)
4. WHEN значения для расчёта KPI отсутствуют, THE Analytics_Engine SHALL возвращать null для данного KPI с пометкой «Недостаточно данных»
5. THE Dashboard_System SHALL отображать KPI с единицами измерения и направлением тренда (рост/снижение) относительно предыдущего аналогичного периода

---

### Requirement 13: Инфраструктура и деплой

**User Story:** Как Admin, я хочу работать с системой, развёрнутой на Railway.app, чтобы иметь надёжный доступ без локальной среды разработки.

#### Критерии приёмки

1. THE Dashboard_System SHALL быть развёрнут как React-приложение на Railway.app и доступен через HTTPS
2. THE Dashboard_System SHALL использовать REST API backend на Node.js, развёрнутый на Railway.app
3. THE Dashboard_System SHALL использовать PostgreSQL-базу данных на Railway.app для хранения всех данных
4. THE Dashboard_System SHALL использовать архитектуру backend: controllers / services / integrations / database layers
5. WHEN backend-сервис недоступен, THE Dashboard_System SHALL отображать пользователю информативное сообщение об ошибке соединения
6. THE Dashboard_System SHALL поддерживать расширение для подключения дополнительных рекламных каналов (Google Ads, TikTok Ads) без изменения базовой архитектуры

---

### Requirement 14: UI/UX и визуальный стиль

**User Story:** Как Admin, я хочу работать с чистым, корпоративным интерфейсом, чтобы эффективно анализировать данные без визуального шума.

#### Критерии приёмки

1. THE Dashboard_System SHALL использовать белый фон и минималистичный корпоративный стиль, соответствующий стилистике Kommo CRM
2. THE Dashboard_System SHALL обеспечивать навигацию между пятью дашбордами через боковое меню
3. THE Dashboard_System SHALL быть адаптирован для отображения на экранах с разрешением не менее 1280×800 пикселей
4. THE Dashboard_System SHALL отображать состояние загрузки (skeleton/spinner) при получении данных от API
5. WHEN операция занимает более 3 секунд, THE Dashboard_System SHALL отображать индикатор прогресса

---

### Requirement 15: База данных

**User Story:** Как Admin, я хочу, чтобы все данные надёжно хранились в структурированной базе данных, чтобы аналитика была точной и воспроизводимой.

#### Критерии приёмки

1. THE Dashboard_System SHALL использовать PostgreSQL со следующими таблицами: users, branches, kommo_accounts, facebook_accounts, campaigns, ad_spend, leads, deals, sales, daily_metrics, forecasts
2. THE Analytics_Engine SHALL обеспечивать уникальность записей при повторной синхронизации через механизм upsert (ON CONFLICT DO UPDATE)
3. THE Analytics_Engine SHALL хранить все временны́е метки в UTC
4. IF операция записи в базу данных завершается ошибкой, THEN THE Analytics_Engine SHALL откатить транзакцию и зафиксировать ошибку в логах
5. THE Dashboard_System SHALL использовать индексы на полях date, channel, branch, campaign_id для обеспечения производительности запросов

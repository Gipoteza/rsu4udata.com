# Requirements Document

## Introduction

RSU4U Marketing Analytics Dashboard — это веб-админка для Digital Director / Head of Marketing, которая объединяет данные из CRM Kommo (4 филиала) и рекламных систем (Facebook Ads), приводит их к единому формату MarketingEvent, рассчитывает KPI воронки (Клик → Лид → Квалифицированный лид → Продажа → Revenue → Profit), визуализирует эффективность каналов и кампаний и позволяет прогнозировать результат при изменении рекламного бюджета.

Система состоит из шести функциональных модулей: аутентификация администратора, интеграция с Kommo, интеграция с Facebook Ads, слой обработки данных, дашборды (5 страниц) и прогнозирование. Архитектура спроектирована с расчётом на последующее расширение каналов (Google Ads, TikTok Ads, Email, SEO) и добавление AI-рекомендаций.

Технологический стек: React + ApexCharts на фронтенде, Node.js + REST API на бэкенде, PostgreSQL и хостинг на Railway.

## Glossary

- **System**: программный комплекс RSU4U Marketing Analytics Dashboard в целом (frontend, backend, database).
- **Frontend**: React-приложение, отображающее интерфейс администратора.
- **Backend**: Node.js REST API, выполняющий бизнес-логику и интеграции.
- **Database**: PostgreSQL, хранилище данных платформы (Railway).
- **Auth_Service**: подсистема Backend, отвечающая за аутентификацию, сессии и защиту маршрутов.
- **Admin**: единственная роль пользователя System, имеющая полный доступ ко всем функциям.
- **Kommo_Integration**: подсистема Backend, реализующая подключение, авторизацию и синхронизацию данных с CRM Kommo.
- **Facebook_Integration**: подсистема Backend, реализующая работу с Facebook Marketing API.
- **Data_Processing_Layer**: подсистема Backend, преобразующая входные данные интеграций в единый формат MarketingEvent.
- **MarketingEvent**: унифицированная запись с полями date, channel, campaign, spend, clicks, leads, qualified_leads, sales, revenue.
- **Dashboard_System**: подсистема Frontend из пяти страниц (CEO Overview, Funnel Analytics, Channel Analytics, Campaign Analytics, Creative Analytics).
- **Forecasting_Service**: подсистема Backend, рассчитывающая прогноз результатов по введённому бюджету.
- **Branch**: филиал бизнеса; в System поддерживается ровно четыре филиала (Branch 1..Branch 4), каждый связан с отдельным аккаунтом Kommo.
- **Kommo_Account**: аккаунт CRM Kommo, привязанный ровно к одному Branch.
- **Facebook_Account**: рекламный аккаунт Facebook Ads, подключённый к System.
- **Lead**: запись о потенциальном клиенте, импортированная из Kommo (поля: lead_id, created_at, source, status, pipeline, responsible, amount).
- **Qualified_Lead**: Lead, перешедший в стадию воронки Kommo, помеченную как «квалифицированный» в настройках System.
- **Deal**: сделка из Kommo (value, stage, close_date, revenue).
- **Sale**: Deal со статусом «закрыта успешно», формирующий Revenue.
- **Revenue**: суммарная выручка по Sale за период.
- **Profit**: Revenue минус суммарный Spend за тот же период и срез.
- **Spend**: рекламные затраты, импортированные из Facebook_Integration.
- **Campaign**: рекламная кампания Facebook Ads (campaign name, spend, impressions, clicks, CTR, CPC, CPM).
- **Ad**: рекламное объявление внутри Campaign (creative, impressions, clicks, spend).
- **Creative**: креатив (изображение/видео/текст), привязанный к Ad.
- **Channel**: рекламный канал; в первой версии System поддерживает значения Facebook, Google, TikTok и Other.
- **CAC**: Customer Acquisition Cost = Spend / Sales за период и срез.
- **CPL**: Cost Per Lead = Spend / Leads за период и срез.
- **CPA**: Cost Per Acquisition = Spend / Qualified_Leads за период и срез.
- **ROAS**: Return On Ad Spend = Revenue / Spend за период и срез.
- **Conversion_Rate**: отношение количества элементов следующего шага воронки к количеству элементов предыдущего шага, выраженное в процентах.
- **LTV**: Lifetime Value клиента, рассчитанная как средняя сумма Revenue на одного клиента за всё время.
- **Payback_Period**: количество дней, за которое CAC окупается средним месячным Revenue на клиента.
- **Average_Ticket**: средняя сумма одной Sale за выбранный исторический период.
- **Global_Filters**: набор фильтров, доступных на всех страницах Dashboard_System: дата (today/week/month/quarter), Branch, Channel, Campaign.
- **Forecast**: результат расчёта Forecasting_Service по введённому бюджету (Expected Leads, Qualified Leads, Sales, Revenue, Profit).

## Requirements

### Requirement 1: Аутентификация и сессии администратора

**User Story:** Как Admin, я хочу безопасно входить в System и выходить из неё, чтобы только авторизованный пользователь имел доступ к маркетинговым данным.

#### Acceptance Criteria

1. THE Auth_Service SHALL поддерживать ровно одну учётную запись с ролью Admin.
2. WHEN Admin отправляет корректную пару логин/пароль на маршрут входа, THE Auth_Service SHALL создать сессию и вернуть Frontend токен сессии.
3. IF логин или пароль не совпадают с сохранёнными в Database, THEN THE Auth_Service SHALL отклонить запрос с HTTP-кодом 401 и сообщением об ошибке без раскрытия, какое именно поле неверно.
4. WHEN Admin открывает любой маршрут Dashboard_System без действительной сессии, THE Frontend SHALL перенаправить пользователя на страницу входа.
5. WHEN Admin отправляет запрос на выход, THE Auth_Service SHALL завершить сессию и сделать выданный токен недействительным для последующих запросов.
6. IF с момента последней активности сессии прошло более 24 часов, THEN THE Auth_Service SHALL считать сессию истёкшей и требовать повторного входа.
7. THE Auth_Service SHALL хранить пароль Admin в Database в виде хеша, рассчитанного алгоритмом bcrypt с фактором стоимости не ниже 10.
8. WHEN Admin успешно вошёл в System, THE Frontend SHALL отобразить страницу CEO Overview.

### Requirement 2: Управление филиалами и подключение аккаунтов Kommo

**User Story:** Как Admin, я хочу подключать четыре аккаунта Kommo к четырём филиалам, чтобы данные каждого филиала собирались в единую аналитику.

#### Acceptance Criteria

1. THE System SHALL поддерживать ровно четыре сущности Branch с идентификаторами Branch 1, Branch 2, Branch 3, Branch 4.
2. THE System SHALL связывать каждый Branch ровно с одним Kommo_Account.
3. WHEN Admin запускает процесс подключения Kommo_Account для выбранного Branch, THE Kommo_Integration SHALL инициировать OAuth-авторизацию через Kommo API.
4. WHEN Kommo возвращает access token и refresh token после OAuth, THE Kommo_Integration SHALL сохранить токены в Database в зашифрованном виде с привязкой к Branch.
5. IF срок действия access token истёк, THEN THE Kommo_Integration SHALL обновить токен по refresh token до выполнения следующего запроса к Kommo API.
6. IF refresh token недействителен или отозван, THEN THE Kommo_Integration SHALL пометить Kommo_Account как «требует повторного подключения» и отобразить статус Admin на странице интеграций.
7. THE Frontend SHALL отображать для каждого Branch статус подключения Kommo_Account со значениями «подключён», «требует повторного подключения» или «не подключён».

### Requirement 3: Синхронизация данных Kommo

**User Story:** Как Admin, я хочу, чтобы Leads, Deals и Users из всех четырёх Kommo_Account регулярно загружались в Database, чтобы аналитика отражала актуальное состояние воронки продаж.

#### Acceptance Criteria

1. THE Kommo_Integration SHALL импортировать из каждого подключённого Kommo_Account сущности Lead с полями lead_id, created_at, source, status, pipeline, responsible, amount.
2. THE Kommo_Integration SHALL импортировать из каждого подключённого Kommo_Account сущности Deal с полями value, stage, close_date, revenue.
3. THE Kommo_Integration SHALL импортировать из каждого подключённого Kommo_Account сущности User с полями manager и team.
4. WHEN запускается плановая синхронизация Kommo_Account, THE Kommo_Integration SHALL загружать только записи, изменённые после момента предыдущей успешной синхронизации этого Kommo_Account.
5. THE Kommo_Integration SHALL запускать плановую синхронизацию каждого подключённого Kommo_Account не реже одного раза в час.
6. WHEN Admin нажимает кнопку ручной синхронизации для Branch, THE Kommo_Integration SHALL запустить внеплановую полную синхронизацию данных этого Branch.
7. IF запрос к Kommo API возвращает ошибку 429 (rate limit), THEN THE Kommo_Integration SHALL повторить запрос с экспоненциальной задержкой не более пяти раз.
8. IF синхронизация Kommo_Account завершилась с ошибкой, THEN THE Kommo_Integration SHALL сохранить запись об ошибке в журнал интеграций и отобразить статус ошибки Admin для соответствующего Branch.
9. THE Database SHALL хранить связь каждой записи Lead, Deal и User с конкретным Branch.

### Requirement 4: Подключение и синхронизация Facebook Ads

**User Story:** Как Admin, я хочу подключить рекламные аккаунты Facebook Ads и регулярно загружать метрики кампаний и креативов, чтобы видеть рекламные затраты и эффективность.

#### Acceptance Criteria

1. WHEN Admin запускает процесс подключения Facebook_Account, THE Facebook_Integration SHALL инициировать OAuth-авторизацию через Facebook Marketing API.
2. WHEN Facebook возвращает long-lived access token, THE Facebook_Integration SHALL сохранить токен в Database в зашифрованном виде с привязкой к Facebook_Account.
3. THE Facebook_Integration SHALL импортировать на уровне Campaign поля campaign name, spend, impressions, clicks, CTR, CPC, CPM.
4. THE Facebook_Integration SHALL импортировать на уровне Ad поля creative, impressions, clicks, spend.
5. THE Facebook_Integration SHALL импортировать конверсии типа leads и purchases для каждой Campaign.
6. THE Facebook_Integration SHALL запускать плановую синхронизацию каждого подключённого Facebook_Account не реже одного раза в час.
7. WHEN Admin нажимает кнопку ручной синхронизации Facebook_Account, THE Facebook_Integration SHALL запустить внеплановую полную синхронизацию данных за выбранный период.
8. IF запрос к Facebook Marketing API возвращает ошибку rate limit, THEN THE Facebook_Integration SHALL повторить запрос с экспоненциальной задержкой не более пяти раз.
9. IF access token Facebook_Account недействителен или истёк, THEN THE Facebook_Integration SHALL пометить Facebook_Account как «требует повторного подключения» и отобразить статус Admin на странице интеграций.
10. THE Database SHALL хранить таблицы campaigns и ad_spend с гранулярностью «одна строка на Campaign на день» для дальнейшей агрегации.

### Requirement 5: Унифицированный слой обработки данных (MarketingEvent)

**User Story:** Как Admin, я хочу, чтобы данные из всех источников приводились к единому формату MarketingEvent, чтобы аналитика и прогнозирование работали независимо от количества интеграций.

#### Acceptance Criteria

1. THE Data_Processing_Layer SHALL формировать записи MarketingEvent с полями date, channel, campaign, spend, clicks, leads, qualified_leads, sales, revenue.
2. WHEN в Database появляются новые данные Facebook_Integration, THE Data_Processing_Layer SHALL агрегировать их в MarketingEvent с гранулярностью «один день × один Channel × одна Campaign».
3. WHEN в Database появляются новые данные Kommo_Integration, THE Data_Processing_Layer SHALL сопоставлять Lead, Qualified_Lead и Sale с MarketingEvent по полю date и значению source/utm Lead, приведённому к Channel и Campaign.
4. IF Lead из Kommo не содержит данных, позволяющих определить Channel, THEN THE Data_Processing_Layer SHALL отнести этот Lead к Channel со значением Other.
5. THE Data_Processing_Layer SHALL пересчитывать таблицу daily_metrics после каждой успешной синхронизации Kommo_Integration или Facebook_Integration.
6. THE Data_Processing_Layer SHALL поддерживать одновременное хранение MarketingEvent по всем четырём Branch с возможностью фильтрации и агрегации по Branch.
7. THE Data_Processing_Layer SHALL обеспечивать архитектурную возможность добавления новых Channel (Google Ads, TikTok Ads, Email, SEO) без изменения схемы MarketingEvent.

### Requirement 6: Расчёт KPI

**User Story:** Как Admin, я хочу видеть согласованные значения CAC, CPL, CPA, ROAS, Conversion Rate, LTV и Payback Period на всех страницах, чтобы принимать решения на основе единых метрик.

#### Acceptance Criteria

1. THE Backend SHALL рассчитывать CPL по формуле Spend / Leads за выбранный период и срез Global_Filters.
2. THE Backend SHALL рассчитывать CPA по формуле Spend / Qualified_Leads за выбранный период и срез Global_Filters.
3. THE Backend SHALL рассчитывать CAC по формуле Spend / Sales за выбранный период и срез Global_Filters.
4. THE Backend SHALL рассчитывать ROAS по формуле Revenue / Spend за выбранный период и срез Global_Filters.
5. THE Backend SHALL рассчитывать Profit по формуле Revenue минус Spend за выбранный период и срез Global_Filters.
6. THE Backend SHALL рассчитывать Conversion_Rate между двумя соседними этапами воронки как отношение количества элементов следующего этапа к количеству элементов предыдущего этапа, умноженное на 100.
7. THE Backend SHALL рассчитывать LTV как сумму Revenue, делённую на количество уникальных клиентов с Sale, за период не менее 12 месяцев.
8. THE Backend SHALL рассчитывать Payback_Period как CAC, делённый на средний месячный Revenue на одного клиента, и выражать результат в днях.
9. IF знаменатель в любой формуле KPI равен нулю, THEN THE Backend SHALL вернуть значение KPI как null и отметить отсутствие данных в ответе API.
10. THE Backend SHALL возвращать одинаковые значения KPI для одного и того же среза Global_Filters независимо от того, с какой страницы Dashboard_System поступил запрос.

### Requirement 7: Глобальные фильтры

**User Story:** Как Admin, я хочу одним набором фильтров управлять данными на всех страницах дашборда, чтобы быстро переключать срезы аналитики.

#### Acceptance Criteria

1. THE Frontend SHALL отображать панель Global_Filters на каждой странице Dashboard_System.
2. THE Frontend SHALL предоставлять фильтр даты со значениями today, week, month и quarter.
3. THE Frontend SHALL предоставлять фильтр Branch с возможностью выбора одного, нескольких или всех значений Branch 1..Branch 4.
4. THE Frontend SHALL предоставлять фильтр Channel со значениями Facebook, Google, TikTok и Other и возможностью выбора одного, нескольких или всех значений.
5. THE Frontend SHALL предоставлять фильтр Campaign, отображающий список Campaign, относящихся к текущему выбору Branch и Channel.
6. WHEN Admin изменяет любое значение в панели Global_Filters, THE Frontend SHALL отправить обновлённый запрос данных и перерисовать все KPI и графики текущей страницы в течение трёх секунд при объёме данных до 1 миллиона записей MarketingEvent.
7. WHEN Admin переходит между страницами Dashboard_System в течение одной сессии, THE Frontend SHALL сохранять текущие значения Global_Filters.

### Requirement 8: Страница CEO Overview

**User Story:** Как Admin, я хочу на одной странице видеть ключевые KPI и сводные графики, чтобы за минуту оценить состояние маркетинга.

#### Acceptance Criteria

1. THE Frontend SHALL отображать на странице CEO Overview KPI-карточки Spend, Revenue, Profit, ROAS, CAC, Leads и Sales, рассчитанные по текущему срезу Global_Filters.
2. THE Frontend SHALL отображать на странице CEO Overview график Revenue vs Spend в виде Mixed-чарта (столбцы и линия) ApexCharts с осью X по дням выбранного периода.
3. THE Frontend SHALL отображать на странице CEO Overview график Growth Trend в виде Area-чарта ApexCharts по метрике Revenue для выбранного периода.
4. THE Frontend SHALL отображать на странице CEO Overview график Channel Performance в виде Column-чарта ApexCharts с разбивкой Spend, Revenue и ROAS по Channel.
5. WHEN данные для KPI или графика отсутствуют для текущего среза Global_Filters, THE Frontend SHALL отобразить плейсхолдер «нет данных» вместо пустого графика или нулевого значения без контекста.

### Requirement 9: Страница Funnel Analytics

**User Story:** Как Admin, я хочу видеть воронку Impressions → Clicks → Leads → Qualified Leads → Sales и проценты конверсии между этапами, чтобы понимать, где теряются клиенты.

#### Acceptance Criteria

1. THE Frontend SHALL отображать на странице Funnel Analytics пять этапов воронки в порядке Impressions, Clicks, Leads, Qualified Leads, Sales.
2. THE Frontend SHALL отображать абсолютное значение количества элементов для каждого этапа за текущий срез Global_Filters.
3. THE Frontend SHALL отображать значение Conversion_Rate между каждой парой соседних этапов воронки.
4. WHEN Admin наводит курсор на этап воронки, THE Frontend SHALL отобразить подсказку с разбивкой по Channel.
5. IF на одном из этапов воронки за выбранный срез нет данных, THEN THE Frontend SHALL отобразить значение этапа как 0 и соответствующий Conversion_Rate как null.

### Requirement 10: Страница Channel Analytics

**User Story:** Как Admin, я хочу сравнивать каналы Meta, Google, TikTok и Other по Spend, Leads, CPA, Revenue и ROAS, чтобы понимать, какие каналы приносят прибыль.

#### Acceptance Criteria

1. THE Frontend SHALL отображать на странице Channel Analytics строку метрик для каждого Channel из списка Facebook, Google, TikTok и Other.
2. THE Frontend SHALL отображать для каждого Channel значения Spend, Leads, CPA, Revenue и ROAS за текущий срез Global_Filters.
3. THE Frontend SHALL отображать на странице Channel Analytics график сравнения Channel по выбранной метрике с переключателем между Spend, Revenue, ROAS и CPA.
4. WHEN Admin выбирает в Global_Filters только один Channel, THE Frontend SHALL отображать на странице Channel Analytics детализацию выбранного Channel по Campaign.

### Requirement 11: Страница Campaign Analytics

**User Story:** Как Admin, я хочу таблицу со всеми Campaign и их метриками с возможностью фильтрации, чтобы оценивать эффективность каждой кампании.

#### Acceptance Criteria

1. THE Frontend SHALL отображать на странице Campaign Analytics таблицу со столбцами Campaign, Spend, CTR, CPC, Leads, CPA, Revenue и ROAS.
2. THE Frontend SHALL ограничивать содержимое таблицы записями, соответствующими текущему срезу Global_Filters по дате, Channel, Branch и Campaign.
3. WHEN Admin кликает заголовок столбца таблицы, THE Frontend SHALL сортировать строки таблицы по этому столбцу по возрастанию или убыванию.
4. WHEN количество строк таблицы превышает 50, THE Frontend SHALL отобразить пагинацию с настраиваемым размером страницы.
5. WHEN Admin нажимает кнопку экспорта на странице Campaign Analytics, THE Frontend SHALL предоставить файл CSV с текущим содержимым таблицы.

### Requirement 12: Страница Creative Analytics

**User Story:** Как Admin, я хочу видеть метрики креативов, чтобы понимать, какие материалы лучше работают.

#### Acceptance Criteria

1. THE Frontend SHALL отображать на странице Creative Analytics список Creative с превью, названием Campaign и значениями CTR, Engagement, CPA и Conversions.
2. THE Frontend SHALL ограничивать содержимое страницы Creative Analytics креативами, относящимися к Campaign, попадающим под текущий срез Global_Filters.
3. WHEN Admin кликает по Creative, THE Frontend SHALL отобразить детальную карточку с историей метрик Creative по дням за выбранный период.
4. WHEN превью Creative недоступно из Facebook Marketing API, THE Frontend SHALL отобразить плейсхолдер изображения и продолжить отображать текстовые метрики Creative.

### Requirement 13: Прогнозирование результатов по бюджету

**User Story:** Как Admin, я хочу вводить плановый бюджет и получать прогноз Leads, Sales, Revenue и Profit, чтобы планировать маркетинговые инвестиции.

#### Acceptance Criteria

1. THE Frontend SHALL предоставлять Admin поле ввода планового бюджета в евро на странице Forecasting.
2. WHEN Admin отправляет значение планового бюджета, THE Forecasting_Service SHALL рассчитать Expected Leads по формуле «бюджет, делённый на Average CPL».
3. WHEN рассчитан Expected Leads, THE Forecasting_Service SHALL рассчитать Expected Qualified Leads по формуле «Expected Leads, умноженный на исторический Conversion_Rate из Lead в Qualified_Lead».
4. WHEN рассчитан Expected Qualified Leads, THE Forecasting_Service SHALL рассчитать Expected Sales по формуле «Expected Qualified Leads, умноженный на исторический Conversion_Rate из Qualified_Lead в Sale».
5. WHEN рассчитан Expected Sales, THE Forecasting_Service SHALL рассчитать Expected Revenue по формуле «Expected Sales, умноженный на Average_Ticket».
6. THE Forecasting_Service SHALL рассчитывать Expected Profit как Expected Revenue, уменьшенный на введённый плановый бюджет.
7. THE Forecasting_Service SHALL использовать в качестве исторических коэффициентов Average CPL, Average Conversion_Rate из Lead в Qualified_Lead, Average Conversion_Rate из Qualified_Lead в Sale, Average CAC, Average ROAS и Average_Ticket, рассчитанные по данным MarketingEvent за последние 90 дней.
8. THE Forecasting_Service SHALL поддерживать срез прогноза по Global_Filters (Branch и Channel), используя исторические коэффициенты, рассчитанные для соответствующего среза.
9. IF исторические данные за последние 90 дней содержат менее 30 Lead для выбранного среза, THEN THE Forecasting_Service SHALL вернуть прогноз вместе с предупреждением «низкая надёжность прогноза из-за недостатка исторических данных».
10. THE Forecasting_Service SHALL сохранять каждый запрошенный Forecast в таблицу forecasts с полями timestamp, входной бюджет, использованный срез Global_Filters и рассчитанные значения Expected Leads, Qualified Leads, Sales, Revenue, Profit.

### Requirement 14: Схема базы данных

**User Story:** Как Admin, я хочу, чтобы все данные хранились в согласованной схеме PostgreSQL, чтобы аналитика и интеграции работали стабильно.

#### Acceptance Criteria

1. THE Database SHALL содержать таблицу users для хранения учётной записи Admin.
2. THE Database SHALL содержать таблицу branches с записями для Branch 1..Branch 4.
3. THE Database SHALL содержать таблицу kommo_accounts со ссылкой на branches и зашифрованными OAuth-токенами.
4. THE Database SHALL содержать таблицу facebook_accounts с зашифрованными токенами доступа.
5. THE Database SHALL содержать таблицу campaigns с связями на facebook_accounts и Branch.
6. THE Database SHALL содержать таблицу ad_spend с гранулярностью «одна строка на Campaign на день».
7. THE Database SHALL содержать таблицу leads с привязкой к Branch и Campaign и полями lead_id, created_at, source, status, pipeline, responsible, amount.
8. THE Database SHALL содержать таблицу deals с привязкой к leads и полями value, stage, close_date, revenue.
9. THE Database SHALL содержать таблицу sales, выделяющую Deal со статусом «закрыта успешно», с полем revenue.
10. THE Database SHALL содержать таблицу daily_metrics, агрегирующую MarketingEvent с гранулярностью «день × Channel × Campaign × Branch».
11. THE Database SHALL содержать таблицу forecasts для сохранения запросов и результатов Forecasting_Service.
12. THE Database SHALL обеспечивать ссылочную целостность между таблицами через внешние ключи.

### Requirement 15: Развёртывание на Railway

**User Story:** Как Admin, я хочу, чтобы платформа работала на Railway без локальной инфраструктуры, чтобы доступ к ней был стабильным из любого места.

#### Acceptance Criteria

1. THE System SHALL развертываться на Railway в виде трёх связанных сервисов: Frontend, Backend и Database PostgreSQL.
2. THE Backend SHALL получать параметры подключения к Database из переменных окружения Railway.
3. THE Backend SHALL получать секреты OAuth Kommo и Facebook из переменных окружения Railway без хранения их в исходном коде.
4. WHEN происходит push в основную ветку репозитория, THE Railway SHALL автоматически собирать и публиковать новую версию Frontend и Backend.
5. THE Frontend SHALL обращаться к Backend по HTTPS через публичный URL Railway.

### Requirement 16: Архитектурная расширяемость каналов и интеграций

**User Story:** Как Admin, я хочу, чтобы добавление новых каналов (Google Ads, TikTok Ads, Email, SEO, AI-рекомендации) не требовало переписывания ядра, чтобы платформа развивалась без регрессий.

#### Acceptance Criteria

1. THE Backend SHALL разделять код на слои controllers, services, integrations и database layer.
2. THE Backend SHALL изолировать каждую внешнюю интеграцию в отдельном модуле слоя integrations с единым внутренним интерфейсом для Data_Processing_Layer.
3. WHERE добавляется новый Channel, THE Data_Processing_Layer SHALL принимать его данные без изменения схемы MarketingEvent.
4. WHERE добавляется новый Channel, THE Frontend SHALL отображать его на странице Channel Analytics на основе данных MarketingEvent без изменения логики страницы.

### Requirement 17: Визуальный стиль и навигация

**User Story:** Как Admin, я хочу единый минималистичный интерфейс в стиле Kommo CRM, чтобы быстро ориентироваться между страницами.

#### Acceptance Criteria

1. THE Frontend SHALL использовать белый фон в качестве основного цвета поверхности на всех страницах Dashboard_System.
2. THE Frontend SHALL отображать левое или верхнее навигационное меню со ссылками на пять страниц Dashboard_System и страницу Forecasting.
3. THE Frontend SHALL отрисовывать все графики через библиотеку ApexCharts React, используя типы Line, Column, Area и Mixed согласно требованиям соответствующих страниц.
4. THE Frontend SHALL отображать текущий выбранный пункт навигации визуально отличимым от остальных.

### Requirement 18: Журналирование и наблюдаемость

**User Story:** Как Admin, я хочу видеть журнал интеграций и ошибок, чтобы быстро понимать причины проблем с данными.

#### Acceptance Criteria

1. THE Backend SHALL записывать в журнал интеграций результат каждой синхронизации Kommo_Integration и Facebook_Integration с полями timestamp, тип интеграции, идентификатор Branch или Facebook_Account, статус и сообщение об ошибке при наличии.
2. THE Frontend SHALL предоставлять Admin страницу просмотра журнала интеграций за последние 30 дней.
3. WHEN происходит ошибка обращения к внешнему API, THE Backend SHALL фиксировать в журнале код ошибки и тело ответа, скрывая значения токенов доступа.

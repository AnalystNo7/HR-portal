# Карта проекта: HR-портал «Газпром ЦПС»

## Что это
Корпоративный HR-портал для сотрудников: личный кабинет, справочник сотрудников с импортом из Excel, обращения к HR и полный цикл оценки 360 (версионируемые наборы компетенций + шкалы → циклы → опрос респондентов → результаты с radar-дашбордом → **AI-отчёт**: генерация интерпретации через LLM по методике, поблочная правка HR, удаление/восстановление блоков, публикация сотруднику, постраничная выгрузка в **PDF и DOCX**). Роли: employee / manager / hr / admin через Keycloak SSO. Прод: https://sitehrportal.ru (деплой через Dokploy, ветка **`mvp2`**).

## Стек
**Frontend:** Next.js 14.2.35 (App Router), React ^18, TypeScript ^5, keycloak-js ^26.2.3, **docx ^9.7.1** (генерация DOCX в браузере). Без UI-библиотек — свой CSS (токены + утилиты), графики — свой SVG (`RadarChart`).
**Backend:** NestJS ^10, Prisma ^6.19.3, passport-jwt + jwks-rsa (валидация JWT Keycloak), exceljs (импорт), jszip (парсинг .docx базы знаний), **@nestjs/throttler ^6.5 (rate limit по IP), helmet ^8 (security-заголовки), class-validator/class-transformer (валидация DTO)**.
**LLM:** любой OpenAI-совместимый API (`/chat/completions`), клиент на нативном fetch; конфиг в БД (`/admin/llm`, пресеты) с fallback на env `LLM_*`. Пилотный провайдер — Gonka/OpenGNK (reasoning-модели). Генерация может идти **по частям** (1/2/3 запроса, последовательно), лимит токенов и таймауты — настраиваемые в пресете.
**Инфраструктура:** PostgreSQL 16-alpine, Keycloak 24.0 (realm `hr-portal`, клиент `hr-portal-app`, **боевой режим `start`**), Docker Compose. Прод — Dokploy + **Traefik** (наружу только он, по HTTPS; порты сервисов на хост **не публикуются**). Роутинг по путям `/` → frontend :3001, `/api` → backend :4000, `/auth` → keycloak :8080. Таймаут долгих запросов (LLM-генерация) — **≥1300с** (nginx-локалка задан; Traefik на проде — вручную, см. Known issues).
**Node engines:** не зафиксированы в package.json (в Docker — node:22-alpine).

## Структура
```
HR-portal/
├── docker-compose.yml        # прод: домен в build args, FRONTEND_ORIGIN, порты НЕ публикуются,
│                             # keycloak start + realm-export.prod.json
├── docker-compose.local.yml, docker-compose.db.yml   # локалка (порты, демо-realm)
├── DEPLOY.md                 # деплой + чек-лист безопасности прод
├── CLAUDE.md                 # правила работы (цикл задачи, журналы)
├── harness/                  # PROJECT.md (карта), DECISIONS.md, LESSONS.md, templates/
├── tasks/                    # рабочие файлы задач (BRIEF/PLAN по шаблонам)
├── keycloak/
│   ├── realm-export.json     # DEV realm: роли, клиент, маппер + демо-юзеры (employee1/hr1/admin1…)
│   └── realm-export.prod.json# PROD realm: БЕЗ демо-юзеров, bruteForceProtected, sslRequired external
├── nginx/nginx.conf          # роутинг (локалка); /api таймаут 1300с
├── backend/
│   ├── prisma/               # schema.prisma, миграции, seed.ts, seed-oc360.ts, скрипты
│   └── src/                  # NestJS-модули (см. таблицу); main.ts: throttler+helmet+CORS+ValidationPipe
│       └── oc360/            # cycle/, respondent/, results/ (+analytics.ts),
│                             # template/, report/ (LLM-отчёт), knowledge/ (база знаний)
└── frontend/
    ├── app/
    │   ├── hr-eval360/       # админ 360: page.tsx (вкладки), KnowledgeTab.tsx,
    │   │                     # [cycleId]/ (SubjectPanel, ReportView)
    │   ├── eval360/          # сотрудник: опросы + мои результаты (отчёт read-only, PDF)
    │   └── admin/            # employees, departments, positions, import, llm
    ├── components/           # primitives/, layout/,
    │   └── eval360/          # Report360View, RadarChart, CategoryRadarCard, reportDocx.ts, helpers
    ├── contexts/AuthContext.tsx
    └── lib/                  # api.ts (fetch+bearer, все типы), keycloak.ts
```

## Ключевые модули и точки входа
| Модуль | Где | За что отвечает |
|--------|-----|-----------------|
| oc360 | `backend/src/oc360/` | Весь цикл оценки 360: версии наборов компетенций, шаблоны, шкалы, циклы, респонденты, результаты, AI-отчёт, база знаний |
| oc360/report | `backend/src/oc360/report/` | AI-отчёт: `llm.client.ts` (OpenAI-совм. клиент, срез `<think>`, авто-повтор при таймауте, повтор при 429, max_tokens по галочке, таймаут по частям); `report.prompt.ts` (методика v1.2 + документы + защищённая JSON-схема, `partsForCount` — генерация по частям); `report.types.ts` (`normalizeSections`, `hiddenBlocks`, externalComparison); `report.service.ts` (generate/update/reset; **замок от двойной генерации** — `Set` по subjectId → 409; снимки `preGenSnapshot`/`initialSnapshot`) |
| oc360/knowledge | `backend/src/oc360/knowledge/` | База знаний: загрузка .docx/.txt/.md (текст в БД, лимит 150 000 симв.), редактируемый системный промт (singleton `report_prompts`) |
| oc360/results | `backend/src/oc360/results/` | Результаты + `analytics.ts` — **методика v1.2**: зоны по |Δ| (консенсус ≤0.3 / внимание 0.4–0.5 / слепая-зона·скрытый-потенциал ≥0.6); сильные стороны — итоговая средняя >3.4, зоны развития — <3.0 (строго); целевой уровень — **константа 3.0** (значения циклов игнорируются); разборы пар «руководитель–подчинённые/коллеги» (|Δ|≥0.4); выбросы; анонимные открытые ответы |
| settings | `backend/src/settings/` | Пресеты LLM в БД (`llm_settings` + maxTokens/splitParts/partTimeouts, приоритет над env), ключ наружу — маской; `POST /settings/llm/test` (admin, throttled) |
| 360-админка | `frontend/app/hr-eval360/page.tsx` | Вкладки «Запуск оценки» / «Шаблон оценки» / «Шкала оценки» / «База знаний» / «Настройка» (системный промт) |
| HR-панель 360 | `…/[cycleId]/SubjectPanel.tsx` | Вкладки Воркфлоу/Результаты/Дашборд/**Отчёт**; редактирование цикла — только на Воркфлоу (поле «целевой уровень» убрано — константа) |
| ReportView (HR) | `…/[cycleId]/ReportView.tsx` | «AI генерация отчета» (полоса прогресса — оценка по времени, «✓ Отчёт готов» 10с), «Сброс» (2 режима), статусы DRAFT/READY, **«Скачать отчёт ▾» → меню PDF/DOCX** |
| Report360View | `frontend/components/eval360/Report360View.tsx` | Отчёт по PDF-образцу: таблица + диаграммы (вкл. пары самооценки и внешние пары) + редактируемые блоки (карандаш→правка→«Готово»; крестик — удалить, у HR «Восстановить»); постраничная печать (`print-cover`/`print-page`) |
| reportDocx | `frontend/components/eval360/reportDocx.ts` | Сборка DOCX в браузере (docx): диаграммы SVG→PNG, постраничность, таблица, титульный лист |
| auth | `backend/src/auth/` | JWT-валидация через JWKS; `KeycloakAuthGuard` — **бросает 401** при отсутствии токена; `RolesGuard` по `@Roles` |
| import | `backend/src/import/` | Импорт сотрудников из Excel + создание учёток Keycloak |
| employees, departments, positions, me, profile, appeals | `backend/src/…` | CRUD орг-структуры и личный кабинет; **проверка владельца (IDOR)** в appeals/profile |
| API-клиент | `frontend/lib/api.ts` | fetch-обёртка с bearer-токеном, все типы API (Report360*, Knowledge*, LlmPreset*) |
| AuthContext | `frontend/contexts/AuthContext.tsx` | Keycloak-логин, роли из токена; mock-режим (`NEXT_PUBLIC_AUTH_MODE=mock`, не дефолт) |

**Prisma-модели по доменам:** орг-структура (Department, Position, Employee, WorkExperience, Education) · обращения (Appeal, AppealComment, AppealFile) · шаблоны 360 (CompetencyVersion, CompetencyTemplate, IndicatorTemplate, ScaleTemplate, ScalePointTemplate) · циклы 360 (Cycle360 + `targetLevel` — колонка не читается, Competency/Indicator/ScalePoint/Subject/Respondent/IndicatorResponse/OpenAnswer) · **AI-отчёт** (Cycle360Report: `sections` JSON + `preGenSnapshot`/`initialSnapshot`, статус DRAFT/READY) · **LLM/знания** (LlmSettings + maxTokens/splitParts/partTimeouts, KnowledgeDoc, ReportPrompt singleton).

## Безопасность (сделано перед публичным доступом)
- **Аутентификация:** guard бросает 401 (не пропускает без токена); роль только из токена (`/me` без query-роли); анонимные контроллеры закрыты (appeals/profile/employees под guard).
- **Авторизация:** проверка владельца (IDOR) в обращениях и профиле — сотрудник видит только своё, HR/admin — всё.
- **Лимиты:** `@nestjs/throttler` глобально 120/мин на IP + жёсткий `@Throttle` на генерацию/тест LLM; `trust proxy` (реальный IP за Traefik); замок от двойной генерации.
- **Транспорт/заголовки:** helmet; CORS по `FRONTEND_ORIGIN` (не `*`); наружу только Traefik по HTTPS, порты не публикуются; Keycloak `sslRequired: external`.
- **Валидация:** глобальный `ValidationPipe` + class-validator на DTO обращений; кламп `limit`, белый список полей сортировки.
- **Keycloak/учётки:** боевой режим `start`, `bruteForceProtected`; демо-юзеры только в dev-realm; прод-realm без них.
- **Секреты:** сильные пароли в Dokploy env; IP убран из `.env.prod.example`.
- Полный чек-лист и ручные шаги — в `DEPLOY.md`. Переносимые правила — файлы `security_rules*.md` (вне репозитория).

## Как запустить / проверить
```bash
# Локально
cd backend && npm run start:dev        # NestJS на :4000 (нужен Postgres и Keycloak)
cd frontend && npm run dev             # Next.js на :3001

# БД (после правки schema.prisma — ВСЕГДА ПАРОЙ, локальным бинарником; Windows cmd — обратные слэши)
node_modules/.bin/prisma generate
node_modules/.bin/prisma db push       # структура БД (прод делает то же на старте)
npm run db:seed          # 20 тестовых сотрудников (НЕ сеет шаблон 360!)
npm run db:seed:360      # шкала + компетенции 360 (отдельно, идемпотентно)

# Проверки
npx tsc --noEmit         # frontend/ и backend/ (backend: tsc -p tsconfig.build.json)
npm run build            # frontend (Next build)

# Прод: Dokploy → hr-portal → Redeploy, ветка mvp2 (см. DEPLOY.md)
```
**Тесты:** формальных нет; проверка — смоуки на ts-node (analytics/промпт/DTO) + tsc/build. **CI:** нет.

## Known issues

### Инфраструктура / деплой
- `KEYCLOAK_URL` для backend **обязан** включать `/auth` (`http://keycloak:8080/auth`). Без него JWKS 404 → все запросы 403.
- Issuer/audience JWT не валидируются — проверяется только подпись через JWKS. `KEYCLOAK_PUBLIC_URL` = `https://sitehrportal.ru/auth`.
- Backend на старте выполняет `prisma db push --accept-data-loss` (не `migrate deploy`). Правило схемы: **только аддитивно** (новые таблицы / nullable-колонки); NOT NULL на непустой таблице = restart-loop. Переход на миграции — отложенная задача.
- Realm-import идемпотентен (`IGNORE_EXISTING`): правки realm-файлов **не применяются к живому realm** — включать в админке Keycloak (brute-force, sslRequired), файл сработает только при чистой установке.
- **Таймаут долгой LLM-генерации на проде — ручной шаг в Traefik.** Если `respondingTimeouts`/`forwardingTimeouts` не подняты (≥1300s), Traefik рвёт запрос генерации: фронт сбрасывает `busy` → кнопка «AI генерация» снова активна и прогресс исчезает, но **бэкенд генерацию доводит** (её защищает замок → повтор даёт 409). Итог — «отчёт в итоге появился». Локально в `nginx.conf` таймаут 1300с уже задан.

### LLM / отчёт
- Reasoning-модели кладут `<think>…</think>` в `content` — `llm.client.ts` срезает перед разбором JSON. `response_format: json_object` с автооткатом при 400.
- Полоса прогресса генерации — **оценка по времени** (localStorage), сервер промежуточный прогресс не отдаёт; статуса «идёт генерация» в БД нет (кнопка блокируется по живому запросу — см. таймаут выше; надёжный фикс = статус `GENERATING`, ещё не сделан).
- Список моделей провайдера проверять через `GET {base}/models`, не по документации.
- Ключ LLM в БД хранится открыто (закрытый контур), наружу — маска. В промпт уходит ФИО + анонимизированные комментарии — при внешнем провайдере учитывать ПДн (тест на вымышленных данных).

### Логика
- `seed.ts` не вызывает `seedOc360` — после сброса БД шаблон 360 пуст до `db:seed:360`.
- Логин импортированных: username = email, пароль = цифры табельного (temporary). Строки Excel без email падают.
- Составы разделов отчёта у отчётов, сгенерированных до методики v1.2, обновятся только после перегенерации; кастомный промт HR со старой формулировкой — «Сбросить к стандартному».
- IDOR закрыт для чтения/правки, но тонкая видимость (напр. кто из HR/менеджеров что видит по обращениям) — на будущее.

### Mock / незавершённое
- Страницы-заглушки (`StubPage`): adaptation, benefits, docs, events, help, learn, news, org, surveys; `career`/`culture` — статика.
- Хардкод absence-bars на `/manager`.
- `sslRequired: external` — в prod-realm файле; на живом сервере включить в админке.

---
_Обновлено 2026-07-24 по состоянию ветки `mvp2` (после методики v1.2, DOCX-выгрузки и блока безопасности)._

# Карта проекта: HR-портал «Газпром ЦПС»

## Что это
Корпоративный HR-портал для сотрудников: личный кабинет, справочник сотрудников с импортом из Excel, обращения к HR и полный цикл оценки 360 (версионируемые наборы компетенций + шкалы → циклы → опрос респондентов → результаты с radar-дашбордом → **AI-отчёт**: генерация интерпретации через LLM по методике, поблочная правка HR, удаление/восстановление блоков, публикация сотруднику, выгрузка в PDF). Роли: employee / manager / hr / admin через Keycloak SSO. Прод: https://sitehrportal.ru (деплой через Dokploy, ветка **`mvp2`**).

## Стек
**Frontend:** Next.js 14.2.35 (App Router), React ^18, TypeScript ^5, keycloak-js ^26.2.3. Без UI-библиотек — свой CSS (токены + утилиты), графики — свой SVG (`RadarChart`).
**Backend:** NestJS ^10, Prisma ^6.19.3, passport-jwt ^4.0.1 + jwks-rsa ^4.0.1 (валидация JWT Keycloak), exceljs ^4.4.0 (импорт), jszip ^3.10.1 (парсинг .docx базы знаний).
**LLM:** любой OpenAI-совместимый API (`/chat/completions`), клиент на нативном fetch; конфиг в БД (`/admin/llm`) с fallback на env `LLM_*`. Пилотный провайдер — Gonka/OpenGNK (`https://api.proxy.gonka.gg/v1`, модель `MiniMaxAI/MiniMax-M2.7`, reasoning).
**Инфраструктура:** PostgreSQL 16-alpine, Keycloak 24.0 (realm `hr-portal`, клиент `hr-portal-app`), Docker Compose (4 сервиса), Dokploy, reverse-proxy по путям `/` → frontend :3001, `/api` → backend :4000 (`proxy_read_timeout 330s` — генерация до 5 мин), `/auth` → keycloak :8080.
**Node engines:** TODO — не зафиксированы в package.json (в Docker — node:22-alpine).

## Структура
```
HR-portal/
├── docker-compose.yml        # прод-компоуз (домен sitehrportal.ru в build args, LLM_* env)
├── docker-compose.local.yml, docker-compose.db.yml
├── DEPLOY.md                 # инструкция деплоя (Dokploy, LLM, таймауты)
├── CLAUDE.md                 # правила работы (цикл задачи, журналы)
├── harness/                  # PROJECT.md (карта), DECISIONS.md, LESSONS.md, templates/
├── tasks/                    # рабочие файлы задач (BRIEF/PLAN по шаблонам)
├── keycloak/realm-export.json# realm: роли, клиент, маппер realm_roles, тестовые юзеры
├── nginx/nginx.conf          # роутинг /, /api, /auth; таймаут /api 330с
├── backend/
│   ├── prisma/               # schema.prisma, 13 миграций, seed.ts, seed-oc360.ts, скрипты
│   └── src/                  # NestJS-модули (см. таблицу)
│       └── oc360/            # cycle/, respondent/, results/ (+analytics.ts),
│                             # template/, report/ (LLM-отчёт), knowledge/ (база знаний)
└── frontend/
    ├── app/
    │   ├── hr-eval360/       # админ 360: page.tsx (вкладки Запуски/Шаблон оценки/
    │   │                     # Шкала оценки/База знаний/Настройка), KnowledgeTab.tsx,
    │   │                     # [cycleId]/ (SubjectPanel, ReportView)
    │   ├── eval360/          # сотрудник: опросы + мои результаты (отчёт read-only, PDF)
    │   └── admin/            # employees, departments, positions, import, llm
    ├── components/           # primitives/ (Modal, Icon, Toast…), layout/,
    │   └── eval360/          # Report360View, RadarChart, CategoryRadarCard, helpers
    ├── contexts/AuthContext.tsx
    └── lib/                  # api.ts (fetch+bearer, все типы), keycloak.ts
```

## Ключевые модули и точки входа
| Модуль | Где | За что отвечает |
|--------|-----|-----------------|
| oc360 | `backend/src/oc360/` | Весь цикл оценки 360: версии наборов компетенций, шаблоны, шкалы, циклы, респонденты, результаты, AI-отчёт, база знаний |
| oc360/report | `backend/src/oc360/report/` | AI-отчёт: `llm.client.ts` (OpenAI-совм. клиент, срез `<think>` reasoning-моделей, max_tokens 8000, таймаут 300с), `report.prompt.ts` (методика+документы+защищённая JSON-схема), `report.types.ts` (`normalizeSections`, `hiddenBlocks`), `report.service.ts` (generate/update/reset; снимки `preGenSnapshot`/`initialSnapshot` — сброс «до предыдущей версии»/«до первоначального состояния») |
| oc360/knowledge | `backend/src/oc360/knowledge/` | База знаний: загрузка .docx/.txt/.md (текст в БД, лимит контекста 150 000 симв.), редактируемый системный промт (методическая часть, singleton `report_prompts`) |
| oc360/results | `backend/src/oc360/results/` | Результаты + `analytics.ts` — методика интерпретации (Δ-категории, слепые зоны/скрытый потенциал ≥0.6, сравнение с целевым уровнем, выбросы, анонимные открытые ответы) |
| settings | `backend/src/settings/` | Настройки LLM в БД (`llm_settings`, приоритет над env), ключ наружу — маской; `POST /settings/llm/test` (роль admin) |
| 360-админка | `frontend/app/hr-eval360/page.tsx` | Вкладки «Запуски» / «Шаблон оценки» / «Шкала оценки» / «База знаний» (документы) / «Настройка» (системный промт) |
| HR-панель 360 | `frontend/app/hr-eval360/[cycleId]/SubjectPanel.tsx` | Вкладки Воркфлоу/Результаты/Дашборд/**Отчёт**; кнопка «Редактировать» цикла — только на Воркфлоу |
| ReportView (HR) | `frontend/app/hr-eval360/[cycleId]/ReportView.tsx` | «AI генерация отчета» (полоса прогресса с адаптивной оценкой времени, «✓ Отчёт готов» 10с), «Сброс» (2 режима), статусы DRAFT/READY, «Скачать PDF» |
| Report360View | `frontend/components/eval360/Report360View.tsx` | Отчёт по PDF-образцу: таблица+диаграммы (read-only) + 10 редактируемых блоков (карандаш → правка → «Готово»; крестик — удалить блок, у HR плашка «Восстановить», у сотрудника/в PDF блока нет) |
| auth | `backend/src/auth/` | JWT-валидация через JWKS Keycloak, гарды ролей |
| import | `backend/src/import/` | Импорт сотрудников из Excel + создание учёток Keycloak (роль `admin`) |
| employees, departments, positions, me, profile, appeals | `backend/src/…` | CRUD орг-структуры и личный кабинет |
| API-клиент | `frontend/lib/api.ts` | fetch-обёртка с bearer-токеном, все типы API (в т.ч. Report360*, Knowledge*, LlmSettings*) |
| AuthContext | `frontend/contexts/AuthContext.tsx` | Keycloak-логин, роли из токена; есть mock-режим (`NEXT_PUBLIC_AUTH_MODE=mock`) |

**Prisma-модели по доменам:** орг-структура (Department, Position, Employee, WorkExperience, Education) · обращения (Appeal, AppealComment, AppealFile) · шаблоны 360 (CompetencyVersion, CompetencyTemplate, IndicatorTemplate, ScaleTemplate, ScalePointTemplate) · циклы 360 (Cycle360 + `targetLevel`, Competency/Indicator/ScalePoint/Subject/Respondent/IndicatorResponse/OpenAnswer) · **AI-отчёт** (Cycle360Report: `sections` JSON + `preGenSnapshot`/`initialSnapshot`, статус DRAFT/READY) · **LLM/знания** (LlmSettings singleton, KnowledgeDoc, ReportPrompt singleton).

## Как запустить / проверить
```bash
# Локально
cd backend && npm run start:dev        # NestJS на :4000 (нужен Postgres и Keycloak)
cd frontend && npm run dev             # Next.js на :3001

# БД (после правки schema.prisma — ВСЕГДА ПАРОЙ, локальным бинарником)
node_modules/.bin/prisma generate      # типы клиента
node_modules/.bin/prisma db push       # структура БД (прод делает то же на старте)
npm run db:seed          # 20 тестовых сотрудников (НЕ сеет шаблон 360!)
npm run db:seed:360      # шкала + компетенции 360 (отдельно, идемпотентно)

# LLM (опционально; без него отчёт заполняется вручную)
# env: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_TEMPERATURE — fallback;
# приоритетнее — админка /admin/llm (кнопка «Проверить подключение»)

# Проверки
npx tsc --noEmit         # в frontend/ и backend/ (backend: tsc -p tsconfig.build.json)
npm run lint             # eslint (оба пакета)

# Прод: Dokploy → hr-portal → Redeploy, ветка mvp2 (см. DEPLOY.md)
```
**Тесты:** фактически нет — только нетронутый Nest-boilerplate. **CI:** нет.

## Known issues

### Инфраструктура / деплой (выловлено на бою)
- `KEYCLOAK_URL` для backend **обязан** включать `/auth` (`http://keycloak:8080/auth`). Без него JWKS 404 → все запросы 403.
- Issuer-валидация JWT убрана (issuer в токене — публичный URL); подпись проверяется через JWKS. `KEYCLOAK_PUBLIC_URL` = `https://sitehrportal.ru/auth`.
- `auth.guard.ts` возвращает `null` вместо исключения → любая ошибка JWT выглядит как 403 (не 401).
- Backend на старте выполняет `prisma db push` (не `migrate deploy`). Правило схемы: **только аддитивно** — новые таблицы или nullable-колонки; NOT NULL на непустой таблице = restart-loop контейнера.
- Keycloak запущен как `start-dev`; realm-import идемпотентен — правки `realm-export.json` не применяются к живому realm без его удаления.
- Таймауты генерации согласованы по цепочке: LLM-клиент 300с < nginx 330с; на Traefik (Dokploy) таймаут ответа настраивать отдельно (≥300с).

### LLM / отчёт
- Reasoning-модели кладут `<think>…</think>` в `content` — `llm.client.ts` срезает рассуждения перед разбором JSON (см. LESSONS 2026-07-17). `response_format: json_object` с автооткатом при 400.
- Полоса прогресса генерации — **оценка по времени** (localStorage, последние 5 замеров), сервер промежуточный прогресс не отдаёт (нет стриминга).
- Gonka фактически отдаёт только `MiniMaxAI/MiniMax-M2.7` — список моделей проверять через `GET {base}/v1/models`, не по документации.
- Ключ LLM в БД хранится открыто (решение для закрытого контура), наружу — только маска.
- В промпт уходит ФИО оцениваемого + анонимизированные комментарии — при внешнем провайдере учитывать ПДн (тестируем на вымышленных данных).

### Логика
- `seed.ts` не вызывает `seedOc360` — после сброса БД шаблон 360 пуст, пока не запустишь `db:seed:360`.
- Логин импортированных: username = email, пароль = цифры табельного (temporary). Строки Excel без email падают.
- Отчёты, созданные до введения `initialSnapshot` (2026-07-17), получат «Сброс до первоначального состояния» только после следующей генерации.
- Аддитивные миграции на непустых таблицах: новая колонка nullable + бэкфилл в коде на старте (напр. `ensureDefaultVersion`).

### Mock / незавершённое
- 9 страниц-заглушек (`StubPage`): adaptation, benefits, docs, events, help, learn, news, org, surveys; `career`/`culture` — статика.
- Хардкод absence-bars на `/manager`; `RightRail.tsx` не используется.
- AuthContext поддерживает mock-режим (`NEXT_PUBLIC_AUTH_MODE=mock`), проект сконфигурирован на keycloak.
- Открытый CORS (`enableCors()` без опций), нет ValidationPipe и Swagger — TODO для прода.

---
_Обновлено 2026-07-19 по состоянию ветки `mvp2`. Помечено TODO там, где данных в репозитории нет._

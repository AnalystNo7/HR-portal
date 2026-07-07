# Карта проекта: HR-портал «Газпром ЦПС»

## Что это
Корпоративный HR-портал для сотрудников: личный кабинет, справочник сотрудников с импортом из Excel, обращения к HR и полный цикл оценки 360 (шаблоны компетенций → циклы → опрос респондентов → результаты с radar-дашбордом → выводы). Роли: employee / manager / hr / admin через Keycloak SSO. Прод: https://sitehrportal.ru (деплой через Dokploy, ветка `mvp`).

## Стек
**Frontend:** Next.js 14.2.35 (App Router), React ^18, TypeScript ^5, keycloak-js ^26.2.3. Без UI-библиотек — свой CSS (токены + утилиты), графики — свой SVG (`RadarChart`).
**Backend:** NestJS ^10, Prisma ^6.19.3, passport-jwt ^4.0.1 + jwks-rsa ^4.0.1 (валидация JWT Keycloak), exceljs ^4.4.0 (импорт).
**Инфраструктура:** PostgreSQL 16-alpine, Keycloak 24.0 (realm `hr-portal`, клиент `hr-portal-app`), Docker Compose (4 сервиса), Dokploy, reverse-proxy по путям `/` → frontend :3001, `/api` → backend :4000, `/auth` → keycloak :8080.
**Node engines:** TODO — не зафиксированы в package.json (в Docker — node:22-alpine).

## Структура
```
HR-portal/
├── docker-compose.yml        # прод-компоуз (домен sitehrportal.ru зашит в build args)
├── docker-compose.local.yml, docker-compose.db.yml
├── DEPLOY.md                 # актуальная инструкция деплоя через Dokploy
├── keycloak/realm-export.json# realm: роли, клиент, маппер realm_roles, тестовые юзеры
├── nginx/nginx.conf          # роутинг /, /api, /auth
├── backend/
│   ├── prisma/               # schema.prisma, 6 миграций, seed.ts, seed-oc360.ts,
│   │                         # rename-category-360.ts, verify-oc360.ts
│   └── src/                  # NestJS-модули (см. таблицу)
└── frontend/
    ├── app/                  # роуты (App Router)
    │   ├── hr-eval360/[cycleId]/  # ядро 360: SubjectPanel, RadarChart
    │   └── admin/            # employees, departments, positions, import
    ├── components/           # primitives/ (Modal, Icon, Toast…), layout/ (AppShell…)
    ├── contexts/AuthContext.tsx
    └── lib/                  # api.ts (fetch+bearer), keycloak.ts
```

## Ключевые модули и точки входа
| Модуль | Где | За что отвечает |
|--------|-----|-----------------|
| oc360 | `backend/src/oc360/` (cycle/, respondent/, results/, template/) | Весь цикл оценки 360: шаблоны, циклы, респонденты, результаты, выводы |
| auth | `backend/src/auth/` | JWT-валидация через JWKS Keycloak (`keycloak.strategy.ts`), гарды ролей (`roles.guard.ts`) |
| import | `backend/src/import/` | Импорт сотрудников из Excel + создание учёток Keycloak (роль `admin`) |
| employees, departments, positions | `backend/src/…` | CRUD орг-структуры; ручное создание тоже заводит учётку Keycloak |
| me, profile, appeals | `backend/src/…` | Текущий пользователь, профиль (опыт/образование), обращения |
| main.ts | `backend/src/main.ts` | Префикс `api`, `enableCors()` (открытый), порт 4000 |
| HR-панель 360 | `frontend/app/hr-eval360/[cycleId]/SubjectPanel.tsx` | Вкладки Воркфлоу/Результаты/Дашборд/Выводы; radar-дашборд с зумом |
| RadarChart | `frontend/app/hr-eval360/[cycleId]/RadarChart.tsx` | SVG radar, тултипы значений (`showValues`) |
| AuthContext | `frontend/contexts/AuthContext.tsx` | Keycloak-логин, роли из токена; есть mock-режим (`NEXT_PUBLIC_AUTH_MODE=mock`) |
| API-клиент | `frontend/lib/api.ts` | fetch-обёртка с bearer-токеном, все типы API |

**Prisma-модели по доменам:** орг-структура (Department, Position, Employee, WorkExperience, Education) · обращения (Appeal, AppealComment, AppealFile) · шаблоны 360 (CompetencyTemplate, IndicatorTemplate, ScaleTemplate, ScalePointTemplate) · циклы 360 (Cycle360 + Competency/Indicator/ScalePoint/Subject/Respondent/IndicatorResponse/OpenAnswer/Conclusion).

## Как запустить / проверить
```bash
# Локально
cd backend && npm run start:dev        # NestJS на :4000 (нужен Postgres и Keycloak)
cd frontend && npm run dev             # Next.js на :3001

# БД
npm run db:seed          # 20 тестовых сотрудников + орг-структура (НЕ сеет шаблон 360!)
npm run db:seed:360      # шкала + компетенции 360 (отдельно, идемпотентно)
npm run db:rename:360cat # разовая миграция категории «Управленческие компетенции»→«Компетенции»

# Проверки
npx tsc --noEmit         # в frontend/ и backend/ — основная проверка в проекте
npm run lint             # eslint (оба пакета)

# Прод: Dokploy → hr-portal → hr-portal-stack → Redeploy (см. DEPLOY.md)
```
**Тесты:** фактически нет — только нетронутый Nest-boilerplate (`app.controller.spec.ts`, e2e «Hello World»). **CI:** нет (`.github/` отсутствует).

## Known issues

### Инфраструктура / деплой (выловлено на бою)
- `KEYCLOAK_URL` для backend **обязан** включать `/auth` (`http://keycloak:8080/auth`) — Keycloak с `KC_HTTP_RELATIVE_PATH=/auth`. Без него JWKS 404 → все запросы 403.
- Issuer-валидация JWT **убрана** (issuer в токене — публичный `https://sitehrportal.ru/auth`, не внутренний URL). Подпись проверяется через JWKS. `KEYCLOAK_PUBLIC_URL` в Dokploy должен быть `https://sitehrportal.ru/auth`.
- `auth.guard.ts` `handleRequest` возвращает `null` вместо исключения → **любая** ошибка JWT выглядит как 403 Forbidden (а не 401). Сильно затрудняет диагностику.
- Backend на старте выполняет `prisma db push` (CMD в Dockerfile), `migrate deploy` не используется. При несовместимом изменении схемы (NOT NULL-колонка на непустой таблице) контейнер уходит в restart-loop — уже случалось с `employees.department_id/position_id`.
- Keycloak запущен как `start-dev` — сам предупреждает «DO NOT use in production».
- Realm-import идемпотентен («already exists → skipped»): правки `realm-export.json` не применяются к живому realm без его удаления (`kcadm.sh delete realms/hr-portal` + restart).

### Логика
- `seed.ts` не вызывает `seedOc360` — после сброса БД шаблон 360 пуст, пока не запустишь `db:seed:360` отдельно.
- Логин импортированных: username = email, пароль = цифры табельного (temporary, смена при первом входе). Строки Excel без email падают с «User name is missing».
- `catLabel` в `SubjectPanel.tsx` — UI-fallback переименования категории для немигрированных данных; после `db:rename:360cat` можно удалить.
- ESM/CJS: `require.main === module` в сидерах не работал в ts-node на сервере — стоит fallback через `process.argv`.

### Mock / незавершённое
- 9 страниц-заглушек (`StubPage`): adaptation, benefits, docs, events, help, learn, news, org, surveys; `career`/`culture` — статика без API.
- Хардкод: «Вовлечённость 60%» в Header, 8 фейковых коллег в RightRail, absence-bars на `/manager` (в коде пометка «данные из 1С ЗУП»).
- AuthContext **поддерживает** mock-режим (`NEXT_PUBLIC_AUTH_MODE=mock`) — полный обход Keycloak с переключателем ролей, но проект сконфигурирован на `keycloak` (дефолт в `AuthContext.tsx`, `keycloak` в compose).
- Открытый CORS (`enableCors()` без опций), нет ValidationPipe и Swagger — TODO для прода.

---
_Черновик. Помечено TODO там, где данных в репозитории нет. Раздел «Что это» составлен из наблюдаемого функционала — уточнить продуктовую формулировку при необходимости._

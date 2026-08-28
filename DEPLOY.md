# Деплой HR-портала через Dokploy

Актуальная конфигурация: домен **https://sitehrportal.ru**, единый compose-файл `docker-compose.yml`,
роутинг по путям `/` (frontend), `/api` (backend), `/auth` (Keycloak).

## Архитектура

```
Browser → https://sitehrportal.ru/        → frontend (Next.js)
        → https://sitehrportal.ru/api      → backend (NestJS)
        → https://sitehrportal.ru/auth     → Keycloak

Внутри Docker-сети:
  frontend → backend  (http://backend:4000)
  backend  → keycloak (http://keycloak:8080)
  backend  → postgres (postgres:5432)
  keycloak → postgres (postgres:5432)
```

## Сервисы и порты

| Сервис | Внешний порт | Внутренний |
|---|---|---|
| Frontend | 3101 | 3001 |
| Backend | 4100 | 4000 |
| Keycloak | 8180 | 8080 |
| PostgreSQL | — (только внутри) | 5432 |

Публичный доступ по домену идёт через reverse-proxy (nginx/Traefik Dokploy) на пути `/`, `/api`, `/auth`.

---

## A. Обновление существующего деплоя (обычный сценарий)

Код уже в GitHub, ветка **`mvp`**. Схема БД синхронизируется автоматически —
backend на старте выполняет `prisma db push` (зашито в `backend/Dockerfile`),
отдельная миграция не нужна.

### 1. Запустить пересборку в Dokploy
- **Auto Deploy включён** → push в `mvp` уже запустил билд. Откройте проект `hr-portal`
  → сервис `hr-portal-stack` → **Deployments**, дождитесь зелёного статуса.
- **Вручную** → сервис `hr-portal-stack` → кнопка **Redeploy**. Сборка ~5–10 мин.

Переменные окружения при обновлении заново вводить не нужно.

### 2. Проверить логи
postgres `ready to accept connections` · keycloak `started` ·
backend `Nest application successfully started` · frontend `ready`.

### 3. Разовые миграции данных (если меняли сид/категории)
Dokploy → сервис **backend** → вкладка **Terminal** (или SSH + `docker exec`):

```bash
# Переименование «Управленческие компетенции» → «Компетенции»
# (обновляет competency_templates и cycle360_competencies; idempotent)
npm run db:rename:360cat

# По необходимости — досеять справочник компетенций/шкалу (без сотрудников)
npm run db:seed:360
```

Через SSH, если вкладки Terminal нет:
```bash
ssh root@<сервер>
docker ps | grep backend
docker exec -it <backend-container> sh -c "npm run db:rename:360cat"
```

### 4. Проверка
- `https://sitehrportal.ru/api/health` → `{"status":"ok"}`
- Портал → **HR → Оценка 360 → цикл → субъект → «Дашборд»**: карта называется
  «Компетенции», работают графики, раскрытие в окне, зум и тултипы.

### 5. Откат
Dokploy → **Deployments** → выбрать предыдущий успешный билд → **Rollback**.
(Переименование категории — это данные; откат кода их не возвращает, но это безопасно.)

---

## B. Первичная настройка (если разворачиваете с нуля)

### 1. GitHub в Dokploy
Settings → Git → GitHub → репозиторий `AnalystNo7/HR-portal`.

### 2. Проект и сервис
**Create Project** → `hr-portal` → **Create Service → Docker Compose** → имя `hr-portal-stack`.
- **Provider**: GitHub → `AnalystNo7/HR-portal` → ветка **`mvp`**
- **Compose Path**: `docker-compose.yml`

### 3. Переменные окружения
В разделе **Environment** (замените пароли на сильные):
```
POSTGRES_USER=hrportal
POSTGRES_PASSWORD=<сильный_пароль>
POSTGRES_DB=hrportal

KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=<сильный_пароль>

KEYCLOAK_PUBLIC_URL=https://sitehrportal.ru/auth

# Origin фронта для CORS backend (без него CORS открыт для всех — только для отладки).
# В проде укажите домен(ы) через запятую.
FRONTEND_ORIGIN=https://sitehrportal.ru

# Подключение к модели ИИ для генерации отчётов 360 (опционально).
# Любой OpenAI-совместимый API: OpenAI, DeepSeek, OpenRouter, локальный vLLM/Ollama и т.п.
# Без этих переменных портал работает полностью, отключена только генерация отчётов.
# ПРИОРИТЕТ: настройки из панели администратора (/admin/llm) важнее env;
# env используется как fallback, если в админке пусто. Можно вообще не задавать
# эти переменные и настроить подключение в UI после деплоя.
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=<ключ_API>
LLM_MODEL=gpt-4o
# LLM_TEMPERATURE=0.3   # необязательно, по умолчанию 0.3
# LLM_MAX_TOKENS=16384  # необязательно; НЕ задан — лимит не отправляется, размер ответа решает провайдер
```

**Настройка модели через админку:** после деплоя админ (роль `admin`) может
задать/сменить подключение на странице **Администрирование → «Генерация отчётов (ИИ)»**
(`/admin/llm`): адрес API, ключ, модель, температура + кнопка «Проверить подключение».
Настройки хранятся в БД (таблица `llm_settings`), менять их можно без редеплоя.
Ключ показывается в интерфейсе только маской.
Публичные `NEXT_PUBLIC_*` для frontend зашиты в `docker-compose.yml` (build args на домен `sitehrportal.ru`) — отдельно задавать не нужно.

**Важно для генерации отчётов:** запрос к LLM идёт до 5 минут за попытку
(`LlmService.TIMEOUT_MS = 300s`), при таймауте backend делает 1 автоповтор (ноды
Gonka нестабильны). Части генерации (настройка «Генерация отчёта» в пресете LLM)
выполняются последовательно — Gonka не допускает одновременных запросов по ключу
(429), при 429 backend ждёт 15с и повторяет один раз. Число частей — от 1 до 5
(чем ниже потолок вывода у провайдера, тем больше частей: у GonkaRouter потолок
4096 → пять). Таймаут чтения reverse-proxy для пути `/api`: в `nginx/nginx.conf`
задан `proxy_read_timeout 1300s`, при использовании Traefik в Dokploy задайте
таймаут ответа ≥ 1300s.

Полностью худший случай под прокси уже не подводится и подводиться не должен:
5 частей × 2 попытки × 300с ≈ 50 минут против 1300с. Это принято сознательно —
обрыв долгого запроса переживается на фронте: при потере HTTP-ответа страница
отчёта опрашивает результат каждые 5с (дедлайн ≥10 минут) и показывает отчёт,
который backend довёл до конца. Поднимать таймаут прокси под худший случай не нужно.

### 4. Домен
В Dokploy привяжите домен `sitehrportal.ru` к сервису frontend (порт 3001),
включите HTTPS (Let's Encrypt). Пути `/api` и `/auth` проксируются на backend и keycloak.

### 5. Deploy → миграции
Нажмите **Deploy**, дождитесь старта 4 сервисов, затем в Terminal backend:
```bash
npx prisma migrate deploy   # или сработает авто-`prisma db push` на старте
npm run db:seed:360         # справочник компетенций + шкала
npm run db:rename:360cat    # привести категорию к «Компетенции»
```

### 6. Keycloak
- `https://sitehrportal.ru/auth/admin` → admin / пароль из env.
- Realm `hr-portal` импортируется автоматически из `keycloak/realm-export.json`.
- Клиент `hr-portal-app` уже содержит redirect URIs и web origins для
  `https://sitehrportal.ru/*` — проверьте, при необходимости поправьте.

---

## Авто-деплой
Сервис `hr-portal-stack` → **Auto Deploy: On** → каждый `git push origin mvp`
автоматически пересобирает и перезапускает стек. Шаг 3 (миграции данных) при
изменении сида/категорий выполняется вручную.

## Если что-то сломалось

**Keycloak не стартует** — проверьте схему `keycloak` в БД:
```bash
docker exec -it <postgres-container> psql -U hrportal -d hrportal -c "CREATE SCHEMA IF NOT EXISTS keycloak;"
```

**Frontend не видит API** — `NEXT_PUBLIC_API_URL` вшивается при сборке. Если меняли домен,
пересоберите образ (Redeploy), а не только перезапустите.

**CORS** — backend разрешает запросы с origin из `FRONTEND_ORIGIN` (`backend/src/main.ts`);
если переменная не задана — CORS открыт для всех (только для отладки).

---

## Чек-лист безопасности перед публичным доступом

Часть защиты уже в коде (rate limit по IP, helmet, CORS по origin, серверный замок
генерации, закрытый анонимный доступ к API). Остальное — конфигурация, которую
нужно сделать вручную в Dokploy/Keycloak. Отметьте перед выкладкой наружу:

**Критично:**
- [x] **Демо-пользователи Keycloak — закрыто разделением realm.** Прод-`docker-compose.yml`
  монтирует `keycloak/realm-export.prod.json` (без демо-юзеров); демо-учётки
  (`employee1`, `hr1`, `admin1` и т.д.) остались только в `realm-export.json` для локалки
  (`docker-compose.local.yml`). **Действие оператора:** после первого старта прод-realm
  пуст на пользователей — завести первого админа вручную: Keycloak admin console
  (`/auth/admin`, вход под `KEYCLOAK_ADMIN`) → realm `hr-portal` → Users → создать
  пользователя и назначить realm-роль `admin`; либо импортировать сотрудников
  (Администрирование → импорт) и назначить роль `admin` нужному сотруднику.
- [x] **Keycloak в prod-режиме.** `docker-compose.yml` → `command: start --import-realm`
  (боевой режим). `bruteForceProtected: true` — включено в realm. **После деплоя проверить
  вход** (см. ниже); если Keycloak не поднимается/не пускает — откатить на `start-dev`.
- [x] **Требование HTTPS в realm.** `sslRequired: "external"` прописан в
  `realm-export.prod.json` (действует при чистой установке). На работающем сервере
  включается в админке: Realm settings → General → **Require SSL** → `External requests`
  → Save; после — проверить вход; откат — вернуть `None` там же. Публичный клиент
  `directAccessGrantsEnabled` (password-grant) отключить, если не используется, —
  отдельный необязательный пункт.
- [x] **Порты не наружу.** `ports:` у backend/keycloak/frontend убраны из прод-compose —
  доступ только через Traefik (TLS) по домену. Postgres наружу и так не публиковался.
  Проверено: вход по домену работает, прямые `http://IP:8180/4100/3101` закрыты.
- [ ] **Сильные пароли.** Задать `POSTGRES_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`,
  `FRONTEND_ORIGIN` в Environment Dokploy (не полагаться на дефолты `hrportal`/`admin`).

**Желательно:**
- [ ] **Rate limit на уровне прокси.** В Traefik добавить middleware
  `rateLimit` (по IP) как второй рубеж к throttler в приложении, особенно на `/auth`
  (брутфорс логина Keycloak). Security-заголовки (HSTS и т.п.) — middleware `headers`.
- [ ] **Миграции вместо `db push`.** `backend/Dockerfile` в CMD делает
  `prisma db push --accept-data-loss` при каждом старте — на проде это риск потери
  данных при расхождении схемы. Перейти на `prisma migrate deploy` с версионными
  миграциями (отдельная задача).
- [ ] **IDOR/видимость.** Профиль (`employees/:id/work-experiences|educations`) и
  обращения (`/appeals`) сейчас доступны любому аутентифицированному — нет проверки
  владельца: сотрудник может по чужому `employeeId` читать/править чужой профиль и
  видеть чужие обращения. Требует продуктового решения (кто что видит) — отдельная задача.
- [ ] **Реальный IP в репозитории.** Убрать IP VPS из `.env.prod.example`.
- [ ] **Валидация входных данных.** Подключить глобальный `ValidationPipe` +
  `class-validator` на DTO (сейчас тела запросов не валидируются) — отдельная задача.

**Redirect URI отклонён** — Keycloak → Clients → `hr-portal-app` → Valid redirect URIs
должны включать `https://sitehrportal.ru/*`.

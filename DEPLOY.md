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
```
Публичные `NEXT_PUBLIC_*` для frontend зашиты в `docker-compose.yml` (build args на домен `sitehrportal.ru`) — отдельно задавать не нужно.

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

**CORS** — backend разрешает запросы (`app.enableCors()` в `backend/src/main.ts`).

**Redirect URI отклонён** — Keycloak → Clients → `hr-portal-app` → Valid redirect URIs
должны включать `https://sitehrportal.ru/*`.

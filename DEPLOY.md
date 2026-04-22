# Деплой HR-портала на Timeweb через Dokploy

## Архитектура

```
Browser → 92.53.124.249:3101 (frontend, Next.js)
       → 92.53.124.249:4100/api (backend, NestJS)
       → 92.53.124.249:8180 (Keycloak)

Внутри Docker сети:
  frontend → backend (http://backend:4000)
  backend → keycloak (http://keycloak:8080)
  backend → postgres (http://postgres:5432)
  keycloak → postgres (http://postgres:5432)
```

## Порты

| Сервис | Внешний порт | Внутренний |
|---|---|---|
| Frontend | **3101** | 3001 |
| Backend | **4100** | 4000 |
| Keycloak | **8180** | 8080 |
| PostgreSQL | — (только внутри) | 5432 |

Порты выбраны так чтобы не конфликтовать с другим решением на сервере.

## Шаги деплоя в Dokploy

### 1. Подключить GitHub (уже сделано)

Settings → Git Integrations → GitHub → ваш репозиторий `AnalystNo7/HR-portal`.

### 2. Создать новый проект в Dokploy

1. Кнопка **Create Project** → название `hr-portal`

### 3. Добавить Docker Compose приложение

1. В проекте нажать **Create Service** → **Docker Compose**
2. Имя: `hr-portal-stack`
3. **Provider**: GitHub → выбрать `AnalystNo7/HR-portal` → ветка `mvp`
4. **Compose Path**: `docker-compose.prod.yml`

### 4. Добавить переменные окружения

В разделе **Environment** вставьте содержимое `.env.prod.example`:

```
POSTGRES_USER=hrportal
POSTGRES_PASSWORD=hrportal_strong_password_change_me
POSTGRES_DB=hrportal

KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin_strong_password_change_me

NEXT_PUBLIC_API_URL=http://92.53.124.249:4100/api
NEXT_PUBLIC_KEYCLOAK_URL=http://92.53.124.249:8180
KEYCLOAK_PUBLIC_URL=http://92.53.124.249:8180
```

**Замените пароли на сильные!**

### 5. Deploy

1. Нажмите **Deploy**
2. Ждите 5-10 минут (сборка Docker образов)
3. В логах проверьте что все 4 сервиса запустились:
   - postgres: `database system is ready to accept connections`
   - keycloak: `Keycloak ... started`
   - backend: `Nest application successfully started`
   - frontend: `ready started server on :::3001`

### 6. Настроить Keycloak realm

1. Открыть http://92.53.124.249:8180/admin
2. Логин: admin / пароль из env
3. Realm `hr-portal` должен быть автоматически импортирован из `keycloak/realm-export.json`
4. Проверить клиент `hr-portal-app`:
   - **Valid redirect URIs**: `http://92.53.124.249:3101/*`
   - **Web origins**: `http://92.53.124.249:3101`
5. Если значения другие → обновить на указанные → Save

### 7. Запустить миграции и seed

В Dokploy → Terminal контейнера `backend`:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Или через SSH:

```bash
ssh root@92.53.124.249
docker exec -it <hr-backend-container-id> sh
npx prisma migrate deploy
npx prisma db seed
exit
```

### 8. Открыть портал

http://92.53.124.249:3101 → Keycloak login → employee1/employee1

## Если что-то сломалось

### Keycloak не стартует
Проверьте что схема `keycloak` существует в БД:
```bash
docker exec -it <postgres-container> psql -U hrportal -d hrportal -c "CREATE SCHEMA IF NOT EXISTS keycloak;"
```

### Frontend не загружает API
В DevTools → Network → Headers — Frontend использует URL из ENV при сборке. Если неправильный — пересоберите образ с правильным `NEXT_PUBLIC_API_URL`.

### Ошибка CORS
Backend должен разрешать домен frontend. Проверьте в `backend/src/main.ts` — `app.enableCors()` без параметров разрешает всё (для dev/demo ок).

### Keycloak отказывается принимать redirect
Admin console → Clients → hr-portal-app → Valid redirect URIs → должны быть:
- `http://92.53.124.249:3101/*`
- `http://92.53.124.249:3101`

## После деплоя — проверка

- [ ] http://92.53.124.249:4100/api/health → `{"status":"ok"}`
- [ ] http://92.53.124.249:8180 → Keycloak welcome page
- [ ] http://92.53.124.249:3101 → редирект на Keycloak login
- [ ] Логин employee1/employee1 → портал открывается

## Обновление

Dokploy умеет auto-deploy по push в GitHub:

1. В настройках Docker Compose приложения → **Auto Deploy** → On
2. Теперь при каждом `git push origin mvp` Dokploy автоматически пересобирает и перезапускает

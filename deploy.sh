#!/usr/bin/env bash
# Деплой «Шахматы под прикрытием» на сервер Ubuntu (от root).
# Запуск:
#   curl -fsSL https://raw.githubusercontent.com/AlexFimin/chess-undercover/main/deploy.sh | bash
# Повторный запуск обновляет приложение до последней версии из репозитория.

set -euo pipefail

APP_DIR="/opt/chess-undercover"
REPO="https://github.com/AlexFimin/chess-undercover.git"
BRANCH="main"
APP_NAME="chess-undercover"
PORT="3001"

# Запрещаем git запрашивать учётные данные:
# при curl | bash prompt git мог бы «съесть» остаток скрипта из stdin
export GIT_TERMINAL_PROMPT=0

echo "==> [1/7] Обновление системы..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> [2/7] Установка Node.js 20 и git..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git
echo "    Node.js: $(node -v), npm: $(npm -v)"

echo "==> [3/7] Установка PM2..."
npm install -g pm2

echo "==> [4/7] Загрузка кода (ветка $BRANCH)..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi
echo "    Версия: $(git log -1 --format='%h %s')"

# Явная проверка: код загрузился полностью
if [ ! -f "$APP_DIR/package.json" ]; then
  echo ""
  echo "ОШИБКА: package.json отсутствует после загрузки кода"
  echo "Содержимое $APP_DIR:"
  ls -la "$APP_DIR"
  exit 1
fi

echo "==> [5/7] Установка зависимостей и сборка клиента..."
npm install
npm run build

echo "==> [6/7] Запуск через PM2..."
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start node_modules/.bin/tsx --name "$APP_NAME" -- server/index.ts
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null

# Firewall: правила на случай, если ufw активен (сам не включается)
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp   >/dev/null 2>&1 || true
  ufw allow 3001/tcp >/dev/null 2>&1 || true
fi

echo "==> [7/7] Проверка..."
sleep 2
if curl -fsS -o /dev/null "http://localhost:$PORT/"; then
  PUBLIC_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo '<IP-сервера>')"
  echo ""
  echo "======================================================"
  echo "  Деплой успешен!"
  echo ""
  echo "  Игра:        http://$PUBLIC_IP:$PORT"
  echo "  Логи:        pm2 logs $APP_NAME"
  echo "  Перезапуск:  pm2 restart $APP_NAME"
  echo "  Обновление:  повторно запустить этот же скрипт"
  echo "======================================================"
  if [ -f /var/run/reboot-required ]; then
    echo ""
    echo "  ВНИМАНИЕ: система обновила ядро, требуется перезагрузка: reboot"
  fi
else
  echo ""
  echo "ОШИБКА: сервер не отвечает на http://localhost:$PORT"
  echo "Логи приложения: pm2 logs $APP_NAME"
  exit 1
fi

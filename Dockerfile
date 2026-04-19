# ---------- build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

RUN npm run build

# ---------- runtime stage ----------
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

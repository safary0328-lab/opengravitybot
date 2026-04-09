# ETAPA 1: Construir gogcli (Solución de Versión Go)
FROM golang:1.24-bookworm AS builder
WORKDIR /build
ENV GOTOOLCHAIN=auto
RUN apt-get update && apt-get install -y curl unzip
RUN curl -L -o source.zip https://github.com/steipete/gogcli/archive/refs/tags/v0.12.0.zip && \
    unzip source.zip && \
    cd gogcli-0.12.0 && \
    go build -v -o /usr/local/bin/gog ./cmd/gog

# ETAPA 2: Entorno de ejecución del Bot
FROM node:20-bookworm
WORKDIR /app

# INSTALAMOS FFMPEG (CRÍTICO PARA AUDIO/VOZ)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Copiar el binario gog construido
COPY --from=builder /usr/local/bin/gog /usr/local/bin/gog
RUN chmod +x /usr/local/bin/gog

# Instalar dependencias de producción
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

# Aplicación
COPY . .

# Puerto para el health check
EXPOSE 7860

# Iniciar el bot
CMD ["npm", "start"]

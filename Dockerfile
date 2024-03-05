FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        tini \
        && curl https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg && \
        sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] https://dl-ssl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
        apt-get update && \
        apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 dbus dbus-x11 \
        --no-install-recommends && \
        service dbus start && \
        rm -rf /var/lib/apt/lists/* && \
        groupadd -r app && useradd -rm -g app -G audio,video app

USER app

WORKDIR /app

COPY package* entrypoint.sh .

RUN npm ci --omit-dev

COPY src .

ENTRYPOINT ["tini", "-vv", "--", "/app/entrypoint.sh"]

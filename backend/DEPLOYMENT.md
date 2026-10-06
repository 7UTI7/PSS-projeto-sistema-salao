Configure UFW permitindo SSH em `22822/tcp` e HTTPS em `8443/tcp` (por exemplo, `sudo ufw allow 22822/tcp` e `sudo ufw allow 8443/tcp`, depois `sudo ufw enable`); não remova o acesso atual até validar a nova porta. Mantenha um procedimento de recuperação pelo console do provedor.
# Implantação VPS - Ubuntu Server 22.04 LTS

## 1. Preparação do host

Atualize o sistema e instale ferramentas básicas:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx ufw fail2ban ca-certificates curl
```

Crie um usuário sem privilégios administrativos para a aplicação:

```bash
sudo adduser --system --group --home /opt/nodeapp nodeapp
sudo install -d -o nodeapp -g nodeapp /opt/nodeapp/app
```

Instale Node.js 20 LTS pelo repositório corporativo aprovado ou NodeSource; valide `node --version` e `npm --version`. Compile a release em CI com `npm ci && npm run build`; implante `dist/`, `package.json` e `package-lock.json` em `/opt/nodeapp/app`, instale dependências de runtime com `npm ci --omit=dev` e execute `npm start` sob systemd.

## 2. Endurecimento SSH

Antes de desconectar da sessão atual, abra uma segunda sessão administrativa e confirme que a nova configuração funciona. Configure chaves SSH para uma conta administrativa nominal e edite `/etc/ssh/sshd_config`:

```text
Port 22822
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Valide com `sudo sshd -t`, libere primeiro a porta em firewall/regras do provedor e só então aplique `sudo systemctl reload ssh`. Configure UFW permitindo SSH em `22822/tcp` e HTTPS em `8443/tcp`; não remova o acesso atual até validar a nova porta. Mantenha um procedimento de recuperação pelo console do provedor.

## 3. Segredos e serviço Node

Crie `/etc/nodeapp/api.env` com proprietário `root:nodeapp`, permissão `0640` e os valores de produção (`MONGO_URI`, `JWT_SECRET`, SMTP e URLs). Não copie `.env` para a imagem ou repositório. Restrinja no Atlas o acesso de rede e o usuário do banco ao mínimo necessário.

Exemplo de `/etc/systemd/system/nodeapp.service`:

```ini
[Unit]
Description=Sistema Salão API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=nodeapp
Group=nodeapp
WorkingDirectory=/opt/nodeapp/app
EnvironmentFile=/etc/nodeapp/api.env
ExecStart=/usr/bin/node /opt/nodeapp/app/dist/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectHome=true
UMask=0027

[Install]
WantedBy=multi-user.target
```

Após validar os caminhos e binário de Node, execute `sudo systemctl daemon-reload`, `sudo systemctl enable --now nodeapp` e confira `sudo systemctl status nodeapp` e `journalctl -u nodeapp`.

## 4. Nginx e HTTPS na porta 8443

Configure um certificado válido (por exemplo, ACME com validação adequada) e o Nginx para escutar em `8443 ssl`; libere essa porta externamente. Exemplo de bloco `server`:

```nginx
server {
    listen 8443 ssl http2;
    server_name api.seudominio.example;

    ssl_certificate /etc/letsencrypt/live/api.seudominio.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.seudominio.example/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 30s;
    }
}
```

Valide `sudo nginx -t` antes de recarregar. A porta interna `3000` deve aceitar tráfego apenas de loopback; não exponha MongoDB nem a porta Node na Internet. Defina `CORS_ORIGIN` com a origem explícita do aplicativo/cliente e `API_PUBLIC_URL=https://api.seudominio.example:8443`.

## 5. Operação segura

Habilite atualizações de segurança, monitore autenticações e reinícios, teste restauração de backup do MongoDB e rotacione credenciais. Configure `STAGING_URL` como variável de repositório/ambiente para habilitar DAST manual via GitHub Actions. O relatório Wapiti é um artefato de segurança e não deve conter credenciais reais.
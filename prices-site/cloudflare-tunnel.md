# Cloudflare Tunnel — supermercados-portugal.guessitgame.me

O site corre no **CT117** (`nourish`), partilhado com a app Nourish.
A API é local (`127.0.0.1:8787`); o nginx do vhost Preços faz proxy de `/nourish/`.

CT125 (`supermercados-portugal`) foi retirado. O IP antigo `192.168.1.127` ficou como
alias no CT117 (`prices-ip-alias.service`) para o hostname público do tunnel continuar a funcionar sem mudar a config remota do Cloudflare.

## Public Hostname (Zero Trust → tunnel CT105)

| Campo | Valor |
|-------|--------|
| Subdomain | `supermercados-portugal` |
| Domain | `guessitgame.me` |
| Type | HTTP |
| URL | `http://192.168.1.127:80` |

Preferência futura: apontar o tunnel para `http://192.168.1.27:80` (mesmo nginx; vhost por `Host`) e remover o alias `.127`.

## Access (opcional)

Application Cloudflare Access com domain `supermercados-portugal.guessitgame.me`, ou deixa público.

## Verificar na LAN

```bash
curl -s -H 'Host: supermercados-portugal.guessitgame.me' http://192.168.1.127/ | grep title
# → <title>Nourish Preços</title>

curl -s -H 'Host: supermercados-portugal.guessitgame.me' http://192.168.1.127/nourish/store-prices
```

Público: https://supermercados-portugal.guessitgame.me

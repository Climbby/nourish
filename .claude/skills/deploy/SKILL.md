---
name: deploy
description: Build the Nourish app and deploy dist/ to the Proxmox LXC running nginx
disable-model-invocation: true
---

Run the following steps in order. Stop and report the error if any step fails.

1. Run `npm run build` in the project root
2. Ask the user for the LXC IP if not known, then SCP dist/ to it:
   `scp -r dist/* root@<LXC-IP>:/var/www/html/`
3. Process nginx.conf and deploy it (envsubst replaces ${GROCY_API_KEY} with the real value):
   `GROCY_API_KEY=$(grep GROCY_API_KEY .env | cut -d= -f2) envsubst '$GROCY_API_KEY' < nginx.conf | ssh root@<LXC-IP> "cat > /etc/nginx/sites-available/nourish.conf && ln -sf /etc/nginx/sites-available/nourish.conf /etc/nginx/sites-enabled/nourish.conf"`
4. Reload nginx on the LXC:
   `ssh root@<LXC-IP> "nginx -t && nginx -s reload"`
5. Report success and the URL.

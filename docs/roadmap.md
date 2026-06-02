# Nourish roadmap

## Done
- Profile, IA, PWA, smart shopping (leave home → Grocy list)
- Lista de compras no app (Despensa)
- **Produto → historial** (`/product/:id`, apagar registos)
- Homelab: métricas visitas (`/nourish/metrics`), chegada ao super → lista no telemóvel (ver abaixo)

## Phase 3 — Supermarket automation (homelab)

1. `homelab/install-smart-shopping.sh` — atualiza servidor + scripts
2. Copiar `homelab/ha-packages/nourish-supermarket-metrics.yaml` para HA `packages/`
3. Importar `homelab/n8n/nourish-at-supermarket-import.json`, ativar, token HA
4. `HA_TOKEN=… ./homelab/deploy-ha-smart-shopping.sh` — leave home + eventos
5. Confirmar zona HA = `zone.auchan` (ou editar YAML)

**Comportamento:** entrar no super → ntfy/Companion com lista pendente; eventos alimentam mediana “dias entre compras” no Perfil.

## Phase 4 — Contas (Supabase)

Ver `docs/auth-plan.md`. Reutilizar projeto Supabase existente; não criar segundo projecto só para Nourish.

1. Google OAuth no projeto
2. `useAuth` + “Continuar só neste dispositivo”
3. Sync favourites + profile + targets

## Optional later
- Auto-update `input_number.nourish_days_until_shop` from metrics
- Discord bot (só se quiseres um painel único)
- Editar produto despensa no app

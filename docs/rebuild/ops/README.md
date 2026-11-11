# ops — deployment, rollback, backup, environment

Runbooks for operating the archive. Documentation only until the owner authorises the cutover; see
[../CUTOVER.md](../CUTOVER.md) for the readiness package, the open owner decisions, and the explicit
authorisation list (DNS switch, production migration, prod data writes).

| Doc | What it is |
|---|---|
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Every env var: layer, visibility, setter, failure mode, greenfield deltas |
| [DEPLOY.md](./DEPLOY.md) | Preconditions, preview/staging deploy, smoke checks, production promote + DNS switch |
| [ROLLBACK.md](./ROLLBACK.md) | Static hosting, data, media, auth/RLS rollback + the dry-run rehearsal script |
| [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) | What must be backed up, how, restore verification queries, owner-only actions |

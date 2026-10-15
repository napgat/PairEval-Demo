import { createBackup } from "./backup-core.mjs";
process.loadEnvFile(".env.local");
console.log(
  JSON.stringify({
    event: "database_backup",
    ...(await createBackup(
      process.env.PAIR_EVAL_BACKUP_DIRECTORY ?? ".verification/backups",
    )),
  }),
);

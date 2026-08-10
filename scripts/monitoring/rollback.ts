/**
 * scripts/monitoring/rollback.ts
 * Usage: npm run monitor:rollback -- --id <changeId> --reviewer "<name>" --reason "<reason>"
 *
 * Reverses a previously-approved change. Only works on an "approved"
 * change — see lib/monitoring/persistence.ts's rollbackChange() doc
 * comment for exactly what this does and doesn't touch.
 */
function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i]?.startsWith("--")) {
      const key = argv[i]!.slice(2);
      const value = argv[i + 1];
      if (value && !value.startsWith("--")) {
        args[key] = value;
        i++;
      }
    }
  }
  return args;
}

async function main() {
  const { rollbackChange } = await import("../../lib/monitoring/persistence");
  const args = parseArgs(process.argv.slice(2));

  if (!args.id || !args.reviewer || !args.reason) {
    console.error('Usage: npm run monitor:rollback -- --id <changeId> --reviewer "<name>" --reason "<reason>"');
    process.exit(1);
    return;
  }

  const result = rollbackChange({ changeId: args.id!, reviewer: args.reviewer!, reason: args.reason! });

  if (result.success) {
    console.log(`✅ Rolled back change ${args.id}.`);
    console.log(`   Field reverted to: ${JSON.stringify(result.updatedField?.value)}`);
    console.log(`   Status: pending_verification (no longer human-verified — the verified value was undone).`);
  } else {
    console.error(`❌ Rollback refused: ${result.reason}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Rollback failed:", err);
  process.exit(1);
});

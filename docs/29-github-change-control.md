# GitHub Change-Control Procedure

## Purpose

Prevent accidental overwrites, lost work, race conditions, and mixing of legacy/Production material with V2.

## Mandatory write protocol

1. Read repository metadata and current default branch.
2. Read the exact target path before every mutation.
3. If the target does not exist, use `create_file`.
4. If the target exists, use `update_file` with the SHA returned by the immediately preceding read.
5. Never call create on an existing path and never update without a current SHA.
6. Never perform two sequential writes to the same path in parallel.
7. For a multi-file change, prefer a branch + Git tree/commit workflow so the change is atomic at Git commit level.
8. Before creating the commit, re-read the current branch tip. If it moved, stop and rebase/rebuild the change from the new tip rather than force-updating.
9. Use `create_tree` with the current base tree when a change spans multiple files, then create one commit with the current parent SHA.
10. Move the branch only with a non-forced fast-forward update. Never force-push `main` for routine development.
11. After mutation, fetch the resulting commit and inspect its changed files.
12. Run or inspect CI/status checks before treating the change as validated.

## Branch policy

- `main`: stable integration baseline.
- `v2/*`: isolated implementation work.
- `legacy/*`: optional archival branches only; canonical legacy snapshots live under `legacy/` in the tree.
- Production Apps Script is never modified by repository operations.

## Conflict policy

A SHA conflict is a safety signal. Do not retry blindly. Re-read the file/branch, compare the new content with the intended patch, and apply the smallest safe update.

## Legacy immutability

`legacy/production` and `legacy/development` are audit snapshots. Changes require an explicit new snapshot/version; existing snapshots are never edited to make the audit pass.

## Validation gate

A change is not considered complete merely because GitHub accepted a commit. Completion requires:

- source/static validation;
- tests applicable to the change;
- repository tree verification;
- no unintended Production/legacy modifications;
- explicit record of known limitations.

## Recovery from a failed write

If a write returns an error such as `sha wasn't supplied`, do not retry the same request. Read the exact target path, obtain its current blob SHA, determine whether it is create or update, then perform the correct operation. If the branch tip changed, rebuild from that tip first.

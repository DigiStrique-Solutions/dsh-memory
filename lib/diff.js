/** Complete scalar/resource changes, bound to the same packages shown for approval. */
export function packageDiff(before, after) {
  const changes = []
  for (const key of ['name', 'description', 'applicability', 'content'])
    if (before?.[key] !== after[key])
      changes.push({ field: key, before: before?.[key] ?? null, after: after[key] })
  for (const key of new Set([
    ...Object.keys(before?.resources ?? {}),
    ...Object.keys(after.resources)
  ]))
    if (before?.resources?.[key] !== after.resources[key])
      changes.push({
        field: 'resources/' + key,
        before: before?.resources?.[key] ?? null,
        after: after.resources[key] ?? null
      })
  return changes
}

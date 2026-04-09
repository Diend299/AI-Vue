import type { TaskListItem } from '../api/aigc'

/** 从列表项中解析「提交时间」，用于排序与展示 */
export function getTaskSubmittedAt(row: TaskListItem): string | undefined {
  const raw =
    row.createdAt ??
    row.submitTime ??
    row.createdTime ??
    row.createTime ??
    (typeof row.created_at === 'string' ? row.created_at : undefined)
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined
}

export function getTaskTimeMs(row: TaskListItem): number {
  const raw = getTaskSubmittedAt(row)
  if (!raw) {
    return 0
  }
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : 0
}

export function sortTasksNewestFirst(rows: TaskListItem[]): TaskListItem[] {
  return [...rows].sort((a, b) => getTaskTimeMs(b) - getTaskTimeMs(a))
}

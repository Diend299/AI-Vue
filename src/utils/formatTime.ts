/**
 * 将时间格式化为「X 分钟前」等相对文案（中文）
 */
export function formatRelativeTime(input: string | number | Date | undefined | null): string {
  if (input == null || input === '') {
    return '时间未知'
  }
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) {
    return '时间未知'
  }
  const diffMs = Date.now() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 45) {
    return '刚刚'
  }
  if (sec < 3600) {
    const m = Math.max(1, Math.floor(sec / 60))
    return `${m} 分钟前`
  }
  if (sec < 86400) {
    const h = Math.max(1, Math.floor(sec / 3600))
    return `${h} 小时前`
  }
  if (sec < 86400 * 60) {
    const day = Math.max(1, Math.floor(sec / 86400))
    return `${day} 天前`
  }
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function formatAbsoluteTime(input: string | number | Date | undefined | null): string {
  if (input == null || input === '') {
    return ''
  }
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) {
    return ''
  }
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

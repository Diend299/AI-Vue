/**
 * 将接口返回的图片地址转为浏览器可直接请求的绝对 URL。
 *
 * 🚨 关键问题：前端开发服务器在 5173 端口，后端在 8080 端口
 * 当后端返回相对路径（如 /api/files/xxx.png）时，
 * 如果前端直接使用，会请求 http://localhost:5173/api/files/xxx.png（错误！）
 * 必须通过 resolveMediaUrl() 转换为 http://localhost:8080/api/files/xxx.png（正确！）
 *
 * 支持格式：
 * - 完整 URL: http://localhost:8080/api/files/xxx.png → 直接返回
 * - 相对路径: /api/files/xxx.png → http://localhost:8080/api/files/xxx.png
 * - 本地路径: D:/aip_storage/outputs/xxx.png → http://localhost:8080/api/files/xxx.png
 */
const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8080'

export function resolveMediaUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') {
    return ''
  }
  const u = url.trim()
  if (!u) {
    return ''
  }

  // 1. 如果已是完整 URL，直接返回
  if (/^https?:\/\//i.test(u)) {
    return u
  }

  // 2. 处理协议相对 URL
  if (u.startsWith('//')) {
    return `${window.location.protocol}${u}`
  }

  // 3. 🚨 关键修复：所有相对路径都必须指向后端服务器！
  // 无论是 /api/files/xxx.png 还是其他相对路径，都要加上 API_ORIGIN
  if (u.startsWith('/')) {
    return `${API_ORIGIN}${u}`
  }

  // 4. 处理本地路径 (D:/aip_storage/outputs/xxx.png → /api/files/xxx.png)
  if (/^[a-z]:[/\\]/i.test(u)) {
    const cleanPath = u.replace(/\\/g, '/').replace(/^[a-z]:[/]*aip_storage\/(?:outputs|inputs)\//i, '')
    return `${API_ORIGIN}/api/files/${cleanPath}`
  }

  // 5. 其他情况，作为相对路径处理
  return `${API_ORIGIN}/${u}`
}

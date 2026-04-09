# 前后端图片URL配置指南

## 后端配置文件

根据你提供的后端配置，资源映射规则如下：

```java
@Override
public void addResourceHandlers(ResourceHandlerRegistry registry) {
    registry.addResourceHandler("/api/files/**")
            .addResourceLocations("file:D:/aip_storage/outputs/")
            .addResourceLocations("file:D:/aip_storage/inputs/")
            .addResourceLocations("classpath:/static/")
            .setCacheControl(CacheControl.maxAge(1, TimeUnit.HOURS));
}
```

**关键点**：
- 前端访问 `http://localhost:8080/api/files/test.png` 
- 后端会映射到 `D:/aip_storage/outputs/test.png` 或 `D:/aip_storage/inputs/test.png`

## 前端配置

### 1. 环境变量 (.env.development)

```env
VITE_API_ORIGIN=http://localhost:8080
```

这个配置用于 `resolveMediaUrl()` 函数生成完整的 URL。

### 2. 图片 URL 处理 (utils/mediaUrl.ts)

已更新的 `resolveMediaUrl()` 函数支持多种格式：

| 后端返回格式 | 示例 | 前端处理结果 |
|-------------|------|------------|
| 本地路径 | `D:/aip_storage/outputs/img.png` | `http://localhost:8080/api/files/img.png` |
| 本地路径（反斜杠） | `D:\aip_storage\outputs\img.png` | `http://localhost:8080/api/files/img.png` |
| 相对路径 | `/api/files/img.png` | `http://localhost:8080/api/files/img.png` |
| 完整 URL | `http://localhost:8080/api/files/img.png` | `http://localhost:8080/api/files/img.png` |

### 3. 社区页面数据映射 (views/Community.vue)

```typescript
// 如果后端返回的字段是 imageUrl
const newList = res.data.list.map(post => ({
  ...post,
  imageUrl: post.imageUrl || post.resultUrl || '',
}))
```

**支持的后端字段**：
- `imageUrl` - 优先使用
- `resultUrl` - 备用字段

## 后端 API 返回格式建议

### 方案 A：返回本地路径（推荐，前端自动转换）

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 1,
        "imageUrl": "D:/aip_storage/outputs/xxxx-1234.png",
        "title": "示例图片",
        "authorName": "张三",
        "likeCount": 10,
        "isLiked": false,
        "width": 512,
        "height": 512
      }
    ],
    "total": 100
  }
}
```

**优点**：
- 后端只需返回本地路径
- 前端自动识别并转换为 `/api/files/xxxx-1234.png`
- 不依赖文件名规律

### 方案 B：返回相对路径

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 1,
        "imageUrl": "/api/files/xxxx-1234.png",
        "title": "示例图片",
        "authorName": "张三",
        "likeCount": 10,
        "isLiked": false,
        "width": 512,
        "height": 512
      }
    ],
    "total": 100
  }
}
```

**优点**：
- 明确指示资源位置
- 前端直接使用

### 方案 C：返回完整 URL

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 1,
        "imageUrl": "http://localhost:8080/api/files/xxxx-1234.png",
        "title": "示例图片",
        "authorName": "张三",
        "likeCount": 10,
        "isLiked": false,
        "width": 512,
        "height": 512
      }
    ],
    "total": 100
  }
}
```

**优点**：
- 最灵活，支持跨域/CDN
- 前端直接使用

## 测试步骤

1. **检查后端输出目录**：
   - 确保 `D:/aip_storage/outputs/` 目录存在
   - 放入测试图片，如 `D:/aip_storage/outputs/test.png`

2. **测试 API 调用**：
   ```bash
   curl http://localhost:8080/api/community/list?page=1&pageSize=20
   ```
   确保返回的 `imageUrl` 字段格式正确

3. **前端验证**：
   - 访问社区广场页面
   - 打开浏览器开发者工具 → Network
   - 检查图片请求是否发往 `http://localhost:8080/api/files/...`
   - 确认返回状态码为 200，图片正确加载

## 常见问题

### Q: 图片仍然无法加载？
A: 检查以下几点：
1. 确认后端 `/api/files/**` 映射配置已生效
2. 确认文件确实存在于 `D:/aip_storage/outputs/` 目录
3. 检查文件权限（Windows 环境）
4. 在浏览器中直接访问 `http://localhost:8080/api/files/test.png` 测试

### Q: 不同的后端返回不同的路径格式怎么办？
A: `resolveMediaUrl()` 函数已支持所有常见格式的自动转换，无需改动。

### Q: 生产环境如何配置？
A: 修改 `.env.production` 中 `VITE_API_ORIGIN` 为实际的生产 API 地址。

## 生产部署建议

1. **如果使用 Nginx 反向代理**：
```nginx
location /api/files/ {
    alias D:/aip_storage/outputs/;
    expires 1h;
    add_header Cache-Control "public, max-age=3600";
}
```

2. **如果使用 CDN**：
- 将 `VITE_API_ORIGIN` 指向 CDN 域名
- CDN 源站指向后端服务器

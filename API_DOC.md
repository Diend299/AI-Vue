
---
# 🚀 AIGC 工业化管线 - 后端 API 说明文档 (v1.0)

**文档状态**：Draft (适用于 Vue 3 前端对接)
**Base URL**: `http://localhost:8080`
**数据格式**: `Content-Type: application/json` (除文件上传外)

---

## 1. 通用响应格式 (Standard Result)
所有接口统一返回以下 JSON 结构：

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `code` | Integer | 状态码 (200:成功, 500:业务异常, 401:未授权) |
| `msg` | String | 提示信息 |
| `data` | T | 业务数据 (泛型) |

---

## 2. 用户模块 (Auth)

### 2.1 用户注册与安全校验
*   **URL**: `/api/gateway/register`
*   **Method**: `POST`
*   **功能**: 创建用户并进行参数合法性正则校验（符合网关安检要求）。

**请求参数 (JSON)**:
| 参数名 | 必选 | 说明 |
| :--- | :--- | :--- |
| `username` | 是 | 不能以数字开头，仅限字母数字下划线 |
| `password` | 是 | 长度必须 > 6位 |
| `email` | 是 | 合法的邮箱格式 |
| `age` | 是 | 18 - 100 整数 |

---

### 2.2 用户登录
*   **URL**: `/api/gateway/login`
*   **Method**: `POST`
*   **功能**: 用户名密码登录，登录成功后返回用户标识与可选 token。

**请求参数 (JSON)**:
| 参数名 | 必选 | 说明 |
| :--- | :--- | :--- |
| `username` | 是 | 登录用户名 |
| `password` | 是 | 登录密码 |

**返回示例 (成功)**:
```json
{
  "code": 200,
  "msg": "操作成功",
  "data": {
    "userId": 1,
    "id": 1,
    "token": "mock-token-1-1712194763000"
  }
}
```

**返回说明**:
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `data.userId` | Long | 前端可直接作为登录用户 ID 使用 |
| `data.id` | Long | 与 `userId` 同值，兼容不同前端解析方式 |
| `data.token` | String | 可选字段，当前为占位 token（非 JWT） |

**失败示例**:
```json
{
  "code": 500,
  "msg": "用户名或密码错误",
  "data": null
}
```

---

## 3. 任务模块 (AIGC Task)

### 3.1 异步生图任务提交
*   **URL**: `/api/task/submit`
*   **Method**: `POST`
*   **Content-Type**: `multipart/form-data`
*   **注意**: 由于后端采用 **WebFlux (Netty)** 响应式架构，请确保前端使用 `FormData` 异步流式上传。

**请求参数 (Form-Data)**:
| 参数名 | 类型 | 必选 | 说明 |
| :--- | :--- | :--- | :--- |
| `userId` | Long | 是 | 当前登录用户 ID |
| `prompt` | String | 是 | 提示词 (如: 1girl, yinlin...) |
| `image` | File | 是 | 动作参考图 (.png/.jpg) |
| `modelType` | String | 否 | 模型类型 (如: "SDXL", "FLUX"), 默认 "SDXL" |
| `isUseLLM` | Boolean | 否 | 是否使用 LLM 增强提示词，默认 `false` |

**返回示例**:
```json
{
  "code": 200,
  "msg": "任务已受理，进入排队队列",
  "data": "a8f2b1c3" // 返回 taskId 用于后续轮询
}
```

---

### 3.2 任务状态与进度查询 (Polling)
*   **URL**: `/api/task/status/{taskId}`
*   **Method**: `GET`
*   **功能**: 前端通过此接口实现进度条显示。

**返回数据说明 (`data` 结构)**:
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `status` | String | PENDING(排队), PROCESSING(生成中), DONE(完成), ERROR(失败) |
| `progress` | Float | 0.0 - 1.0 (可选，由 Worker 实时回写 Redis) |
| `resultUrl` | String | 结果图片的访问地址 (仅当 status 为 DONE) |
| `errorMsg` | String | 错误详细信息 (仅当 status 为 ERROR) |

---

### 3.3 个人任务历史记录
*   **URL**: `/api/task/list`
*   **Method**: `GET`
*   **功能**: 返回**当前用户**的任务列表，用于前端展示「我的创作记录」；**不得**返回其他用户的任务。

**请求参数 (Query String)**:
| 参数名 | 必选 | 说明 |
| :--- | :--- | :--- |
| `userId` | 是 | 当前登录用户 ID（与登录态一致；见下文「后端需求」：建议改为服务端从 Token 解析，忽略或校验该参数） |
| `sortOrder` | 否 | 建议：`desc`（默认，按提交时间新→旧）或 `asc`（旧→新）。未实现时前端会按 `createdAt` 本地排序。 |

**返回 `data` 类型**: `Array<object>`，**每条记录建议包含**（字段名推荐统一为驼峰，与下表一致；若使用下划线，前端需另行对齐）：

| 字段 | 类型 | 必选 | 说明 |
| :--- | :--- | :--- | :--- |
| `taskId` | String | 建议 | 内部任务 ID，**仅供轮询与调试**；当前 Vue 端**不在列表 UI 展示** |
| `prompt` | String | 建议 | 用户提交的提示词 |
| `status` | String | 是 | `PENDING` / `PROCESSING` / `DONE` / `ERROR` |
| `progress` | Float | 否 | 0.0 - 1.0 |
| `resultUrl` | String | 条件 | 完成时可访问的**结果图 URL**；可为绝对地址，或**以 `/` 开头的相对路径**（前端会用 `VITE_API_ORIGIN` 或默认 `http://localhost:8080` 拼接） |
| `createdAt` | String | **强烈建议** | 任务提交时间，**ISO-8601**（如 `2026-04-03T14:30:00+08:00`）或可 `Date` 解析的字符串；用于排序与「X 分钟前」展示 |

**返回示例**:
```json
{
  "code": 200,
  "msg": "操作成功",
  "data": [
    {
      "taskId": "a8f2b1c3",
      "prompt": "1girl, cinematic",
      "status": "DONE",
      "progress": 1.0,
      "resultUrl": "/static/results/a8f2b1c3.png",
      "createdAt": "2026-04-03T14:30:00+08:00"
    }
  ]
}
```

**说明**:
*   列表默认按 **`createdAt` 降序**（最新在前），与前端「由近到远」一致。
*   `resultUrl` 若为相对路径，需保证网关/静态资源服务对浏览器**可直接 GET**（必要时配置 CORS、或同源部署）。

---

## 5. MySQL 表结构与索引建议（给 DBA / 后端）

以下面向「任务表」常见设计（表名示例 `aigc_task`），字段名可按项目统一风格（驼峰映射到列名 `user_id`、`created_at` 等）。

**推荐核心字段**

| 列名（示例） | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | BIGINT PK AUTO_INCREMENT | 主键（可选与业务 `task_id` 二选一或并存） |
| `task_id` | VARCHAR(64) UNIQUE NOT NULL | 对外/轮询使用的任务 ID |
| `user_id` | BIGINT NOT NULL | 提交用户，与账号表主键对应 |
| `prompt` | TEXT | 提示词 |
| `status` | VARCHAR(32) NOT NULL | 任务状态枚举 |
| `progress` | DOUBLE | 可选 |
| `input_image_path` | VARCHAR(512) | 用户上传参考图存储路径（对象存储 key 或本地路径） |
| `result_image_path` | VARCHAR(512) | 生成结果图路径；接口中的 `resultUrl` 可由该路径映射为 HTTP 路径 |
| `error_msg` | TEXT | 失败信息 |
| `created_at` | DATETIME(3) NOT NULL | **提交时间**（列表排序、展示「X 分钟前」依赖此字段） |
| `updated_at` | DATETIME(3) | 最后更新时间 |

**索引建议（查询「某用户自己的任务列表、按时间新→旧」）**

1. **必选**：复合索引 **`(user_id, created_at DESC)`**  
   - 覆盖：`WHERE user_id = ? ORDER BY created_at DESC`  
   - **不要**对 `image_path` 单独建索引用于「按用户查列表」——路径检索不是典型查询模式；`image_path`/`result_image_path` 若需唯一可查文件，可用 `task_id` 或主键关联即可。

2. **可选**：`task_id` **唯一索引**（若 `task_id` 已 UNIQUE 则已覆盖），便于 `WHERE task_id = ?` 单条查询。

3. **一般不需要**：单独给 `result_image_path` 建 B-Tree 索引，除非有「按路径反查任务」的管理端需求。

**数据隔离**：所有 `/api/task/list` 与后续鉴权接口在 SQL 层必须带 **`user_id` = 当前登录用户**，避免水平越权。

---

## 6. 后端与数据库对接需求（清单）

| 序号 | 需求 | 说明 |
| :--- | :--- | :--- |
| B1 | **列表数据完整性** | `GET /api/task/list` 每条记录必须带 **`createdAt`（或约定字段名）**，否则前端无法排序与展示相对时间。 |
| B2 | **结果图可访问** | Worker 写入 `result_image_path` 后，对外暴露的 `resultUrl` 必须浏览器可访问；若为相对路径，需与前端 `VITE_API_ORIGIN`（默认 8080）一致。 |
| B3 | **鉴权** | 生产环境应：**从 Authorization / Session 解析 userId**，与请求中的资源归属校验；禁止仅信任 Query 中的 `userId`。 |
| B4 | **排序** | 数据库查询使用 **`ORDER BY created_at DESC`**，与索引 `(user_id, created_at)` 配合；可选支持 Query 参数 `sortOrder`。 |
| B5 | **静态资源** | 若图片走 Nginx/OSS，需正确 `Content-Type`、缓存策略；跨域时配置 CORS 或前端同源代理。 |

**前端环境变量（可选）**

*   `VITE_API_ORIGIN`：当 `resultUrl` 为相对路径时，用于拼接完整图片地址；未设置时默认为 `http://localhost:8080`。

---

## 7. 内部回调模块 (Internal - Frontend 禁用)

### 7.1 Worker 状态同步接口
*   **URL**: `/internal/task/update`
*   **Method**: `POST`
*   **说明**: 仅供 Python Worker 在生图结束时调用，用于将结果从算力节点同步回 MySQL。

---

### 💡 G老师的“避坑”技术贴

1.  **关于跨域 (CORS)**:
    Vue 运行在 `5173`，后端在 `8080`。你需要在 Spring Boot 配置类里加上全局跨域允许，否则 Vue 会报 `CORS Error`。

2.  **关于文件大小限制**:
    Spring Boot 默认限制上传文件为 1MB。你的 AI 参考图可能很大，记得在 `application.yml` 里调大：
    ```yaml
    spring:
      servlet:
        multipart:
          max-file-size: 10MB
          max-request-size: 10MB
    ```

3.  **对齐字段名**:
    前端 `axios` 发请求时，`FormData` 里的 key（如 `userId`）必须和 Java DTO 里的属性名**一模一样**（大小写敏感）。

4.  **LLM 提示词增强配置**:
    你可以在 `application.yml` 中配置 LLM API 密钥、URL 以及不同模型（FLUX, SDXL）的系统提示词，以实现灵活的提示词增强逻辑。
    ```yaml
    llm:
      api:
        key: ${DEEPSEEK_API_KEY:sk-YOUR_DEEPSEEK_API_KEY}
        url: https://api.deepseek.com/chat/completions
      prompts:
        flux-system: "You are an expert prompt engineer for FLUX.1. ... (详见代码注释)"
        sdxl-system: "You are an expert prompt engineer for SDXL. ... (详见代码注释)"
    ```

---



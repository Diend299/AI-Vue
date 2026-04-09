# AIGC Portal - AI 创作平台

基于 Vue 3 + TypeScript + Vite 的 AI 生成内容 (AIGC) 前端门户，提供用户注册登录、异步生图任务提交、进度跟踪和历史记录查看功能。

## 🚀 功能特性

- **用户认证**: 支持用户注册和登录，基于 JWT Token 的会话管理
- **异步生图**: 上传参考图和提示词，提交异步生成任务
- **任务管理**: 实时进度跟踪、任务历史记录查看
- **响应式设计**: 基于 Element Plus 的现代化 UI 界面
- **状态管理**: 使用 Pinia 进行全局状态管理

## 🛠️ 技术栈

- **前端框架**: Vue 3 (Composition API)
- **开发工具**: Vite
- **类型检查**: TypeScript
- **UI 组件库**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router 4
- **HTTP 客户端**: Axios
- **样式**: CSS 变量 + Element Plus 主题

## 📦 安装与运行

### 环境要求

- Node.js >= 16
- pnpm (推荐) 或 npm

### 安装依赖

```bash
pnpm install
```

### 开发环境运行

```bash
pnpm run dev
```

### 构建生产版本

```bash
pnpm run build
```

### 预览构建结果

```bash
pnpm run preview
```

## 📁 项目结构

```
src/
├── api/                 # API 接口定义
│   ├── aigc.ts         # AIGC 相关接口 (注册、任务提交等)
│   └── auth.ts         # 认证相关接口 (登录)
├── assets/             # 静态资源
├── components/         # 可复用组件
├── router/             # 路由配置
│   └── index.ts        # 路由定义和守卫
├── stores/             # Pinia 状态管理
│   └── auth.ts         # 用户认证状态
├── utils/              # 工具函数
│   ├── request.ts      # Axios 请求封装
│   ├── taskList.ts     # 任务列表处理工具
│   ├── formatTime.ts   # 时间格式化
│   └── mediaUrl.ts     # 媒体 URL 处理
├── views/              # 页面组件
│   ├── Home.vue        # 首页
│   ├── Login.vue       # 登录页
│   ├── Register.vue    # 注册页
│   └── Studio.vue      # 创作工作台
├── App.vue             # 根组件
├── main.ts             # 应用入口
└── style.css           # 全局样式
```

## 🔧 配置说明

### 环境变量

项目使用 Vite 的环境变量配置，API 基础 URL 通过 `vite.config.ts` 中的代理配置。

### 路由配置

- `/`: 首页
- `/login`: 登录页
- `/register`: 注册页
- `/studio`: 创作工作台 (需要登录)
- `/dashboard`: 重定向到 `/studio`

路由守卫会自动检查用户登录状态，未登录用户访问需要认证的页面会被重定向到登录页。

### API 配置

- 基础 URL: `/api` (通过 Vite 代理转发到后端)
- 请求超时: 10秒
- 自动添加 Authorization 头 (登录后)

## 📚 API 文档

详细的 API 接口文档请参考 [API_DOC.md](./API_DOC.md)

主要接口包括：
- 用户注册: `POST /api/gateway/register`
- 用户登录: `POST /api/gateway/login`
- 任务提交: `POST /api/task/submit` (FormData)

## 🎨 组件说明

### 页面组件

#### Home.vue
首页组件，包含：
- 导航栏 (品牌展示、登录/注册按钮)
- 英雄区域 (功能介绍、CTA 按钮)
- 特性介绍区域

#### Login.vue
登录页面：
- 用户名密码表单
- 登录状态反馈
- 跳转注册链接

#### Register.vue
注册页面：
- 用户注册表单 (用户名、密码、邮箱、年龄)
- 表单验证
- 跳转登录链接

#### Studio.vue
创作工作台：
- 任务提交表单 (提示词 + 文件上传)
- 当前任务进度显示
- 任务历史列表
- 结果图片预览

### 工具函数

#### request.ts
Axios 实例配置：
- 基础 URL 设置
- 请求/响应拦截器
- 自动错误处理

#### taskList.ts
任务列表处理：
- 时间字段解析
- 任务排序 (最新优先)

#### formatTime.ts
时间格式化工具

#### mediaUrl.ts
媒体资源 URL 处理

## 🔐 状态管理

使用 Pinia 进行状态管理，主要状态：

### Auth Store
- `token`: JWT Token
- `userId`: 用户 ID
- `isLoggedIn`: 登录状态计算属性
- `userIdNumber`: 用户 ID 数字格式
- `setSession()`: 设置登录会话
- `logout()`: 退出登录

状态持久化到 localStorage。

## 🎯 开发指南

### 代码规范

- 使用 TypeScript 进行类型检查
- 遵循 Vue 3 Composition API 最佳实践
- 使用 ESLint + Prettier 进行代码格式化

### 提交规范

- feat: 新功能
- fix: 修复 bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 代码重构
- test: 测试相关
- chore: 构建过程或工具配置更新

## 📄 许可证

MIT License

<template>
  <div class="page">
    <div class="bg-glow glow-1" />
    <div class="bg-glow glow-2" />

    <div class="shell">
      <header class="head">
        <el-button text class="back" @click="$router.push('/')">
          <span class="back-icon">←</span> 返回首页
        </el-button>
        <h1>登录</h1>
        <p>使用已注册的账号登录，进入生图工作台。</p>
      </header>

      <el-card class="card">
        <el-form label-position="top" :model="form">
          <el-form-item label="用户名">
            <el-input v-model="form.username" autocomplete="username" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.password" type="password" show-password autocomplete="current-password" />
          </el-form-item>
          <el-button type="primary" :loading="loading" style="width: 100%" @click="handleLogin">登录</el-button>
        </el-form>
        <p class="hint">
          还没有账号？
          <el-button link type="primary" @click="$router.push('/register')">去注册</el-button>
        </p>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { loginApi, type LoginData } from '../api/auth'
import type { ApiResult } from '../api/aigc'
import { useAuthStore } from '../stores/auth'

const form = reactive({ username: '', password: '' })
const loading = ref(false)
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

function ensureSuccess<T>(res: ApiResult<T>) {
  if (res.code !== 200) {
    throw new Error(res.msg || '登录失败')
  }
  return res.data
}

function applyLoginData(data: LoginData) {
  const uid = data.userId ?? data.id
  if (uid == null || Number.isNaN(Number(uid))) {
    throw new Error('登录返回缺少用户 ID，请与后端确认 data 字段（userId 或 id）')
  }
  const token = data.token?.trim() ? data.token : 'session'
  authStore.setSession({ token, userId: uid })
}

async function handleLogin() {
  loading.value = true
  try {
    const res = await loginApi(form)
    const data = ensureSuccess(res)
    applyLoginData(data)
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    router.push(redirect && redirect.startsWith('/') ? redirect : '/studio')
  } catch (e: unknown) {
    ElMessage.error(e instanceof Error ? e.message : '登录失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (route.query.registered === '1') {
    ElMessage.info('注册成功，请登录')
  }
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  padding: 24px;
  color: #eef3ff;
  background:
    radial-gradient(circle at 20% 20%, rgba(115, 93, 255, 0.22), transparent 36%),
    radial-gradient(circle at 80% 0%, rgba(42, 227, 191, 0.15), transparent 30%),
    #0a1020;
}

.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  pointer-events: none;
}

.glow-1 {
  width: 320px;
  height: 320px;
  background: rgba(89, 146, 255, 0.22);
  top: -80px;
  right: -100px;
}

.glow-2 {
  width: 280px;
  height: 280px;
  background: rgba(148, 76, 255, 0.18);
  left: -80px;
  bottom: -100px;
}

.shell {
  position: relative;
  z-index: 1;
  max-width: 440px;
  margin: 0 auto;
}

.head {
  margin-bottom: 20px;
}

.back {
  color: rgba(238, 243, 255, 0.75);
  padding-left: 0;
}

.back-icon {
  margin-right: 4px;
}

.head h1 {
  margin: 12px 0 8px;
  font-size: 28px;
}

.head p {
  margin: 0;
  font-size: 14px;
  color: rgba(238, 243, 255, 0.7);
  line-height: 1.5;
}

.card {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
}

.card :deep(.el-card__body) {
  padding: 28px;
}

.card :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.92);
}

.hint {
  margin: 16px 0 0;
  text-align: center;
  font-size: 14px;
  color: rgba(238, 243, 255, 0.65);
}
</style>

<template>
  <div class="page">
    <div class="bg-glow glow-1" />
    <div class="bg-glow glow-2" />

    <div class="shell">
      <header class="head">
        <el-button text class="back" @click="$router.push('/')">
          <span class="back-icon">←</span> 返回首页
        </el-button>
        <h1>创建账号</h1>
        <p>填写信息完成注册，然后使用账号登录进入工作台。</p>
      </header>

      <el-card class="card">
        <el-form label-position="top" :model="form">
          <el-form-item label="用户名">
            <el-input v-model="form.username" placeholder="字母/数字/下划线，不能数字开头" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.password" type="password" show-password placeholder="长度大于 6 位" />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="form.email" placeholder="example@demo.com" />
          </el-form-item>
          <el-form-item label="年龄">
            <el-input-number v-model="form.age" :min="18" :max="100" :step="1" style="width: 100%" />
          </el-form-item>
          <el-button type="primary" :loading="loading" style="width: 100%" @click="submit">注册</el-button>
        </el-form>
        <p class="hint">
          已有账号？
          <el-button link type="primary" @click="$router.push('/login')">去登录</el-button>
        </p>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { registerApi, type ApiResult } from '../api/aigc'

const router = useRouter()
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
  email: '',
  age: 18
})

function ensureSuccess<T>(res: ApiResult<T>) {
  if (res.code !== 200) {
    throw new Error(res.msg || '请求失败')
  }
  return res.data
}

async function submit() {
  loading.value = true
  try {
    const res = await registerApi(form)
    ensureSuccess(res)
    ElMessage.success('注册成功，请登录')
    router.push({ path: '/login', query: { registered: '1' } })
  } catch (e: unknown) {
    ElMessage.error(e instanceof Error ? e.message : '注册失败')
  } finally {
    loading.value = false
  }
}
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

.card :deep(.el-input__wrapper),
.card :deep(.el-input-number .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.92);
}

.hint {
  margin: 16px 0 0;
  text-align: center;
  font-size: 14px;
  color: rgba(238, 243, 255, 0.65);
}
</style>

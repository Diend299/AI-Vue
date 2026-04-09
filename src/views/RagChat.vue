<template>
  <div class="page">
    <div class="bg-glow glow-1" />
    <div class="bg-glow glow-2" />

    <header class="top">
      <div class="brand">
        <span class="logo">AIGC</span>
        <span class="title">RAG 对话</span>
      </div>
      <div class="user">
        <el-button text type="primary" @click="$router.push('/studio')">创作工作台</el-button>
        <el-button text type="primary" @click="$router.push('/')">首页</el-button>
        <el-button round @click="handleLogout">退出登录</el-button>
      </div>
    </header>

    <section class="placeholder-card">
      <el-card>
        <div class="placeholder-header">RAG 对话模块占位页面</div>
        <p class="placeholder-text">
          当前为简易占位页面，后续会在此扩展检索增强生成式对话。
          包含对话历史、知识检索、向量查询等并列于创作工作台的功能入口。
        </p>
        <el-button type="primary" @click="$router.push('/studio')">返回创作工作台</el-button>
      </el-card>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

function handleLogout() {
  auth.logout()
  router.push('/')
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 20px 28px 32px;
  position: relative;
  overflow: hidden;
  color: #eef3ff;
  background:
    radial-gradient(circle at 20% 20%, rgba(115, 93, 255, 0.25), transparent 35%),
    radial-gradient(circle at 80% 0%, rgba(42, 227, 191, 0.2), transparent 30%),
    #0a1020;
}

.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  pointer-events: none;
}

.glow-1 {
  width: 340px;
  height: 340px;
  background: rgba(89, 146, 255, 0.25);
  top: -80px;
  right: -120px;
}

.glow-2 {
  width: 300px;
  height: 300px;
  background: rgba(148, 76, 255, 0.2);
  left: -90px;
  bottom: -120px;
}

.top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.logo {
  font-weight: 800;
  font-size: 20px;
  background: linear-gradient(120deg, #9ecbff, #c4a8ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.title {
  font-size: 16px;
  color: rgba(238, 243, 255, 0.85);
}

.user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.placeholder-card {
  position: relative;
  z-index: 1;
  max-width: 760px;
  margin: 40px auto 0;
}

.placeholder-header {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 12px;
}

.placeholder-text {
  margin-bottom: 24px;
  color: rgba(238, 243, 255, 0.76);
  line-height: 1.8;
}
</style>

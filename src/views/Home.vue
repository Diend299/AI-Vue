<template>
  <div class="home">
    <div class="bg-glow glow-1" />
    <div class="bg-glow glow-2" />

    <header class="nav">
      <div class="brand">
        <span class="logo">AIGC</span>
        <span class="name">Open Studio</span>
      </div>
      <div class="actions">
        <template v-if="auth.isLoggedIn">
          <el-button round @click="$router.push('/community')">社区广场</el-button>
          <el-button type="primary" round @click="goStudio">进入工作台</el-button>
          <el-button round @click="handleLogout">退出</el-button>
        </template>
        <template v-else>
          <el-button round @click="$router.push('/community')">社区广场</el-button>
          <el-button round @click="$router.push('/login')">登录</el-button>
          <el-button type="primary" round @click="$router.push('/register')">注册账号</el-button>
        </template>
      </div>
    </header>

    <section class="hero">
      <p class="badge">工业化管线 · 异步生图</p>
      <h1>用提示词与参考图，<br />快速生成你的画面</h1>
      <p class="sub">
        注册并登录后，进入工作台提交任务、查看进度与历史记录。界面灵感参考社区型 AI 创作站点的沉浸感布局。
      </p>
      <div class="cta">
        <template v-if="auth.isLoggedIn">
          <el-button type="primary" size="large" round @click="goStudio">进入创作工作台</el-button>
          <el-button size="large" round @click="$router.push('/community')">社区广场</el-button>
        </template>
        <template v-else>
          <el-button type="primary" size="large" round @click="$router.push('/register')">免费注册</el-button>
          <el-button size="large" round @click="$router.push('/community')">社区广场</el-button>
          <el-button size="large" round @click="$router.push('/login')">已有账号登录</el-button>
        </template>
      </div>
    </section>

    <section class="features">
      <article class="feat">
        <h3>异步队列</h3>
        <p>任务受理后轮询状态，进度一目了然。</p>
      </article>
      <article class="feat">
        <h3>参考图驱动</h3>
        <p>上传 PNG / JPG，与 Prompt 一起提交。</p>
      </article>
      <article class="feat">
        <h3>个人历史</h3>
        <p>按用户维度查看过往任务与结果链接。</p>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

function goStudio() {
  router.push('/studio')
}

function handleLogout() {
  auth.logout()
  router.push('/')
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  padding: 24px 28px 48px;
  color: #eef3ff;
  background:
    radial-gradient(circle at 15% 15%, rgba(115, 93, 255, 0.28), transparent 38%),
    radial-gradient(circle at 85% 10%, rgba(42, 227, 191, 0.18), transparent 32%),
    #070b14;
}

.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}

.glow-1 {
  width: 420px;
  height: 420px;
  background: rgba(89, 146, 255, 0.22);
  top: -120px;
  right: -100px;
}

.glow-2 {
  width: 360px;
  height: 360px;
  background: rgba(200, 120, 255, 0.15);
  left: -120px;
  bottom: -80px;
}

.nav {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1100px;
  margin: 0 auto 48px;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.logo {
  font-weight: 800;
  font-size: 22px;
  letter-spacing: 0.06em;
  background: linear-gradient(120deg, #9ecbff, #c4a8ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.name {
  font-size: 15px;
  color: rgba(238, 243, 255, 0.65);
}

.actions {
  display: flex;
  gap: 10px;
}

.hero {
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin: 0 auto;
  text-align: center;
}

.badge {
  display: inline-block;
  margin: 0 0 16px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: rgba(180, 210, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

.hero h1 {
  margin: 0 0 16px;
  font-size: clamp(28px, 5vw, 44px);
  line-height: 1.15;
  font-weight: 700;
}

.sub {
  margin: 0 auto 28px;
  max-width: 520px;
  font-size: 15px;
  line-height: 1.7;
  color: rgba(238, 243, 255, 0.72);
}

.cta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.features {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  max-width: 1000px;
  margin: 56px auto 0;
}

.feat {
  padding: 20px 22px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(10px);
}

.feat h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #f0f4ff;
}

.feat p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(238, 243, 255, 0.65);
}

@media (max-width: 820px) {
  .features {
    grid-template-columns: 1fr;
  }
}
</style>

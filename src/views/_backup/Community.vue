<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount, reactive, computed } from 'vue'
import { ElMessage, ElScrollbar } from 'element-plus' // 显式引入 ElScrollbar
import { Star, StarFilled, Upload } from '@element-plus/icons-vue'
import { getCommunityListApi, likePostApi, type CommunityPost, type BackendCommunityPost } from '../api/community'
import { getTaskListApi, getTaskStatusApi, submitTaskApi, type ApiResult, type TaskListItem, type TaskStatusData } from '../api/aigc'
import type { ApiResult as ApiResult2 } from '../api/aigc'
import { useAuthStore } from '../stores/auth'
import { resolveMediaUrl } from '../utils/mediaUrl'
import { formatAbsoluteTime, formatRelativeTime } from '../utils/formatTime'
import { getTaskSubmittedAt, getTaskTimeMs, sortTasksNewestFirst } from '../utils/taskList'
import { useRouter } from 'vue-router'

// 状态管理
const posts = ref<CommunityPost[]>([])
const loading = ref(false)
const page = ref(1)
const noMore = ref(false)
const gridRef = ref<HTMLElement | null>(null)
const infiniteScrollDistance = 200 // 距离底部多少像素时触发加载
const router = useRouter()
const activeTab = ref('community')

// Studio 相关状态
const auth = useAuthStore()
const submitLoading = ref(false)
const prompt = ref('')
const selectedFile = ref<File | null>(null)
const selectedFileName = ref('')
const referencePreviewUrl = ref('')
const modelType = ref<'SDXL' | 'FLUX'>('SDXL')
const isUseLLM = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const taskId = ref('')
const taskStatus = reactive<TaskStatusData>({
  status: 'PENDING',
  progress: 0
})
const historyList = ref<TaskListItem[]>([])

/** 每分钟刷新一次相对时间文案 */
const nowTick = ref(0)
let pollTimer: number | null = null
let timeTickTimer: number | null = null

const displayTasks = computed(() => {
  void nowTick.value
  return sortTasksNewestFirst(historyList.value)
})

// 🚀 核心修复：手动处理滚动事件，替代v-infinite-scroll指令
const handleScroll = ({ scrollTop }: { scrollTop: number; scrollLeft: number }) => {
  const scrollbar = document.querySelector('.community-scrollbar .el-scrollbar__wrap') as HTMLElement
  if (!scrollbar) return
  
  const { scrollHeight, clientHeight } = scrollbar
  const distanceToBottom = scrollHeight - scrollTop - clientHeight
  
  // 当距离底部小于指定距离时，触发加载
  if (distanceToBottom < infiniteScrollDistance && !loading.value && !noMore.value) {
    loadData()
  }
}

// 加载数据
const loadData = async () => {
  if (loading.value || noMore.value) return
  loading.value = true
  try {
    const res: ApiResult<{ records: BackendCommunityPost[], total: number }> = await getCommunityListApi({ page: page.value, pageSize: 20 })
    if (res.code === 200) {
      const newList: CommunityPost[] = res.data.records.map((record: BackendCommunityPost) => ({
        // 映射后端字段到前端接口
        id: record.taskId,
        imageUrl: record.resultUrl || '',
        title: record.prompt ? String(record.prompt).substring(0, 50) + '...' : '无标题',
        authorName: record.username,
        authorAvatar: undefined, // 后端暂无头像字段
        totalLikes: record.totalLikes || 0,
        isLiked: record.isLiked || false,
        width: 512, // 默认图片尺寸
        height: 512,
        createTime: record.createTime
      }))

      posts.value.push(...newList)

      if (newList.length < 20) {
        noMore.value = true
      } else {
        page.value++
      }
      
      // 数据加载后重新计算布局
      nextTick(() => {
        resizeAllGridItems()
      })
    }
  } catch (error) {
    ElMessage.error('获取社区内容失败')
  } finally {
    loading.value = false
  }
}

// 点赞逻辑 (Optimistic UI)
const handleLike = async (post: CommunityPost) => {
  const originalLiked = post.isLiked
  const originalCount = post.totalLikes

  // 前端先行
  post.isLiked = !post.isLiked
  post.totalLikes += post.isLiked ? 1 : -1

  try {
    const res = await likePostApi(post.id)
    if (res.code !== 200) throw new Error()
  } catch (err) {
    // 接口报错回滚
    post.isLiked = originalLiked
    post.totalLikes = originalCount
    ElMessage.error('操作失败，请重试')
  }
}

/**
 * 瀑布流布局逻辑 (CSS Grid)
 * 通过计算每个 item 占据了多少个 10px 的 row span 来实现
 */
const resizeGridItem = (item: HTMLElement) => {
  const grid = gridRef.value
  if (!grid) return
  // 确保 grid-auto-rows 和 grid-row-gap 有值
  const rowHeight = parseInt(window.getComputedStyle(grid).getPropertyValue('grid-auto-rows')) || 10
  const rowGap = parseInt(window.getComputedStyle(grid).getPropertyValue('grid-row-gap')) || 20
  const content = item.querySelector('.post-content') as HTMLElement
  if (!content) return
  const rowSpan = Math.ceil((content.getBoundingClientRect().height + rowGap) / (rowHeight + rowGap))
  item.style.gridRowEnd = `span ${rowSpan}`
}

const resizeAllGridItems = () => {
  const allItems = document.getElementsByClassName('post-card')
  for (let x = 0; x < allItems.length; x++) {
    resizeGridItem(allItems[x] as HTMLElement)
  }
}

// 监听窗口大小变化
window.addEventListener('resize', resizeAllGridItems)

const handleTabChange = (name: string) => {
  if (name === 'studio') {
    loadHistory()
    router.replace({ query: { tab: 'studio' } })
  } else if (name === 'community') {
    router.replace({ query: {} })
  }
}

// Studio 函数
function statusLabel(status: string | undefined): string {
  const s = (status || '').toUpperCase()
  if (s === 'PENDING') return '排队中'
  if (s === 'PROCESSING') return '生成中'
  if (s === 'DONE') return '已完成'
  if (s === 'ERROR') return '失败'
  return status || '未知'
}

function statusTagTypeForRow(status: string | undefined): 'success' | 'warning' | 'info' | 'danger' {
  const s = (status || '').toUpperCase()
  if (s === 'DONE') return 'success'
  if (s === 'ERROR') return 'danger'
  if (s === 'PROCESSING') return 'warning'
  return 'info'
}

function relativeTimeLabel(row: TaskListItem): string {
  void nowTick.value
  const t = getTaskSubmittedAt(row)
  return formatRelativeTime(t)
}

function absoluteTimeTitle(row: TaskListItem): string {
  const t = getTaskSubmittedAt(row)
  const abs = formatAbsoluteTime(t)
  return abs ? `提交时间：${abs}` : '提交时间未知'
}

function taskRowKey(row: TaskListItem, index: number): string {
  const id = row.taskId
  if (typeof id === 'string' && id) {
    return id
  }
  return `row-${index}-${getTaskTimeMs(row)}`
}

function openImageTab(url: string | undefined) {
  const full = resolveMediaUrl(url)
  if (full) {
    window.open(full, '_blank', 'noopener,noreferrer')
  }
}

function ensureSuccess<T>(res: ApiResult2<T>) {
  if (res.code !== 200) {
    throw new Error(res.msg || '接口请求失败')
  }
  return res.data
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  selectedFile.value = file || null
  selectedFileName.value = file?.name || ''
  if (referencePreviewUrl.value) {
    URL.revokeObjectURL(referencePreviewUrl.value)
  }
  if (file) {
    referencePreviewUrl.value = URL.createObjectURL(file)
  } else {
    referencePreviewUrl.value = ''
  }
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function pollTaskStatus() {
  if (!taskId.value) return
  try {
    const res = await getTaskStatusApi(taskId.value)
    const data = ensureSuccess(res)
    taskStatus.status = data.status
    taskStatus.progress = data.progress || 0
    taskStatus.resultUrl = data.resultUrl
    taskStatus.errorMsg = data.errorMsg
    if (data.status === 'DONE' || data.status === 'ERROR') {
      stopPolling()
      await loadHistory()
    }
  } catch {
    stopPolling()
  }
}

async function handleSubmitTask() {
  const uid = auth.userIdNumber
  if (!uid) {
    ElMessage.error('未获取到用户 ID，请重新登录')
    return
  }
  if (!prompt.value.trim()) {
    ElMessage.warning('请先输入提示词')
    return
  }
  if (!modelType.value) {
    ElMessage.warning('请先选择模型类型')
    return
  }
  if (!selectedFile.value) {
    ElMessage.warning('请先上传参考图')
    return
  }
  submitLoading.value = true
  try {
    const formData = new FormData()
    formData.append('userId', String(uid))
    formData.append('prompt', prompt.value)
    formData.append('modelType', modelType.value)
    formData.append('useLLM', isUseLLM.value ? 'true' : 'false')
    formData.append('image', selectedFile.value)

    const res = await submitTaskApi(formData)
    taskId.value = ensureSuccess(res) as string
    taskStatus.status = 'PENDING'
    taskStatus.progress = 0
    taskStatus.resultUrl = ''
    taskStatus.errorMsg = ''
    ElMessage.success('任务已提交，正在更新进度')

    stopPolling()
    pollTaskStatus()
    pollTimer = window.setInterval(pollTaskStatus, 2000)
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '任务提交失败')
  } finally {
    submitLoading.value = false
  }
}

async function loadHistory() {
  const uid = auth.userIdNumber
  if (!uid) return
  try {
    const res = await getTaskListApi(uid)
    historyList.value = ensureSuccess(res) || []
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '历史记录加载失败')
  }
}

function handleLogout() {
  auth.logout()
  stopPolling()
  router.push('/')
}

onMounted(() => {
  loadData()
  // 检查路由参数，如果是studio则切换tab
  const tab = router.currentRoute.value.query.tab as string
  if (tab === 'studio') {
    activeTab.value = 'studio'
    loadHistory()
  }
  timeTickTimer = window.setInterval(() => {
    nowTick.value++
  }, 60_000)
})

onBeforeUnmount(() => {
  stopPolling()
  if (timeTickTimer) {
    clearInterval(timeTickTimer)
    timeTickTimer = null
  }
  if (referencePreviewUrl.value) {
    URL.revokeObjectURL(referencePreviewUrl.value)
  }
})
</script>

<template>
  <div class="community-container">
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="社区广场" name="community">
        <header class="community-header">
          <h1>社区广场</h1>
          <p>发现 AI 创作之美</p>
        </header>

    <!-- 🚀 解决方案：使用 el-scrollbar native 属性和 @scroll 事件替代 v-infinite-scroll -->
    <el-scrollbar 
      height="calc(100vh - 160px)" 
      native
      @scroll="handleScroll"
      ref="scrollbarRef"
      class="community-scrollbar"
    >
      <div 
        ref="gridRef"
        class="masonry-grid" 
        v-loading="loading" 
        element-loading-text="加载社区美图中..."
        element-loading-background="rgba(10, 11, 16, 0.8)"
      >
        <div 
          v-for="(post, index) in posts" 
          :key="post.id" 
          class="post-card"
        >
          <div class="post-content">
            <!-- 图片展示 -->
            <div class="image-wrapper">
              <el-image 
                :src="resolveMediaUrl(post.imageUrl)" 
                fit="cover" 
                lazy
                :preview-src-list="[resolveMediaUrl(post.imageUrl)]"
                :initial-index="index"
                @load="resizeAllGridItems"
                class="post-image"
              >
                <template #placeholder>
                  <div class="image-skeleton" :style="{ aspectRatio: `${post.width}/${post.height}` }"></div>
                </template>
                <!-- 🚀 解决方案：el-image 错误处理 -->
                <template #error>
                  <div class="image-slot">图片加载失败</div>
                </template>
              </el-image>
              
              <!-- 悬浮遮罩层 -->
              <div class="overlay">
                <div class="author-info">
                  <el-avatar :size="24" :src="post.authorAvatar || ''">{{ post.authorName ? post.authorName.charAt(0) : '?' }}</el-avatar>
                  <span class="author-name">{{ post.authorName || '匿名用户' }}</span>
                </div>
              </div>
            </div>

            <!-- 底部交互区 -->
            <div class="post-info">
              <div class="post-title">{{ post.title }}</div>
              <div class="post-actions">
                <div 
                  class="like-btn" 
                  :class="{ 'is-liked': post.isLiked }"
                  @click.stop="handleLike(post)"
                >
                  <el-icon :size="18">
                    <StarFilled v-if="post.isLiked" />
                    <Star v-else />
                  </el-icon>
                  <span>{{ post.totalLikes }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>

        <!-- 🚀 解决方案：移除单独的加载状态显示，由 v-loading 处理 -->
        <div v-if="noMore && posts.length > 0" class="no-more">—— 已经到底啦 ——</div>
      </el-tab-pane>
      <el-tab-pane label="创作中心" name="studio">
        <div class="page">
          <div class="bg-glow glow-1" />
          <div class="bg-glow glow-2" />

          <header class="top">
            <div class="brand">
              <span class="logo">AIGC</span>
              <span class="title">创作工作台</span>
            </div>
            <div class="user">
              <span class="uid">当前账号 ID：{{ auth.userId || '-' }}</span>
              <el-button text type="primary" @click="$router.push('/rag')">RAG 对话</el-button>
              <el-button text type="primary" @click="$router.push('/')">首页</el-button>
              <el-button round @click="handleLogout">退出登录</el-button>
            </div>
          </header>

          <p class="lead">仅展示您本人提交的任务；生成完成后可在此预览、放大查看结果图。</p>

          <main class="layout">
            <el-card class="panel">
              <template #header>
                <div class="panel-title">提交生图任务</div>
              </template>
                <el-form label-position="top" class="task-form">
                  <el-form-item label="提示词 Prompt">
                    <el-input v-model="prompt" type="textarea" :rows="4" placeholder="例如：1girl, cinematic light, ultra detail..." />
                  </el-form-item>
                  <el-form-item label="模型类型">
                    <el-select v-model="modelType" placeholder="请选择模型类型">
                      <el-option label="SDXL" value="SDXL" />
                      <el-option label="FLUX" value="FLUX" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="LLM 增强提示词">
                    <el-switch v-model="isUseLLM" active-text="开启" inactive-text="关闭" />
                  </el-form-item>
                  <el-form-item label="参考图">
                    <input 
                      class="file-input" 
                      type="file" 
                      accept=".png,.jpg,.jpeg" 
                      @change="onFileChange" 
                      ref="fileInputRef" 
                    />
                    <div class="upload-area" @click="triggerFileInput">
                      <el-icon class="icon"><Upload /></el-icon>
                      <span class="text">{{ selectedFileName ? selectedFileName : '点击此处上传图片' }}</span>
                    </div>
                    <div v-if="selectedFileName" class="file-name">已选择：{{ selectedFileName }}</div>
                  </el-form-item>
                  <!-- 提交按钮容器，用于右下角对齐 -->
                  <div class="submit-btn-wrap">
                    <el-button type="primary" :loading="submitLoading" class="submit-btn" @click="handleSubmitTask">提交任务</el-button>
                  </div>
                </el-form>
            </el-card>

            <el-card class="panel">
              <template #header>
                <div class="panel-title">参考图预览</div>
              </template>
              <div class="status">
                <div v-if="referencePreviewUrl" class="preview">
                  <el-image
                    :src="referencePreviewUrl"
                    fit="contain"
                    :preview-src-list="[referencePreviewUrl]"
                    preview-teleported
                  />
                  <p class="preview-hint">点击图片可放大预览</p>
                </div>
                <p v-else class="idle-hint">请先在左侧上传参考图，此处将显示预览。</p>
              </div>
            </el-card>

            <el-card class="panel history-panel">
              <template #header>
                <div class="panel-title">
                  <span>我的创作记录</span>
                  <span class="sub">按时间由近到远排序</span>
                  <el-button text type="primary" @click="loadHistory">刷新</el-button>
                </div>
              </template>

              <div v-if="!displayTasks.length" class="empty">暂无任务，提交后将在此展示。</div>

              <div v-else class="history-grid">
                <article v-for="(row, index) in displayTasks" :key="taskRowKey(row, index)" class="history-card">
                  <div class="thumb-wrap">
                    <el-image
                      v-if="resolveMediaUrl(row.resultUrl as string | undefined)"
                      class="thumb"
                      :src="resolveMediaUrl(row.resultUrl as string | undefined)"
                      fit="cover"
                      :preview-src-list="[resolveMediaUrl(row.resultUrl as string | undefined)]"
                      preview-teleported
                    />
                    <div v-else class="thumb-placeholder">
                      <span>{{ statusLabel(row.status) }}</span>
                    </div>
                  </div>
                  <div class="card-body">
                    <div class="card-head">
                      <span class="serial">创作 #{{ index + 1 }}</span>
                      <time
                        class="when"
                        :title="absoluteTimeTitle(row)"
                      >{{ relativeTimeLabel(row) }}</time>
                    </div>
                    <p class="prompt-line" :title="String(row.prompt ?? '')">{{ row.prompt || '（无提示词）' }}</p>
                    <div class="card-foot">
                      <el-tag size="small" :type="statusTagTypeForRow(row.status)">{{ statusLabel(row.status) }}</el-tag>
                      <el-button
                        v-if="resolveMediaUrl(row.resultUrl as string | undefined)"
                        link
                        type="primary"
                        @click="openImageTab(row.resultUrl as string | undefined)"
                      >
                        新窗口打开
                      </el-button>
                    </div>
                  </div>
                </article>
              </div>
            </el-card>
          </main>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.community-container {
  min-height: 100vh;
  background: #0a0b10; /* 深色背景 */
  padding: 40px 20px;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.community-header {
  text-align: center;
  margin-bottom: 20px;
  flex-shrink: 0; /* 阻止头部被压缩 */
}

.community-header h1 {
  font-size: 2.5rem;
  background: linear-gradient(45deg, #00f2fe, #4facfe);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
}

.community-header p {
  color: #8f95a3;
  font-size: 1.1rem;
}

.community-scrollbar {
  flex-grow: 1; /* 让滚动条区域占据剩余空间 */
}

/* 瀑布流 Grid 核心样式 */
.masonry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  grid-auto-rows: 10px; /* 每一行非常窄，方便 item 精确跨度 */
  grid-gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  padding-bottom: 20px; /* 增加底部填充，确保加载更多触发 */
}

.post-card {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  height: min-content; /* 重要：让 card 根据内容高度坍塌 */
}

.post-card:hover {
  transform: translateY(-5px) scale(1.02);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(79, 172, 254, 0.3);
  border-color: rgba(79, 172, 254, 0.5);
}

.image-wrapper {
  position: relative;
  cursor: pointer;
}

.post-image {
  width: 100%;
  display: block;
  /* max-height: 300px;  可以根据需要设置最大高度，但会影响瀑布流的自然高度 */
}

.image-skeleton {
  background: #1a1c26;
  width: 100%;
}

/* 🚀 解决方案：el-image 错误处理样式 */
.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #2a2a2a;
  color: #909399;
  font-size: 14px;
}

.overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  opacity: 0;
  transition: opacity 0.3s;
}

.post-card:hover .overlay {
  opacity: 1;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.author-name {
  font-size: 0.9rem;
  color: #fff;
}

.post-info {
  padding: 12px;
}

.post-title {
  font-size: 0.95rem;
  color: #e2e4e9;
  margin-bottom: 8px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-actions {
  display: flex;
  justify-content: flex-end;
}

.like-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #8f95a3;
  transition: all 0.2s;
  padding: 4px 8px;
  border-radius: 20px;
}

.like-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.like-btn.is-liked {
  color: #ff4d4f;
}

.no-more {
  text-align: center;
  padding: 20px;
  color: #8f95a3;
  flex-shrink: 0;
}

/* 适配移动端 */
@media (max-width: 600px) {
  .masonry-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    grid-gap: 12px;
  }
}

/* Studio 样式 */
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
  margin-bottom: 8px;
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

.uid {
  font-size: 13px;
  color: rgba(238, 243, 255, 0.65);
  margin-right: 4px;
}

.lead {
  position: relative;
  z-index: 1;
  margin: 0 0 18px;
  font-size: 14px;
  color: rgba(238, 243, 255, 0.72);
}

.layout {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.panel {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(8px);
}

.panel :deep(.el-card__header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: #eff4ff;
}

.panel-title .sub {
  flex: 1;
  font-weight: 400;
  font-size: 12px;
  color: rgba(238, 243, 255, 0.5);
}

.file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
}

.file-name {
  margin-top: 6px;
  color: rgba(238, 243, 255, 0.75);
  font-size: 12px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.label {
  color: rgba(238, 243, 255, 0.75);
}

.idle-hint {
  margin: 0;
  font-size: 13px;
  color: rgba(238, 243, 255, 0.55);
  line-height: 1.5;
}

.error {
  margin-top: 12px;
  color: #ff9a9a;
}

.preview {
  margin-top: 12px;
  width: 100%;
  max-height: 320px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.25);
}

.preview :deep(.el-image) {
  width: 100%;
  max-height: 320px;
  display: flex;
  justify-content: center;
}

.preview :deep(.el-image__inner) {
  max-height: 320px;
  object-fit: contain;
}

.preview-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: rgba(238, 243, 255, 0.55);
}

.history-panel {
  grid-column: 1 / -1;
}

.empty {
  padding: 24px;
  text-align: center;
  color: rgba(238, 243, 255, 0.5);
  font-size: 14px;
}

.history-grid-container {
  height: 400px;
}

.history-scrollbar {
  height: 100%;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.history-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
}

.thumb-wrap {
  flex-shrink: 0;
  width: 96px;
  height: 96px;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.35);
}

.thumb {
  width: 96px;
  height: 96px;
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: rgba(238, 243, 255, 0.55);
  text-align: center;
  padding: 4px;
}

.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.serial {
  font-size: 13px;
  font-weight: 600;
  color: #c8d7ff;
}

.when {
  flex-shrink: 0;
  font-size: 12px;
  color: rgba(238, 243, 255, 0.55);
}

.prompt-line {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(238, 243, 255, 0.85);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
}

.panel :deep(.el-input__wrapper),
.panel :deep(.el-textarea__inner),
.panel :deep(.el-select__wrapper) {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: none;
  transition: all 0.3s ease;
}

.panel :deep(.el-input__wrapper.is-focus),
.panel :deep(.el-textarea__inner:focus),
.panel :deep(.el-select__wrapper.is-focused) {
  border-color: #6a8aff;
  box-shadow: 0 0 0 2px rgba(106, 138, 255, 0.3);
  background: rgba(255, 255, 255, 0.12);
}

.panel :deep(.el-input__inner),
.panel :deep(.el-textarea__inner),
.panel :deep(.el-select__placeholder),
.panel :deep(.el-select__selected-item) {
  color: #eef3ff;
}

.panel :deep(.el-input__inner::placeholder) {
  color: rgba(238, 243, 255, 0.5);
}

.panel :deep(.el-form-item__label) {
  color: #eef3ff;
  font-size: 14px;
  margin-bottom: 6px;
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 120px; /* 可根据需求调整高度 */
  border: 2px dashed rgba(106, 138, 255, 0.5);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.3s ease;
  gap: 12px;
}
.upload-area:hover {
  border-color: #6a8aff;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 12px rgba(106, 138, 255, 0.2);
}

.upload-area .icon {
  font-size: 36px;
  color: #6a8aff;
}

.upload-area .text {
  font-size: 16px;
  color: rgba(238, 243, 255, 0.8);
}

.file-name {
  margin-top: 10px;
  color: rgba(238, 243, 255, 0.85);
  font-size: 13px;
  text-align: center;
  padding: 0 8px;
  word-break: break-all;
}
/* ========== 选项卡 Tab 样式优化：更大、高亮更明显 ========== */
.community-container :deep(.el-tabs__nav-wrap) {
  padding: 0 0 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 16px;
}

/* 1. 放大 Tab 按钮尺寸 */
.community-container :deep(.el-tabs__item) {
  height: 48px !important;
  line-height: 48px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  padding: 0 24px !important;
  margin-right: 8px !important;
  color: rgba(238, 243, 255, 0.6) !important;
  transition: all 0.3s ease !important;
  border-radius: 8px 8px 0 0 !important;
}

/* 2. 激活态（当前选中）高亮强化 */
.community-container :deep(.el-tabs__item.is-active) {
  color: #6a8aff !important;
  background: rgba(106, 138, 255, 0.15) !important;
  text-shadow: 0 0 8px rgba(106, 138, 255, 0.4) !important;
}

/* 3. 激活态下划线（指示器）强化 */
.community-container :deep(.el-tabs__active-bar) {
  height: 3px !important;
  background: linear-gradient(90deg, #4facfe, #00f2fe) !important;
  border-radius: 2px !important;
  box-shadow: 0 0 8px rgba(79, 172, 254, 0.6) !important;
}

/* 4. 悬浮态强化（提升交互感） */
.community-container :deep(.el-tabs__item:hover:not(.is-active)) {
  color: rgba(238, 243, 255, 0.85) !important;
  background: rgba(255, 255, 255, 0.08) !important;
}

/* 5. 移除默认的分割线，让视觉更干净 */
.community-container :deep(.el-tabs__nav-prev),
.community-container :deep(.el-tabs__nav-next) {
  display: none;
}
/* ========== 表单布局优化：按钮右下角对齐 ========== */
.task-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 提交按钮容器：右下角对齐 */
.submit-btn-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

/* ========== 提交按钮美化：科技风渐变+悬浮动效 ========== */
.submit-btn {
  --el-button-primary-bg-color: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  --el-button-primary-border-color: transparent;
  --el-button-primary-hover-bg-color: linear-gradient(135deg, #6a8aff 0%, #4facfe 100%);
  --el-button-primary-hover-border-color: transparent;
  --el-button-primary-active-bg-color: linear-gradient(135deg, #3a7bd5 0%, #00c6ff 100%);
  --el-button-primary-active-border-color: transparent;

  height: 48px;
  padding: 0 32px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  border: none;
  background: var(--el-button-primary-bg-color) !important;
  box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
  transition: all 0.3s ease;
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(79, 172, 254, 0.6);
  background: var(--el-button-primary-hover-bg-color) !important;
}

.submit-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 10px rgba(79, 172, 254, 0.3);
  background: var(--el-button-primary-active-bg-color) !important;
}

/* 加载状态适配 */
.submit-btn.is-loading {
  pointer-events: none;
  opacity: 0.8;
}

/* ========== 上传区域样式优化（和按钮风格统一） ========== */
.file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 120px;
  border: 2px dashed rgba(79, 172, 254, 0.4);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.3s ease;
  gap: 12px;
}

.upload-area:hover {
  border-color: #4facfe;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 15px rgba(79, 172, 254, 0.2);
}

.upload-area .icon {
  font-size: 36px;
  color: #4facfe;
}

.upload-area .text {
  font-size: 16px;
  color: rgba(238, 243, 255, 0.8);
}

.file-name {
  margin-top: 10px;
  color: rgba(238, 243, 255, 0.85);
  font-size: 13px;
  text-align: center;
  padding: 0 8px;
  word-break: break-all;
}

/* ========== 移动端适配 ========== */
@media (max-width: 600px) {
  .submit-btn-wrap {
    justify-content: center;
  }
  .submit-btn {
    width: 100%;
    height: 44px;
    font-size: 15px;
  }
}
</style>

<template>
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
        <el-button text type="primary" @click="$router.push('/community')">社区广场</el-button>
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
        <el-form label-position="top">
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
            <div class="upload-area" @click="triggerFileInput">
              <input class="file-input" type="file" accept=".png,.jpg,.jpeg" @change="onFileChange" ref="fileInputRef" />
              <el-icon class="icon"><Upload /></el-icon>
              <span class="text">{{ selectedFileName ? selectedFileName : '点击此处上传图片' }}</span>
            </div>
            <div v-if="selectedFileName" class="file-name">已选择：{{ selectedFileName }}</div>
          </el-form-item>
          <el-button type="primary" :loading="submitLoading" @click="handleSubmitTask">提交任务</el-button>
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
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElIcon } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import { getTaskListApi, getTaskStatusApi, submitTaskApi, type ApiResult, type TaskListItem, type TaskStatusData } from '../api/aigc'
import { useAuthStore } from '../stores/auth'
import { formatAbsoluteTime, formatRelativeTime } from '../utils/formatTime'
import { resolveMediaUrl } from '../utils/mediaUrl'
import { getTaskSubmittedAt, getTaskTimeMs, sortTasksNewestFirst } from '../utils/taskList'

const auth = useAuthStore()
const router = useRouter()

const submitLoading = ref(false)
const prompt = ref('')
const selectedFile = ref<File | null>(null)
const selectedFileName = ref('')
const referencePreviewUrl = ref('')
const modelType = ref<'SDXL' | 'FLUX'>('SDXL')
const isUseLLM = ref(false) // 新增：是否使用LLM增强提示词
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

function ensureSuccess<T>(res: ApiResult<T>) {
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
    formData.append('isUseLLM', String(isUseLLM.value))
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
  loadHistory()
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
  width: 100%;
  padding: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.88);
  background: rgba(0, 0, 0, 0.15);
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
  height: 400px; /* 显式设置容器高度，让 el-scrollbar 生效 */
}

.history-scrollbar {
  height: 100%;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
</style>

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
  height: 100px;
  border: 2px dashed rgba(106, 138, 255, 0.4);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-area:hover {
  border-color: #6a8aff;
  background: rgba(255, 255, 255, 0.1);
}

.upload-area .icon {
  font-size: 32px;
  color: #6a8aff;
  margin-bottom: 8px;
}

.upload-area .text {
  font-size: 14px;
  color: rgba(238, 243, 255, 0.75);
}

.file-name {
  margin-top: 10px;
  color: rgba(238, 243, 255, 0.85);
  font-size: 13px;
  text-align: center;
  padding: 0 8px;
  word-break: break-all;
}

.file-input {
  display: none; /* Hide the native file input */
}


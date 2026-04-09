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
      <!-- 左侧：提交任务表单 -->
      <el-card class="panel left-panel">
        <template #header>
          <div class="panel-title">提交生图任务</div>
        </template>
        <TaskForm
          v-model:prompt="prompt"
          v-model:model-type="modelType"
          v-model:is-use-l-l-m="isUseLLM"
          v-model:selected-file="selectedFile"
          v-model:selected-file-name="selectedFileName"
          v-model:selected-lo-r-as="selectedLoRAs"
          :loading="submitLoading"
          :lora-options="loraOptions"
          :lora-loading="loraLoading"
          @submit="handleSubmitTask"
        />
      </el-card>

      <!-- 右侧：参考图预览 + 创作记录 -->
      <div class="right-column">
        <el-card class="panel preview-panel">
          <template #header>
            <div class="panel-title">参考图预览</div>
          </template>
          <ImagePreview 
            :preview-url="referencePreviewUrl" 
            idle-text="请先在左侧上传参考图，此处将显示预览。"
          />
        </el-card>

        <el-card class="panel history-panel">
          <template #header>
            <div class="panel-title">
              <span>我的创作记录</span>
              <span class="sub">按时间由近到远排序</span>
              <el-button text type="primary" @click="loadHistory">刷新</el-button>
            </div>
          </template>
          <TaskHistory 
            :tasks="historyList" 
            :now-tick="nowTick"
            @open-image="openImageTab"
          />
        </el-card>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  getTaskListApi, 
  getTaskStatusApi, 
  submitTaskApi, 
  getLoRAOptionsApi,
  type ApiResult, 
  type TaskListItem, 
  type TaskStatusData, 
  type LoRAOption,
  type BaseModelType 
} from '@/api/aigc'
import { useAuthStore } from '@/stores/auth'
import TaskForm, { type SelectedLoRA } from './components/TaskForm.vue'
import TaskHistory from './components/TaskHistory.vue'
import ImagePreview from './components/ImagePreview.vue'

const auth = useAuthStore()
const router = useRouter()

// 表单状态
const submitLoading = ref(false)
const prompt = ref('')
const selectedFile = ref<File | null>(null)
const selectedFileName = ref('')
const referencePreviewUrl = ref('')
const modelType = ref<'SDXL' | 'FLUX'>('SDXL')
const isUseLLM = ref(false)

// LoRA相关 - 改为多选数组
const selectedLoRAs = ref<SelectedLoRA[]>([])
const loraOptions = ref<LoRAOption[]>([])
const loraLoading = ref(false)

// 任务状态
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

function ensureSuccess<T>(res: ApiResult<T>) {
  if (res.code !== 200) {
    throw new Error(res.msg || '接口请求失败')
  }
  return res.data
}

function onFileChange() {
  if (referencePreviewUrl.value) {
    URL.revokeObjectURL(referencePreviewUrl.value)
  }
  if (selectedFile.value) {
    referencePreviewUrl.value = URL.createObjectURL(selectedFile.value)
  } else {
    referencePreviewUrl.value = ''
  }
}

// 监听文件变化，更新预览URL
watch(selectedFile, onFileChange)

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
  submitLoading.value = true
  try {
    const formData = new FormData()
    formData.append('userId', String(uid))
    formData.append('prompt', prompt.value)
    formData.append('modelType', modelType.value)
    formData.append('isUseLLM', String(isUseLLM.value))
    // 参考图为可选，仅在用户上传时添加
    if (selectedFile.value) {
      formData.append('image', selectedFile.value)
    }
    
    // 添加多个LoRA参数
    const validLoRAs = selectedLoRAs.value.filter(lora => lora.id)
    if (validLoRAs.length > 0) {
      // 方式1: 使用JSON数组传递
      formData.append('loras', JSON.stringify(validLoRAs))
      
      // 方式2: 为了兼容性，同时保留单LoRA参数（取第一个）
      if (validLoRAs.length === 1) {
        formData.append('loraModel', validLoRAs[0].id)
        formData.append('loraStrength', String(validLoRAs[0].strength))
      }
    }

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

/** 加载LoRA选项列表 */
async function loadLoRAOptions() {
  if (!modelType.value) return
  
  loraLoading.value = true
  loraOptions.value = []
  // 清空已选择的LoRA
  selectedLoRAs.value = []
  
  try {
    const res = await getLoRAOptionsApi(modelType.value as BaseModelType)
    const data = ensureSuccess(res)
    loraOptions.value = data || []
  } catch (error: unknown) {
    ElMessage.warning(error instanceof Error ? error.message : '加载LoRA模型列表失败')
    loraOptions.value = []
  } finally {
    loraLoading.value = false
  }
}

// 监听模型类型变化，自动加载对应的LoRA列表
watch(modelType, () => {
  loadLoRAOptions()
}, { immediate: true })

function openImageTab(url: string) {
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
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
  align-items: stretch; /* 让左右两侧等高 */
}

/* 左侧面板 - 自然高度 */
.left-panel {
  height: fit-content;
}

/* 右侧列容器 - 垂直排列两个面板 */
.right-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.panel {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(8px);
  overflow: visible; /* 防止内容被裁剪 */
  display: flex;
  flex-direction: column;
}

/* 🔥 关键修复：确保卡片内容区域不会收缩 */
.panel :deep(.el-card__body) {
  overflow: visible;
  flex: 1;
}

/* 左侧面板内容区域保持自然高度 */
.left-panel :deep(.el-card__body) {
  min-height: 200px;
}

/* 参考图预览面板 - 无图时紧凑 */
.preview-panel {
  flex: 0 0 auto; /* 不拉伸，按内容高度 */
}

.preview-panel :deep(.el-card__body) {
  min-height: auto;
  padding: 12px 16px;
}

/* 创作记录面板 - 占据剩余空间 */
.history-panel {
  flex: 1 1 auto; /* 占据剩余空间 */
  min-height: 0; /* 允许收缩 */
}

.history-panel :deep(.el-card__body) {
  min-height: 200px;
  max-height: 400px; /* 限制最大高度 */
  overflow-y: auto; /* 内容过多时滚动 */
}

.panel :deep(.el-card__header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
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

/* 移除旧的整行样式 */
.history-panel {
  grid-column: auto;
}

/* 卡片内部表单样式复写 */
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

/* 🔥 兜底锁死 LoRA 选择框，彻底防止收缩 */
.panel :deep(.lora-select) {
  width: 100% !important;
  min-width: 0 !important;
  flex: 1 1 auto !important;
}
.panel :deep(.lora-select .el-select__wrapper) {
  width: 100% !important;
  min-width: 100% !important;
  max-width: 100% !important;
}
</style>
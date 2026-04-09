<template>
  <el-form label-position="top" class="task-form">
    <el-form-item label="提示词 Prompt">
      <el-input 
        v-model="localPrompt" 
        type="textarea" 
        :rows="4" 
        placeholder="例如：1girl, cinematic light, ultra detail..." 
      />
    </el-form-item>
    
    <el-form-item label="模型类型">
      <el-select v-model="localModelType" placeholder="请选择模型类型">
        <el-option label="SDXL" value="SDXL" />
        <el-option label="FLUX" value="FLUX" />
      </el-select>
    </el-form-item>
    
    <!-- LoRA多选区域（优化版） -->
    <el-form-item label="LoRA 模型（可选，可多选）">
      <div class="lora-list">
        <div 
          v-for="(item, index) in localSelectedLoRAs" 
          :key="index" 
          class="lora-item"
        >
          <div class="lora-header">
            <!-- teleported防止下拉框关闭时布局变化 -->
            <el-select 
              v-model="item.id" 
              placeholder="选择LoRA模型"
              :loading="loraLoading"
              class="lora-select"
              popper-class="lora-popper"
              filterable
              clearable
              style="width: 360px !important;"
            >
              <el-option 
                v-for="opt in availableLoRAOptions(item.id)" 
                :key="opt.id" 
                :label="opt.name" 
                :value="opt.id" 
              />
            </el-select>
            <el-button 
              type="danger" 
              link 
              :icon="Delete" 
              @click="removeLoRA(index)"
              class="lora-delete-btn"
            />
          </div>
          <div class="lora-strength-control">
            <span class="strength-label">强度</span>
            <el-slider 
              v-model="item.strength" 
              :min="0" 
              :max="1" 
              :step="0.05"
              show-stops
              class="strength-slider"
            />
            <span class="strength-value">{{ item.strength.toFixed(2) }}</span>
          </div>
        </div>
        
        <el-button 
          v-if="canAddMoreLoRA" 
          type="primary" 
          link 
          :icon="Plus" 
          @click="addLoRA"
          class="lora-add-btn"
        >
          添加 LoRA
        </el-button>
        <span v-else-if="localSelectedLoRAs.length > 0" class="lora-limit-hint">
          已达到最大可选数量
        </span>
      </div>
    </el-form-item>
    
    <el-form-item label="LLM 增强提示词">
      <el-switch v-model="localIsUseLLM" active-text="开启" inactive-text="关闭" />
    </el-form-item>
    
    <el-form-item label="参考图（可选）">
      <div class="upload-area" @click="triggerFileInput">
        <input 
          class="file-input" 
          type="file" 
          accept=".png,.jpg,.jpeg" 
          @change="onFileChange" 
          ref="fileInputRef" 
        />
        <el-icon class="icon"><Upload /></el-icon>
        <span class="text">{{ fileName ? fileName : '点击此处上传参考图（可选）' }}</span>
      </div>
      <div v-if="fileName" class="file-name">已选择：{{ fileName }}</div>
      <div v-else class="file-name" style="color: rgba(238, 243, 255, 0.5)">不上传则使用默认参考图</div>
    </el-form-item>
    
    <!-- 提交按钮容器 -->
    <div class="submit-btn-wrap">
      <el-button 
        type="primary" 
        :loading="loading" 
        class="submit-btn" 
        @click="handleSubmit"
      >
        提交任务
      </el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Upload, Plus, Delete } from '@element-plus/icons-vue'
import type { LoRAOption } from '@/api/aigc'

/** 选中的LoRA项 */
export interface SelectedLoRA {
  id: string
  strength: number
}

const props = defineProps<{
  prompt: string
  modelType: 'SDXL' | 'FLUX'
  isUseLLM: boolean
  selectedFile: File | null
  selectedFileName: string
  selectedLoRAs: SelectedLoRA[]
  loading: boolean
  loraOptions?: LoRAOption[]
  loraLoading?: boolean
}>()

const emit = defineEmits<{
  'update:prompt': [value: string]
  'update:modelType': [value: 'SDXL' | 'FLUX']
  'update:isUseLLM': [value: boolean]
  'update:selectedFile': [value: File | null]
  'update:selectedFileName': [value: string]
  'update:selectedLoRAs': [value: SelectedLoRA[]]
  submit: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const MAX_LORA_COUNT = 3 // 最大可选LoRA数量

// 本地计算属性
const localPrompt = computed({
  get: () => props.prompt,
  set: (val) => emit('update:prompt', val)
})

const localModelType = computed({
  get: () => props.modelType,
  set: (val) => emit('update:modelType', val)
})

const localIsUseLLM = computed({
  get: () => props.isUseLLM,
  set: (val) => emit('update:isUseLLM', val)
})

const localSelectedLoRAs = computed({
  get: () => props.selectedLoRAs,
  set: (val) => emit('update:selectedLoRAs', val)
})

const fileName = computed(() => props.selectedFileName)

// 是否还可以添加更多LoRA
const canAddMoreLoRA = computed(() => {
  return localSelectedLoRAs.value.length < MAX_LORA_COUNT
})

// 获取可用的LoRA选项（排除已选择的）
function availableLoRAOptions(currentId: string): LoRAOption[] {
  const selectedIds = localSelectedLoRAs.value
    .filter((_, idx) => localSelectedLoRAs.value[idx]?.id !== currentId)
    .map(item => item.id)
  
  return (props.loraOptions || []).filter(opt => 
    opt.id === currentId || !selectedIds.includes(opt.id)
  )
}

// 添加LoRA
function addLoRA() {
  if (canAddMoreLoRA.value) {
    localSelectedLoRAs.value = [
      ...localSelectedLoRAs.value,
      { id: '', strength: 0.75 }
    ]
  }
}

// 移除LoRA
function removeLoRA(index: number) {
  const newLoRAs = [...localSelectedLoRAs.value]
  newLoRAs.splice(index, 1)
  localSelectedLoRAs.value = newLoRAs
}

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null
  emit('update:selectedFile', file)
  emit('update:selectedFileName', file?.name || '')
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleSubmit = () => {
  emit('submit')
}
</script>

<style scoped>
.task-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.submit-btn-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

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
  box-shadow: 0 4px 15px rgba(79, 172, 255, 0.4);
  transition: all 0.3s ease;
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(79, 172, 255, 0.6);
  background: var(--el-button-primary-hover-bg-color) !important;
}

.submit-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 10px rgba(79, 172, 255, 0.3);
  background: var(--el-button-primary-active-bg-color) !important;
}

.submit-btn.is-loading {
  pointer-events: none;
  opacity: 0.8;
}

.file-input {
  display: none;
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
  margin-top: 6px;
  color: rgba(238, 243, 255, 0.75);
  font-size: 12px;
}

/* ============== LoRA样式 ============== */
.lora-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 50px; /* 防止完全收缩 */
}

.lora-item {
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(8px);
  flex-shrink: 0; /* 防止flex收缩 */
  min-height: 90px; /* 固定最小高度 */
  width: 100%;
  max-width: 100%;
}

.lora-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

/* 🔥 终极修复：强制锁死宽度，永远不变形 */
.lora-select {
  flex: 1;
  min-width: 0;
  width: 100%;
}
/* 穿透锁死选中项容器 */
:deep(.lora-select .el-select__selected-item) {
  width: 100% !important;
  max-width: 100% !important;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}
:deep(.lora-select .el-select__wrapper) {
  width: 100% !important;
  min-width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  flex: none !important;
}
:deep(.lora-select .el-select__input) {
  width: 100% !important;
  min-width: 100% !important;
}

.lora-delete-btn {
  flex-shrink: 0;
  padding: 8px;
  color: #ff4d4f;
}

.lora-strength-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.strength-label {
  font-size: 14px;
  color: rgba(238, 243, 255, 0.75);
  min-width: 40px;
}

.strength-slider {
  flex: 1;
  --el-slider-height: 6px;
}

.strength-value {
  min-width: 56px;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #6a8aff;
  background: rgba(106, 138, 255, 0.15);
  padding: 6px 10px;
  border-radius: 6px;
}

.lora-add-btn {
  font-size: 16px;
  color: #6a8aff;
  padding: 8px 0;
  justify-content: flex-start;
}

.lora-limit-hint {
  font-size: 12px;
  color: rgba(238, 243, 255, 0.5);
}

/* 下拉弹窗样式适配深色主题 */
:deep(.lora-popper) {
  background: rgba(20, 22, 35, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

:deep(.lora-popper .el-select-dropdown__item) {
  color: rgba(238, 243, 255, 0.85);
}


:deep(.lora-popper .el-select-dropdown__item:hover) {
  background: rgba(106, 138, 255, 0.15);
}

:deep(.lora-popper .el-select-dropdown__item.selected) {
  color: #6a8aff;
  background: rgba(106, 138, 255, 0.1);
}

/* 滑块样式升级 */
:deep(.el-slider__runway) {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

:deep(.el-slider__bar) {
  background-color: #6a8aff;
  border-radius: 3px;
}

:deep(.el-slider__button) {
  border-color: #6a8aff;
  background-color: #6a8aff;
  width: 18px;
  height: 18px;
}

:deep(.el-slider__stop) {
  background-color: rgba(255, 255, 255, 0.3);
}

/* 表单样式统一 */
:deep(.el-input__wrapper),
:deep(.el-textarea__inner),
:deep(.el-select__wrapper) {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: none;
  transition: all 0.3s ease;
  border-radius: 8px;
}

:deep(.el-input__wrapper.is-focus),
:deep(.el-textarea__inner:focus),
:deep(.el-select__wrapper.is-focused) {
  border-color: #6a8aff;
  box-shadow: 0 0 0 2px rgba(106, 138, 255, 0.3);
  background: rgba(255, 255, 255, 0.12);
}

:deep(.el-input__inner),
:deep(.el-textarea__inner),
:deep(.el-select__placeholder),
:deep(.el-select__selected-item) {
  color: #eef3ff;
}

:deep(.el-input__inner::placeholder) {
  color: rgba(238, 243, 255, 0.5);
}

:deep(.el-form-item__label) {
  color: #eef3ff;
  font-size: 14px;
  margin-bottom: 6px;
}

/* 移动端适配 */
@media (max-width: 600px) {
  .submit-btn-wrap {
    justify-content: center;
  }
  .submit-btn {
    width: 100%;
    height: 44px;
    font-size: 15px;
  }
  .lora-strength-control {
    gap: 8px;
  }
  .strength-value {
    min-width: 48px;
    font-size: 14px;
  }
}
</style>
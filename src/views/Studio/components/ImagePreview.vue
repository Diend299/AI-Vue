<template>
  <div class="image-preview">
    <div v-if="previewUrl" class="preview">
      <el-image
        :src="previewUrl"
        fit="contain"
        :preview-src-list="[previewUrl]"
        preview-teleported
      />
      <p class="preview-hint">点击图片可放大预览</p>
    </div>
    <p v-else class="idle-hint">{{ idleText }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  previewUrl: string
  idleText?: string
}>()
</script>

<style scoped>
.image-preview {
  width: 100%;
}

/* 无图时的提示文字 - 紧凑样式 */
.idle-hint {
  margin: 0;
  padding: 4px 0;
  font-size: 13px;
  color: rgba(238, 243, 255, 0.55);
  line-height: 1.4;
}

.preview {
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
</style>

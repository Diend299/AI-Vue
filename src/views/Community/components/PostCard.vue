<template>
  <div class="post-card">
    <div class="post-content">
      <!-- 图片展示 -->
      <div class="image-wrapper">
        <el-image 
          :src="resolveMediaUrl(post.imageUrl)" 
          fit="cover" 
          lazy
          :preview-src-list="[resolveMediaUrl(post.imageUrl)]"
          @load="handleImageLoad"
          class="post-image"
        >
          <template #placeholder>
            <div class="image-skeleton" :style="{ aspectRatio: `${post.width}/${post.height}` }"></div>
          </template>
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
            @click.stop="handleLike"
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
</template>

<script setup lang="ts">
import { Star, StarFilled } from '@element-plus/icons-vue'
import { resolveMediaUrl } from '@/utils/mediaUrl'
import type { CommunityPost } from '@/api/community'

const props = defineProps<{
  post: CommunityPost
}>()

const emit = defineEmits<{
  like: [post: CommunityPost]
  load: []
}>()

const handleImageLoad = () => {
  emit('load')
}

const handleLike = () => {
  emit('like', props.post)
}
</script>

<style scoped>
.post-card {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  height: min-content;
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
}

.image-skeleton {
  background: #1a1c26;
  width: 100%;
}

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
</style>
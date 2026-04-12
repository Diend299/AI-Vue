<template>
  <div class="post-card" @click="handleCardClick">
    <div class="post-content">
      <!-- 图片展示 -->
      <div class="image-wrapper">
        <el-image 
          :src="resolveMediaUrl(post.imageUrl)" 
          fit="cover" 
          lazy
          :preview-src-list="[]"
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
          <div class="overlay-content">
            <div class="author-info">
              <el-avatar :size="24" :src="post.authorAvatar || ''">{{ post.authorName ? post.authorName.charAt(0) : '?' }}</el-avatar>
              <span class="author-name">{{ post.authorName || '匿名用户' }}</span>
            </div>
            <div class="overlay-actions">
              <div 
                class="like-btn" 
                :class="{ 'is-liked': post.isLiked }"
                @click.stop="handleLike"
              >
                <el-icon :size="16">
                  <StarFilled v-if="post.isLiked" />
                  <Star v-else />
                </el-icon>
                <span>{{ post.totalLikes }}</span>
              </div>
              <el-icon :size="16" class="view-icon"><View /></el-icon>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Star, StarFilled, View } from '@element-plus/icons-vue'
import { resolveMediaUrl } from '@/utils/mediaUrl'
import type { CommunityPost } from '@/api/community'

const props = defineProps<{
  post: CommunityPost
}>()

const emit = defineEmits<{
  like: [post: CommunityPost]
  load: []
  click: [post: CommunityPost]
}>()

const handleImageLoad = () => {
  emit('load')
}

const handleLike = () => {
  emit('like', props.post)
}

const handleCardClick = () => {
  emit('click', props.post)
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

.overlay-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.author-name {
  font-size: 0.9rem;
  color: #fff;
}

.overlay-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.like-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #fff;
  transition: all 0.2s;
  padding: 4px 8px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
}

.like-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.like-btn.is-liked {
  color: #ff4d4f;
}

.view-icon {
  color: #fff;
  opacity: 0.8;
}
</style>

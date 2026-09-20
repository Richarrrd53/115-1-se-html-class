<template>
  <div class="ta-chat-wrapper">
    <!-- ══════════════════════════════════════════════════════════
         助教端抽屜對話框 (TA Chat Drawer)
         ══════════════════════════════════════════════════════════ -->
    <aside
      class="chat-drawer ta-drawer"
      :class="{ 'is-open': isOpen, 'is-drag-over': isDraggingOver && currentView === 'thread' }"
      aria-label="助教管理對話框"
      @dragenter="handleDragEnter"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- 拖曳圖片上傳提示遮罩 (Drag & Drop Overlay) -->
      <transition name="fade-fast">
        <div v-if="isDraggingOver && currentView === 'thread'" class="chat-drag-overlay">
          <div class="drag-overlay-card">
            <div class="drag-icon-circle">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <p class="drag-overlay-title">放開以加入圖片附件</p>
            <p class="drag-overlay-sub">支援拖入圖片 (最多 10 張，單檔限 5MB)</p>
          </div>
        </div>
      </transition>

      <!-- 頂部 Header -->
      <div class="chat-drawer-header">
        <!-- 列表頁頂部 -->
        <template v-if="currentView === 'list'">
          <div class="header-left">
            <div class="chat-avatar-badge ta-badge-admin">TA</div>
            <div class="header-titles">
              <h3 class="chat-title">學生諮詢與提問</h3>
              <span class="chat-status-text">共 {{ conversations.length }} 位學生留言</span>
            </div>
          </div>
          <button
            class="chat-close-btn"
            type="button"
            title="關閉"
            @click="$emit('close')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </template>

        <!-- 對話頁頂部 -->
        <template v-else>
          <div class="header-left">
            <button
              class="btn-back-list"
              type="button"
              title="返回學生清單"
              @click="backToList"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <div class="header-titles" v-if="activeStudent">
              <h3 class="chat-title">{{ activeStudent.student_name }}</h3>
              <span class="chat-status-text">{{ activeStudent.student_id }}</span>
            </div>
          </div>
          <button
            class="chat-close-btn"
            type="button"
            title="關閉"
            @click="$emit('close')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </template>
      </div>

      <!-- ══════════════════════════════════════════════════════
           第一頁：曾經發送過訊息的學生清單 (未讀粗體顯示)
           ══════════════════════════════════════════════════════ -->
      <div v-if="currentView === 'list'" class="ta-student-list-container">
        <!-- 搜尋列 -->
        <div class="ta-search-box">
          <svg class="search-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜尋學生姓名或學號..."
            class="ta-search-input"
          />
        </div>

        <!-- 清單 -->
        <div class="ta-student-scroll-list">
          <div v-if="isLoadingList" class="ta-loading-hint">
            載入學生對話清單中...
          </div>
          <div v-else-if="!filteredConversations.length" class="ta-empty-hint">
            <div class="empty-sparkle">💬</div>
            <p>目前沒有學生留言</p>
          </div>
          <div
            v-for="item in filteredConversations"
            :key="item.student_id"
            class="ta-student-card"
            :class="{ 'has-unread-bold': item.has_unread }"
            @click="selectStudent(item)"
          >
            <div class="student-avatar-wrap">
              <div class="student-avatar">{{ item.student_name ? item.student_name.trim().charAt(0) : '學' }}</div>
              <span v-if="item.has_unread" class="unread-dot-badge"></span>
            </div>

            <div class="student-card-info">
              <div class="card-title-row">
                <span class="student-name-text" :class="{ 'text-bold': item.has_unread }">
                  {{ item.student_name }}
                  <small class="student-id-tag">({{ item.student_id }})</small>
                </span>
                <span class="card-time-text">{{ formatTimeAgo(item.last_message_at) }}</span>
              </div>
              <div class="card-preview-row">
                <span class="preview-text" :class="{ 'text-bold': item.has_unread }">
                  {{ item.last_message || '［圖片附件］' }}
                </span>
                <span v-if="item.unread_count > 0" class="unread-count-pill">
                  {{ item.unread_count }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════
           第二頁：專屬學生對話串 (Thread View)
           ══════════════════════════════════════════════════════ -->
      <div v-else class="ta-thread-container">
        <div ref="threadScrollRef" class="chat-message-list">
          <!-- 無訊息提示 -->
          <div v-if="!isLoadingMessages && !messages.length" class="chat-empty-hint">
            <div class="empty-sparkle">✦</div>
            <p class="empty-title">目前尚無對話紀錄</p>
            <p class="empty-sub">您可以主動在下方留言給學生。</p>
          </div>

          <div
            v-for="msg in messages"
            :key="msg.id"
            :id="`ta-msg-${msg.id}`"
            class="chat-msg-row"
            :class="[
              msg.sender_role === 'ta' ? 'row-me' : 'row-them',
              { 'is-recalled-row': msg.is_recalled }
            ]"
          >
            <!-- 學生頭像 -->
            <div v-if="msg.sender_role === 'student'" class="chat-msg-avatar student-side-avatar">
              {{ msg.student_name ? msg.student_name.trim().charAt(0) : '學' }}
            </div>

            <!-- 氣泡主體 -->
            <div class="chat-bubble-wrap">
              <!-- 引用內容卡片 -->
              <div
                v-if="msg.reply_to_id && getQuotedMsg(msg.reply_to_id)"
                class="quote-preview-pill"
                @click="scrollToMsg(msg.reply_to_id)"
              >
                <div class="quote-bar"></div>
                <div class="quote-info">
                  <span class="quote-sender">
                    {{ getQuotedMsg(msg.reply_to_id)?.sender_role === 'ta' ? '助教 (我)' : (getQuotedMsg(msg.reply_to_id)?.student_name || '學生') }}
                  </span>
                  <span class="quote-snippet">
                    {{ getQuotedMsg(msg.reply_to_id)?.is_recalled ? '（訊息已收回）' : (getQuotedMsg(msg.reply_to_id)?.content || '［圖片附件］') }}
                  </span>
                </div>
              </div>

              <!-- 收回狀態：虛線外框 -->
              <div v-if="msg.is_recalled" class="recalled-msg-bubble">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg>
                <span>此訊息已被收回</span>
              </div>

              <!-- 正常訊息氣泡 (Q彈動畫) -->
              <div v-else class="chat-bubble" :class="msg.sender_role === 'ta' ? 'bubble-me' : 'bubble-them'">
                <!-- 圖片附件 (單圖或多圖 30% 堆疊遮擋) -->
                <template v-if="getMessageAttachments(msg).length === 1">
                  <div
                    class="chat-image-wrap"
                    :data-img-src="getMessageAttachments(msg)[0].url"
                    @click="openGallery(getMessageAttachments(msg), 0, msg.sender_role === 'ta' ? 'bottom-right' : 'bottom-left')"
                  >
                    <div class="chat-image-skeleton"></div>
                    <img
                      :data-src="getMessageAttachments(msg)[0].url"
                      :alt="getMessageAttachments(msg)[0].name || '附件圖片'"
                      class="chat-lazy-image"
                      loading="lazy"
                      @load="onImageLoaded($event)"
                    />
                  </div>
                </template>
                <template v-else-if="getMessageAttachments(msg).length > 1">
                  <!-- 多圖堆疊遮擋 30% (最多 5 張，超過 5 張為 4 張 + 1 張「+N」卡片) -->
                  <div class="chat-images-stack-group">
                    <div class="chat-images-stack-track">
                      <!-- 前 4 張 (若總數 <= 5 則顯示全部) -->
                      <div
                        v-for="(att, aIdx) in getVisibleAttachments(msg)"
                        :key="aIdx"
                        class="chat-stack-img-wrap"
                        :data-img-src="att.url"
                        :style="{ zIndex: getStackZIndex(msg, aIdx) }"
                        @click.stop="openGallery(getMessageAttachments(msg), aIdx, msg.sender_role === 'ta' ? 'bottom-right' : 'bottom-left')"
                      >
                        <div class="chat-image-skeleton"></div>
                        <img
                          :data-src="att.url"
                          :alt="att.name || `附件圖片 ${aIdx + 1}`"
                          class="chat-lazy-image"
                          loading="lazy"
                          @load="onImageLoaded($event)"
                        />
                      </div>

                      <!-- 第 5 張：若超過 5 張，顯示「+幾張」遮罩卡片 (如 10 張顯示「+6」) -->
                      <div
                        v-if="getMessageAttachments(msg).length > 5"
                        class="chat-stack-img-wrap chat-stack-more-wrap"
                        :data-img-src="getMessageAttachments(msg)[4].url"
                        :style="{ zIndex: 1 }"
                        :title="`查看全部 ${getMessageAttachments(msg).length} 張圖片`"
                        @click.stop="openGallery(getMessageAttachments(msg), 4, msg.sender_role === 'ta' ? 'bottom-right' : 'bottom-left')"
                      >
                        <div class="chat-image-skeleton"></div>
                        <img
                          :data-src="getMessageAttachments(msg)[4].url"
                          :alt="getMessageAttachments(msg)[4].name || '更多圖片'"
                          class="chat-lazy-image"
                          loading="lazy"
                          @load="onImageLoaded($event)"
                        />
                        <div class="chat-stack-more-overlay">
                          <span class="chat-stack-more-count">+{{ getMessageAttachments(msg).length - 4 }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="stack-badge-pill">
                      <span>{{ getMessageAttachments(msg).length }} 張圖片</span>
                    </div>
                  </div>
                </template>

                <!-- 文字內容 (支援 Markdown 格式與自動換行) -->
                <div v-if="msg.content" class="chat-text markdown-content" v-html="renderMarkdown(msg.content)"></div>

                <!-- 按讚徽章 (右下角白色膠囊，實心愛心 SVG，scale 動畫) -->
                <transition name="badge-scale">
                  <span v-if="msg.likes > 0" class="bubble-like-badge" title="收到的讚">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#ef4444" stroke="none">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <span class="like-count-num">{{ msg.likes }}</span>
                  </span>
                </transition>
              </div>

              <!-- 訊息操作工具列容器 (無佔位，hover 氣泡上移顯示，含對話時間) -->
              <div v-if="!msg.is_recalled" class="msg-action-bar-container">
                <span class="action-bar-time">{{ formatTime(msg.created_at) }}</span>
                <div
                  class="msg-action-bar"
                  @mouseenter="startActionBarHover(msg.id)"
                  @mouseleave="stopActionBarHover"
                >
                  <!-- 1. 按讚 (Like) -->
                  <div class="action-btn-item">
                    <button
                      class="msg-action-btn"
                      :class="{ 'is-active': isMsgLiked(msg) }"
                      type="button"
                      @click="handleLike(msg)"
                      @mouseenter="hoveredActionKey = `${msg.id}-like`"
                      @mouseleave="hoveredActionKey = null"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                    </button>
                    <span v-if="isHoverTooltipReady && hoveredActionKey === `${msg.id}-like`" class="action-tooltip">
                      {{ isMsgLiked(msg) ? '取消讚' : '按讚' }}
                    </span>
                  </div>

                  <!-- 2. 收回 (Recall, 僅助教發出者，圓形外框 + 引用風格箭頭) -->
                  <div v-if="msg.sender_role === 'ta'" class="action-btn-item">
                    <button
                      class="msg-action-btn"
                      type="button"
                      @click="handleRecall(msg)"
                      @mouseenter="hoveredActionKey = `${msg.id}-recall`"
                      @mouseleave="hoveredActionKey = null"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="9.5"></circle>
                        <polyline points="10.5 14 7.5 11 10.5 8"></polyline>
                        <path d="M16 15.5v-1.5a3 3 0 0 0-3-3H7.5"></path>
                      </svg>
                    </button>
                    <span v-if="isHoverTooltipReady && hoveredActionKey === `${msg.id}-recall`" class="action-tooltip">
                      收回
                    </span>
                  </div>

                  <!-- 3. 下載 (Download) -->
                  <div v-if="msg.attachment_url" class="action-btn-item">
                    <button
                      class="msg-action-btn"
                      type="button"
                      @click="handleDownloadImage(msg.attachment_url, msg.attachment_name || 'image.png')"
                      @mouseenter="hoveredActionKey = `${msg.id}-download`"
                      @mouseleave="hoveredActionKey = null"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </button>
                    <span v-if="isHoverTooltipReady && hoveredActionKey === `${msg.id}-download`" class="action-tooltip">
                      下載
                    </span>
                  </div>

                  <!-- 4. 複製 (Copy) -->
                  <div v-if="msg.content" class="action-btn-item">
                    <button
                      class="msg-action-btn"
                      type="button"
                      @click="handleCopyText(msg.content)"
                      @mouseenter="hoveredActionKey = `${msg.id}-copy`"
                      @mouseleave="hoveredActionKey = null"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <span v-if="isHoverTooltipReady && hoveredActionKey === `${msg.id}-copy`" class="action-tooltip">
                      複製
                    </span>
                  </div>

                  <!-- 5. 引用 (Quote) -->
                  <div class="action-btn-item">
                    <button
                      class="msg-action-btn"
                      type="button"
                      @click="handleQuote(msg)"
                      @mouseenter="hoveredActionKey = `${msg.id}-quote`"
                      @mouseleave="hoveredActionKey = null"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 17 4 12 9 7"></polyline>
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                      </svg>
                    </button>
                    <span v-if="isHoverTooltipReady && hoveredActionKey === `${msg.id}-quote`" class="action-tooltip">
                      引用
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 抽屜底部回覆欄 -->
        <div class="chat-drawer-footer">
          <!-- 引用橫幅 -->
          <div v-if="replyingMsg" class="drawer-reply-banner">
            <div class="reply-content">
              <span class="reply-target">回覆 {{ replyingMsg.sender_role === 'ta' ? '我' : (activeStudent?.student_name || '學生') }}:</span>
              <span class="reply-snippet">{{ replyingMsg.content || '［圖片附件］' }}</span>
            </div>
            <button class="reply-cancel-btn" type="button" @click="replyingMsg = null">✕</button>
          </div>

          <!-- 附件縮圖列 (支援單圖與多圖 30% 堆疊) -->
          <div v-if="attachedFiles.length" class="drawer-attach-pill" :class="{ 'is-multiple': attachedFiles.length > 1 }">
            <!-- 單圖 -->
            <template v-if="attachedFiles.length === 1">
              <img :src="attachedFiles[0].preview" :alt="attachedFiles[0].name" />
              <span class="attach-name">{{ attachedFiles[0].name }}</span>
              <button class="attach-del" type="button" title="移除" @click="removeAttachment(0)">✕</button>
            </template>
            <!-- 多圖 (30% 堆疊遮擋，hover 一次排開) -->
            <template v-else>
              <div class="drawer-stack-track">
                <div
                  v-for="(item, idx) in attachedFiles"
                  :key="item.id"
                  class="drawer-stack-thumb-wrap"
                  :style="{ zIndex: attachedFiles.length - idx }"
                >
                  <img :src="item.preview" :alt="item.name" class="drawer-stack-thumb" />
                  <button class="drawer-thumb-del" type="button" title="移除此圖片" @click="removeAttachment(idx)">✕</button>
                </div>
              </div>
              <span class="drawer-stack-count">{{ attachedFiles.length }}/10 張圖片</span>
              <button class="attach-del" type="button" title="全部清空" @click="clearAttachments">✕</button>
            </template>
          </div>

          <!-- 輸入控制列 -->
          <div class="drawer-input-row">
            <!-- 「+」附件按鈕 -->
            <div class="project-option-btn-wrap">
              <button
                class="project-option-btn"
                :class="{ 'is-active': isOptionMenuOpen }"
                type="button"
                title="新增圖片 (最多10張)"
                @click.stop="isOptionMenuOpen = !isOptionMenuOpen"
              >
                <span class="option-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </span>
              </button>

              <transition name="morph-menu-pop">
                <div v-if="isOptionMenuOpen" class="global-project-option-menu is-content-visible drawer-option-menu" @click.stop>
                  <div class="morph-menu-content">
                    <label class="morph-item" title="支援最多 10 張 PNG, JPG, GIF">
                      <span class="morph-item-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </span>
                      <span>上傳圖片 (最多10張)</span>
                      <input
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/gif"
                        style="display: none"
                        @change="handleFilesSelected"
                      />
                    </label>
                  </div>
                </div>
              </transition>
            </div>

            <textarea
              ref="drawerInputRef"
              v-model="inputContent"
              class="drawer-textarea"
              placeholder="輸入回覆給學生的訊息... (Enter 發送)"
              rows="1"
              @keydown.enter.exact.prevent="handleSendFromTa"
              @input="adjustDrawerInputHeight"
            ></textarea>

            <button
              class="drawer-send-btn compose-send-btn"
              type="button"
              :disabled="isSending || (!inputContent.trim() && !attachedFiles.length)"
              title="發送"
              aria-label="發送訊息"
              @click="handleSendFromTa"
            >
              <div class="state state--sent">
                <div class="icon">
                  <svg width="1.4em" height="1.4em" viewBox="0 0 24 24" fill="none">
                    <path d="M14.2199 21.63C13.0399 21.63 11.3699 20.8 10.0499 16.83L9.32988 14.67L7.16988 13.95C3.20988 12.63 2.37988 10.96 2.37988 9.78001C2.37988 8.61001 3.20988 6.93001 7.16988 5.60001L15.6599 2.77001C17.7799 2.06001 19.5499 2.27001 20.6399 3.35001C21.7299 4.43001 21.9399 6.21001 21.2299 8.33001L18.3999 16.82C17.0699 20.8 15.3999 21.63 14.2199 21.63Z" fill="currentColor"></path>
                  </svg>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- 訊息收回確認彈窗 (Modal-Card 動畫) -->
      <transition name="sys-modal">
        <div v-if="msgToRecall" class="chat-inner-modal-backdrop" @click="cancelRecall">
          <div class="history-modal-card chat-inner-modal-card" role="dialog" aria-modal="true" @click.stop>
            <div class="modal-header">
              <div class="modal-title-group">
                <div class="modal-badge-icon recall-badge">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9.5"></circle>
                    <polyline points="10.5 14 7.5 11 10.5 8"></polyline>
                    <path d="M16 15.5v-1.5a3 3 0 0 0-3-3H7.5"></path>
                  </svg>
                </div>
                <div>
                  <h3 class="modal-title">收回此訊息？</h3>
                  <p class="modal-sub">
                    確定要收回這則訊息嗎？收回後學生端將保留「此訊息已被收回」提示。
                  </p>
                </div>
              </div>
            </div>

            <!-- 欲收回訊息預覽 -->
            <div v-if="msgToRecall.content || msgToRecall.attachment_url" class="recall-preview-box">
              <span v-if="msgToRecall.content" class="recall-preview-text">"{{ msgToRecall.content }}"</span>
              <span v-else class="recall-preview-attach">［{{ msgToRecall.attachment_name || '圖片附件' }}］</span>
            </div>

            <div class="modal-footer recall-modal-footer">
              <button
                type="button"
                class="btn-modal-cancel"
                @click="cancelRecall"
              >
                取消
              </button>
              <button
                type="button"
                class="btn-modal-confirm-recall"
                :disabled="isRecalling"
                @click="executeRecall"
              >
                {{ isRecalling ? '收回中...' : '確定收回' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </aside>

    <!-- 圖片放大 Lightbox (支援上一張/下一張 Gallery 導覽) -->
    <transition name="image-zoom">
      <div
        v-if="zoomedImage"
        class="chat-image-zoom-overlay"
        @click="zoomedImage = null"
      >
        <div
          class="chat-zoomed-container"
          :class="`origin-${zoomedImageOrigin}`"
          @click.stop
        >
          <!-- 圖片多張時顯示計數與左右導覽按鈕 -->
          <span v-if="galleryImages.length > 1" class="zoom-counter-badge">
            {{ galleryCurrentIndex + 1 }} / {{ galleryImages.length }}
          </span>

          <button
            v-if="galleryImages.length > 1"
            class="zoom-nav-btn zoom-prev-btn"
            type="button"
            title="上一張 (←)"
            @click.stop="prevGalleryImage"
          >‹</button>

          <button
            v-if="galleryImages.length > 1"
            class="zoom-nav-btn zoom-next-btn"
            type="button"
            title="下一張 (→)"
            @click.stop="nextGalleryImage"
          >›</button>

          <img :src="zoomedImage" alt="放大圖片" class="zoomed-img" />
          <button class="zoom-close-btn" type="button" title="關閉 (Esc)" @click="zoomedImage = null">✕</button>
          <a
            :href="zoomedImage"
            download="image.png"
            target="_blank"
            class="zoom-download-btn"
            title="下載原圖"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>下載原圖</span>
          </a>
        </div>
      </div>
    </transition>

    <!-- Toast -->
    <transition name="fade">
      <div v-if="toastText" class="chat-copy-toast">{{ toastText }}</div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  type ChatMessage,
  type TaConversationSummary,
  fetchTaConversations,
  fetchStudentMessages,
  sendMessage,
  uploadAttachment,
  uploadMultipleAttachments,
  getMessageAttachments,
  recallMessage,
  deleteMessage,
  toggleLikeMessage,
  markConversationAsRead,
} from '../chatService'
import { renderMarkdown } from '../markdown'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'unread-update', count: number): void
}>()

// ── 附件資料結構 ──
interface AttachedFileItem {
  id: string
  file: File
  preview: string
  name: string
}

const currentView = ref<'list' | 'thread'>('list')
const conversations = ref<TaConversationSummary[]>([])
const activeStudent = ref<TaConversationSummary | null>(null)
const messages = ref<ChatMessage[]>([])
const searchQuery = ref('')
const isLoadingList = ref(false)
const isLoadingMessages = ref(false)
const inputContent = ref('')
const attachedFiles = ref<AttachedFileItem[]>([])
const isSending = ref(false)
const isOptionMenuOpen = ref(false)
const replyingMsg = ref<ChatMessage | null>(null)
const isDraggingOver = ref(false)
let dragCounter = 0

// ── 訊息收回確認狀態 ──
const msgToRecall = ref<ChatMessage | null>(null)
const isRecalling = ref(false)

// 圖片放大 Lightbox & Gallery 導覽
const zoomedImage = ref<string | null>(null)
const zoomedImageOrigin = ref<'bottom-right' | 'bottom-left'>('bottom-right')
const galleryImages = ref<string[]>([])
const galleryCurrentIndex = ref(0)

// 懸停計時器 (1秒)
const isHoverTooltipReady = ref(false)
const hoveredActionKey = ref<string | null>(null)
let actionBarHoverTimer: ReturnType<typeof setTimeout> | null = null

// Toast
const toastText = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

const threadScrollRef = ref<HTMLElement | null>(null)
const drawerInputRef = ref<HTMLTextAreaElement | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null
let imageObserver: IntersectionObserver | null = null

const filteredConversations = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return conversations.value
  return conversations.value.filter(
    (c) =>
      c.student_name.toLowerCase().includes(q) ||
      c.student_id.toLowerCase().includes(q) ||
      c.last_message.toLowerCase().includes(q),
  )
})

function handleGlobalClick(e: MouseEvent) {
  if (isOptionMenuOpen.value) {
    const target = e.target as HTMLElement
    if (!target.closest('.project-option-btn-wrap')) {
      isOptionMenuOpen.value = false
    }
  }
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (msgToRecall.value) {
      cancelRecall()
      return
    }
    if (isOptionMenuOpen.value) {
      isOptionMenuOpen.value = false
      return
    }
    if (zoomedImage.value) {
      zoomedImage.value = null
      return
    }
  }

  // 燈箱左右切換上一張/下一張圖片
  if (zoomedImage.value) {
    if (e.key === 'ArrowLeft') {
      prevGalleryImage()
      return
    }
    if (e.key === 'ArrowRight') {
      nextGalleryImage()
      return
    }
  }
}

function adjustDrawerInputHeight() {
  const el = drawerInputRef.value
  if (!el) return

  const text = inputContent.value || ''
  if (!text.trim()) {
    el.style.height = '24px'
    el.style.overflowY = 'hidden'
    return
  }

  el.style.height = 'auto'
  const scrollH = el.scrollHeight
  const targetH = Math.min(Math.max(scrollH, 24), 120)
  el.style.height = `${targetH}px`
  el.style.overflowY = scrollH > 120 ? 'auto' : 'hidden'
}

function resetInputHeight() {
  if (drawerInputRef.value) {
    drawerInputRef.value.style.height = '24px'
    drawerInputRef.value.style.overflowY = 'hidden'
  }
}

watch(inputContent, (val) => {
  if (!val || !val.trim()) {
    resetInputHeight()
  } else {
    nextTick(() => {
      adjustDrawerInputHeight()
    })
  }
})

function preventWindowDrop(e: DragEvent) {
  e.preventDefault()
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick)
  window.addEventListener('keydown', handleGlobalKeyDown)
  window.addEventListener('dragover', preventWindowDrop)
  window.addEventListener('drop', preventWindowDrop)
  loadConversations()
  pollTimer = setInterval(() => {
    refreshDataSilently()
  }, 5000)
})

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick)
  window.removeEventListener('keydown', handleGlobalKeyDown)
  window.removeEventListener('dragover', preventWindowDrop)
  window.removeEventListener('drop', preventWindowDrop)
  if (pollTimer) clearInterval(pollTimer)
  if (imageObserver) imageObserver.disconnect()
})

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      loadConversations()
      if (currentView.value === 'thread' && activeStudent.value) {
        loadThreadMessages(activeStudent.value.student_id)
      }
    }
  },
)

async function loadConversations() {
  isLoadingList.value = true
  try {
    const list = await fetchTaConversations()
    conversations.value = list
    const totalUnread = list.reduce((acc, cur) => acc + (cur.has_unread ? cur.unread_count : 0), 0)
    emit('unread-update', totalUnread)
  } finally {
    isLoadingList.value = false
  }
}

async function refreshDataSilently() {
  const list = await fetchTaConversations()
  conversations.value = list
  const totalUnread = list.reduce((acc, cur) => acc + (cur.has_unread ? cur.unread_count : 0), 0)
  emit('unread-update', totalUnread)

  if (currentView.value === 'thread' && activeStudent.value) {
    const thread = await fetchStudentMessages(activeStudent.value.student_id)
    messages.value = thread
    nextTick(() => setupIntersectionObserver())
  }
}

function selectStudent(student: TaConversationSummary) {
  activeStudent.value = student
  currentView.value = 'thread'
  loadThreadMessages(student.student_id)
}

function backToList() {
  currentView.value = 'list'
  activeStudent.value = null
  replyingMsg.value = null
  clearAttachments()
  loadConversations()
}

async function loadThreadMessages(studentId: string) {
  isLoadingMessages.value = true
  try {
    const list = await fetchStudentMessages(studentId)
    messages.value = list
    await markConversationAsRead(studentId, 'ta')
    // 更新清單中的未讀狀態
    const target = conversations.value.find((c) => c.student_id === studentId)
    if (target) {
      target.has_unread = false
      target.unread_count = 0
    }
  } finally {
    isLoadingMessages.value = false
    nextTick(() => {
      scrollToBottom()
      setupIntersectionObserver()
    })
  }
}

function processFiles(files: File[]) {
  if (!files.length) return

  const MAX_ATTACHMENTS = 10
  const currentCount = attachedFiles.value.length

  if (currentCount >= MAX_ATTACHMENTS) {
    showToast('⚠️ 附件已達 10 張上限，無法再加入更多圖片！')
    isOptionMenuOpen.value = false
    return
  }

  const remainingSlots = MAX_ATTACHMENTS - currentCount
  let validFiles: File[] = []
  let hasInvalidType = false
  let hasTooLarge = false

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      hasInvalidType = true
      continue
    }
    if (file.size > 5 * 1024 * 1024) {
      hasTooLarge = true
      continue
    }
    validFiles.push(file)
  }

  if (hasInvalidType) {
    showToast('⚠️ 僅支援圖片格式（PNG, JPG, GIF 等）！')
  }
  if (hasTooLarge) {
    showToast('⚠️ 部分圖片超過 5MB 限制，已為您略過！')
  }

  if (validFiles.length > remainingSlots) {
    showToast(`⚠️ 附件最多支援 10 張圖片，已為您加入前 ${remainingSlots} 張！`)
    validFiles = validFiles.slice(0, remainingSlots)
  }

  validFiles.forEach((file) => {
    const reader = new FileReader()
    const itemId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    reader.onload = () => {
      attachedFiles.value.push({
        id: itemId,
        file,
        preview: String(reader.result),
        name: file.name,
      })
    }
    reader.readAsDataURL(file)
  })

  isOptionMenuOpen.value = false
}

function handleFilesSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  processFiles(files)
  target.value = ''
}

// ── 對話框拖曳圖片事件 ──
function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (currentView.value !== 'thread') return
  if (e.dataTransfer?.types?.includes('Files')) {
    dragCounter++
    isDraggingOver.value = true
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (currentView.value !== 'thread') return
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDraggingOver.value = false
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  dragCounter = 0
  isDraggingOver.value = false
  if (currentView.value !== 'thread') return

  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length) {
    processFiles(files)
  }
}

function removeAttachment(index: number) {
  attachedFiles.value.splice(index, 1)
}

function clearAttachments() {
  attachedFiles.value = []
}

async function handleSendFromTa() {
  if (!activeStudent.value) return
  const text = inputContent.value.trim()
  if (!text && !attachedFiles.value.length) return
  if (isSending.value) return

  isSending.value = true
  try {
    let uploadedAttachUrl: string | null = null
    let uploadedAttachType: string | null = null
    let uploadedAttachName: string | null = null

    if (attachedFiles.value.length === 1) {
      const up = await uploadAttachment(attachedFiles.value[0].file)
      uploadedAttachUrl = up.url
      uploadedAttachType = up.type
      uploadedAttachName = up.name
    } else if (attachedFiles.value.length > 1) {
      const ups = await uploadMultipleAttachments(attachedFiles.value.map((f) => f.file))
      uploadedAttachUrl = JSON.stringify(ups)
      uploadedAttachType = 'images'
      uploadedAttachName = `${ups.length} 張圖片`
    }

    const saved = await sendMessage({
      student_id: activeStudent.value.student_id,
      student_name: activeStudent.value.student_name,
      sender_role: 'ta',
      content: text,
      attachment_url: uploadedAttachUrl,
      attachment_name: uploadedAttachName,
      attachment_type: uploadedAttachType,
      reply_to_id: replyingMsg.value?.id || null,
    })

    messages.value.push(saved)
    inputContent.value = ''
    clearAttachments()
    replyingMsg.value = null

    nextTick(() => {
      scrollToBottom()
      setupIntersectionObserver()
    })
  } catch (err) {
    console.error('助教發送失敗:', err)
  } finally {
    isSending.value = false
  }
}

async function handleLike(msg: ChatMessage) {
  if (!msg.liked_by) msg.liked_by = []
  const wasLiked = msg.liked_by.includes('ta')
  const prevLikes = msg.likes
  const prevLikedBy = [...msg.liked_by]

  // 1. 立即更新外觀效果 (Optimistic UI)
  if (wasLiked) {
    msg.likes = Math.max(0, msg.likes - 1)
    msg.liked_by = msg.liked_by.filter((id) => id !== 'ta')
  } else {
    msg.likes = msg.likes + 1
    msg.liked_by.push('ta')
  }

  // 2. 等待資料庫彙整完畢，若失敗則回滾
  try {
    const res = await toggleLikeMessage(msg.id, 'ta')
    msg.likes = res.likes
    if (!msg.liked_by) msg.liked_by = []
    if (res.isLiked && !msg.liked_by.includes('ta')) {
      msg.liked_by.push('ta')
    } else if (!res.isLiked) {
      msg.liked_by = msg.liked_by.filter((id) => id !== 'ta')
    }
  } catch (err) {
    console.error('助教按讚更新失敗:', err)
    msg.likes = prevLikes
    msg.liked_by = prevLikedBy
  }
}

function isMsgLiked(msg: ChatMessage): boolean {
  return Array.isArray(msg.liked_by) && msg.liked_by.includes('ta')
}

function handleRecall(msg: ChatMessage) {
  msgToRecall.value = msg
}

function cancelRecall() {
  msgToRecall.value = null
}

async function executeRecall() {
  if (!msgToRecall.value) return
  const target = msgToRecall.value
  isRecalling.value = true
  try {
    const isOnlyOne = messages.value.length === 1
    if (isOnlyOne) {
      // 若只有一則訊息時收回訊息將直接刪除該訊息使得沒有對話紀錄
      const success = await deleteMessage(target.id)
      if (success) {
        messages.value = []
        if (activeStudent.value) {
          activeStudent.value.last_message = ''
        }
        showToast('訊息已收回')
      } else {
        showToast('⚠️ 收回失敗，請稍後再試')
      }
    } else {
      const success = await recallMessage(target.id)
      if (success) {
        target.is_recalled = true
        target.content = ''
        target.attachment_url = null
        showToast('訊息已收回')
      } else {
        showToast('⚠️ 收回失敗，請稍後再試')
      }
    }
  } catch (err) {
    console.error('收回失敗:', err)
    showToast('⚠️ 收回失敗')
  } finally {
    isRecalling.value = false
    msgToRecall.value = null
  }
}

function handleCopyText(text: string) {
  if (!navigator.clipboard) return
  navigator.clipboard.writeText(text).then(() => showToast('已複製到剪貼簿'))
}

function handleQuote(msg: ChatMessage) {
  replyingMsg.value = msg
  nextTick(() => drawerInputRef.value?.focus())
}

function handleDownloadImage(url: string, fileName: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function startActionBarHover(_msgId?: number) {
  if (actionBarHoverTimer) clearTimeout(actionBarHoverTimer)
  isHoverTooltipReady.value = false
  actionBarHoverTimer = setTimeout(() => {
    isHoverTooltipReady.value = true
  }, 1000)
}

function stopActionBarHover() {
  if (actionBarHoverTimer) {
    clearTimeout(actionBarHoverTimer)
    actionBarHoverTimer = null
  }
  isHoverTooltipReady.value = false
  hoveredActionKey.value = null
}

function setupIntersectionObserver() {
  if (typeof IntersectionObserver === 'undefined') return
  if (imageObserver) imageObserver.disconnect()

  imageObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const wrap = entry.target as HTMLElement
          const img = wrap.querySelector<HTMLImageElement>('img.chat-lazy-image')
          if (img && img.dataset.src && !img.src) {
            img.src = img.dataset.src
          }
          observer.unobserve(wrap)
        }
      })
    },
    { root: threadScrollRef.value, threshold: 0.1 },
  )

  const wraps = threadScrollRef.value?.querySelectorAll('.chat-image-wrap, .chat-stack-img-wrap') || []
  wraps.forEach((w) => imageObserver?.observe(w))
}

function onImageLoaded(e: Event) {
  const img = e.target as HTMLImageElement
  img.classList.add('is-loaded')
  const wrap = img.closest('.chat-image-wrap, .chat-stack-img-wrap')
  const skeleton = wrap?.querySelector('.chat-image-skeleton') as HTMLElement
  if (skeleton) skeleton.style.display = 'none'
}

function openGallery(images: Array<{ url: string } | string>, startIndex = 0, origin: 'bottom-right' | 'bottom-left' = 'bottom-right') {
  galleryImages.value = images.map((item) => (typeof item === 'string' ? item : item.url))
  galleryCurrentIndex.value = Math.max(0, Math.min(startIndex, galleryImages.value.length - 1))
  zoomedImage.value = galleryImages.value[galleryCurrentIndex.value] || null
  zoomedImageOrigin.value = origin
}

function prevGalleryImage() {
  if (galleryImages.value.length <= 1) return
  galleryCurrentIndex.value = (galleryCurrentIndex.value - 1 + galleryImages.value.length) % galleryImages.value.length
  zoomedImage.value = galleryImages.value[galleryCurrentIndex.value]
}

function nextGalleryImage() {
  if (galleryImages.value.length <= 1) return
  galleryCurrentIndex.value = (galleryCurrentIndex.value + 1) % galleryImages.value.length
  zoomedImage.value = galleryImages.value[galleryCurrentIndex.value]
}

// 取得前台堆疊展示的照片清單 (最多 5 張：若超過 5 張則取前 4 張，第 5 張為「+N」卡片)
function getVisibleAttachments(msg: ChatMessage) {
  const atts = getMessageAttachments(msg)
  if (atts.length <= 5) {
    return atts
  }
  return atts.slice(0, 4)
}

function getStackZIndex(msg: ChatMessage, aIdx: number) {
  const total = Math.min(getMessageAttachments(msg).length, 5)
  return total - aIdx
}

function getQuotedMsg(replyId: number): ChatMessage | undefined {
  return messages.value.find((m) => m.id === replyId)
}

function scrollToMsg(replyId: number) {
  const el = document.getElementById(`ta-msg-${replyId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('highlight-flash')
    setTimeout(() => el.classList.remove('highlight-flash'), 1200)
  }
}

function scrollToBottom() {
  if (threadScrollRef.value) {
    threadScrollRef.value.scrollTop = threadScrollRef.value.scrollHeight
  }
}

function formatTime(isoStr?: string): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function formatTimeAgo(isoStr?: string): string {
  if (!isoStr) return ''
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時前`
  return `${Math.floor(hours / 24)} 天前`
}

function showToast(text: string) {
  if (toastTimer) clearTimeout(toastTimer)
  toastText.value = text
  toastTimer = setTimeout(() => {
    toastText.value = ''
    toastTimer = null
  }, 2000)
}
</script>

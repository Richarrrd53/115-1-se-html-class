<template>
  <div class="contact-chat-wrapper">
    <!-- ══════════════════════════════════════════════════════════
         1. 全域背景模糊光場與上方懸浮標題 (StoryboardAI2 ai-creation-layer)
         ══════════════════════════════════════════════════════════ -->
    <div
      v-if="!isChatDrawerOpen"
      class="ai-creation-layer"
      :class="isCapsuleExpanded ? 'state-quick-compose' : 'state-closed'"
    >
      <!-- 全螢幕定向毛玻璃背景模糊 (Directional Frosted Focus Field) -->
      <div class="ai-focus-field" id="ai-focus-field" @click="closeQcCard"></div>

      <!-- 上方懸浮文字卡片 (Anchored above capsule, sequentially floats up) -->
      <div
        class="quick-creation-container"
        id="quick-creation-container"
        :style="{ bottom: isCapsuleExpanded ? `${28 + capsuleHeight + 12}px` : undefined }"
      >
        <div class="qc-card">
          <div class="qc-header">
            <div class="qc-brand">
              <span class="qc-sparkle"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracurrentColorerCarrier" stroke-linecurrentcap="round" stroke-linejoin="round"></g><g id="SVGRepo_icurrentColoronCarrier"> <path d="M8 10.5H16M8 14.5H11M21.0039 12C21.0039 16.9706 16.9745 21 12.0039 21C9.9675 21 3.00463 21 3.00463 21C3.00463 21 4.56382 17.2561 3.93982 16.0008C3.34076 14.7956 3.00391 13.4372 3.00391 12C3.00391 7.02944 7.03334 3 12.0039 3C16.9745 3 21.0039 7.02944 21.0039 12Z" stroke="currentColor" stroke-width="2" stroke-linecurrentcap="round" stroke-linejoin="round"></path> </g></svg></span>
              <span class="qc-title">聯絡我們</span>
            </div>
            <button
              class="qc-close-btn"
              id="qc-close-btn"
              type="button"
              title="關閉 (Esc)"
              aria-label="關閉"
              @click.stop="closeQcCard"
            >✕</button>
          </div>

          <div class="qc-intro">
            <h3 class="qc-greeting">聯絡我們</h3>
            <p class="qc-sub">有任何問題、發現BUG都可以留言在這裡，或是單純想和助教聊天也可以( ﾟ∀ﾟ)</p>
          </div>

          <!-- 附件預覽標籤 (支援多圖 30% 堆疊遮擋與懸停展開) -->
          <div v-if="attachedFiles.length" class="qc-attachment-chip" :class="{ 'is-multiple': attachedFiles.length > 1 }">
            <!-- 單圖 -->
            <div v-if="attachedFiles.length === 1" class="qc-single-thumb-wrap" style="position: relative;">
              <img :src="attachedFiles[0].preview" :alt="attachedFiles[0].name" class="chip-thumb" />
              <span class="chip-name">{{ attachedFiles[0].name }}</span>
              <button class="chip-remove-btn" type="button" title="移除圖片" @click.stop="removeAttachment(0)">✕</button>
            </div>
            <!-- 多圖堆疊 -->
            <div v-else class="qc-multi-stack-wrap">
              <div class="qc-stack-track">
                <div
                  v-for="(item, idx) in attachedFiles"
                  :key="item.id"
                  class="qc-stack-thumb-wrap"
                  :style="{ zIndex: attachedFiles.length - idx }"
                >
                  <img :src="item.preview" :alt="item.name" class="chip-thumb-multi" />
                  <button class="qc-thumb-del-btn" type="button" title="移除此圖片" @click.stop="removeAttachment(idx)">✕</button>
                </div>
              </div>
              <div class="qc-stack-badge">
                <span>{{ attachedFiles.length }}/10 張圖片</span>
                <button class="qc-clear-all-btn" type="button" title="全部清空" @click.stop="clearAttachments">清空</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════
         2. Persistent Unified Morphing Capsule (按鈕形變成橫向膠囊輸入框)
         ══════════════════════════════════════════════════════════ -->
    <div
      v-if="!isChatDrawerOpen"
      id="global-create-capsule"
      class="ai-unified-capsule"
      :class="{ 'is-expanded': isCapsuleExpanded }"
      :style="{ height: isCapsuleExpanded ? `${capsuleHeight}px` : undefined }"
      @click="handleCapsuleClick"
    >
      <!-- 閒置彩色旋轉環繞光暈層 (Conic Glow Aura) -->
      <div v-show="!isCapsuleExpanded" class="ai-pill-btn-glow-ambient">
        <div class="ai-pill-btn-glow-rotator"></div>
      </div>
      <div v-show="!isCapsuleExpanded" class="ai-pill-btn-glow-container">
        <div class="ai-pill-btn-glow-rotator"></div>
      </div>

      <!-- 按鈕面 (Button Face) -->
      <div class="capsule-btn-face" id="global-create-trigger" role="button" tabindex="0" aria-label="聯絡我們">
        <span class="ai-pill-spark"><span class="ai-spark-desktop"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracurrentColorerCarrier" stroke-linecurrentcap="round" stroke-linejoin="round"></g><g id="SVGRepo_icurrentColoronCarrier"> <path d="M8 10.5H16M8 14.5H11M21.0039 12C21.0039 16.9706 16.9745 21 12.0039 21C9.9675 21 3.00463 21 3.00463 21C3.00463 21 4.56382 17.2561 3.93982 16.0008C3.34076 14.7956 3.00391 13.4372 3.00391 12C3.00391 7.02944 7.03334 3 12.0039 3C16.9745 3 21.0039 7.02944 21.0039 12Z" stroke="currentColor" stroke-width="2" stroke-linecurrentcap="round" stroke-linejoin="round"></path> </g></svg></span></span>
        <span class="ai-pill-text">聯絡我們</span>
        <span v-if="unreadCount > 0" class="capsule-unread-badge">{{ unreadCount }}</span>
      </div>

      <!-- 輸入面 (Input Face - 橫向膠囊輸入框) -->
      <div
        class="capsule-input-face"
        id="qc-composer-area"
        :class="{ 'is-drag-over': isQcDraggingOver }"
        @click.stop
        @dragenter="handleQcDragEnter"
        @dragover="handleQcDragOver"
        @dragleave="handleQcDragLeave"
        @drop="handleQcDrop"
      >
        <!-- QC 拖曳圖片上傳遮罩 -->
        <transition name="fade-fast">
          <div v-if="isQcDraggingOver" class="qc-drag-overlay">
            <span class="qc-drag-text">✦ 放開以加入圖片附件</span>
          </div>
        </transition>

        <!-- 「+」附件按鈕 (仿造 StoryboardAI2 project-card option-btn) -->
        <div class="project-option-btn-wrap">
          <button
            class="project-option-btn"
            :class="{ 'is-active': isOptionMenuOpen }"
            type="button"
            title="新增圖片附件 (最多10張)"
            @click.stop="toggleOptionMenu"
          >
            <span class="option-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </span>
          </button>

          <!-- Option 彈出選單 (仿造 StoryboardAI2 global-project-option-menu) -->
          <transition name="morph-menu-pop">
            <div v-if="isOptionMenuOpen" class="global-project-option-menu is-content-visible" @click.stop>
              <div class="morph-menu-content">
                <label class="morph-item" title="支援最多 10 張 PNG, JPG, GIF">
                  <span class="morph-item-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </span>
                  <span>上傳圖片附件 (最多10張)</span>
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

        <!-- 橫向膠囊輸入框 -->
        <textarea
          ref="qcInputRef"
          v-model="inputContent"
          class="qc-textarea"
          placeholder="描述問題或想和助教說的話... ✦"
          rows="1"
          @keydown.enter.exact.prevent="handleSubmitFromQc"
          @input="adjustQcInputHeight"
        ></textarea>

        <!-- 送出按鈕 (compose-send-btn) -->
        <button
          class="qc-send-btn compose-send-btn"
          id="qc-send-btn"
          type="button"
          :disabled="isSending || (!inputContent.trim() && !attachedFiles.length)"
          aria-label="發送訊息"
          @click.stop="handleSubmitFromQc"
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

    <!-- ══════════════════════════════════════════════════════════
         3. 聊天對話框 (Chat Drawer) - 自畫面最右邊滑入
         ══════════════════════════════════════════════════════════ -->
    <aside
      class="chat-drawer"
      :class="{ 'is-open': isChatDrawerOpen, 'is-drag-over': isDraggingOver }"
      aria-label="聯絡助教聊天視窗"
      @dragenter="handleDragEnter"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- 拖曳圖片上傳提示遮罩 (Drag & Drop Overlay) -->
      <transition name="fade-fast">
        <div v-if="isDraggingOver" class="chat-drag-overlay">
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

      <!-- 對話框頂部 Bar -->
      <div class="chat-drawer-header">
        <div class="header-left">
          <div class="chat-avatar-badge">TA</div>
          <div class="header-titles">
            <h3 class="chat-title">助教線上諮詢</h3>
            <span class="chat-status-text">
              <span class="presence-dot-mini"></span>
              {{ studentName ? `你正以 ${studentName} 的身分對話` : '在線諮詢' }}
            </span>
          </div>
        </div>
        <button
          class="chat-close-btn"
          type="button"
          title="收起對話框"
          @click="closeChatDrawer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════
           4. 對話框內部彈窗：密碼設定 / 密碼解鎖 (Modal-Card 動畫)
           ══════════════════════════════════════════════════════ -->
      <transition name="sys-modal">
        <div v-if="showPasswordModal" class="chat-inner-modal-backdrop" @click.stop>
          <div class="history-modal-card chat-modal-card chat-inner-modal-card" role="dialog" aria-modal="true">
            <div class="modal-header">
              <div class="modal-title-group">
                <div class="modal-badge-icon lock-badge">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <div>
                  <h3 class="modal-title">{{ isSettingPassword ? '設定個人訊息防護密碼' : '解鎖對話訊息紀錄' }}</h3>
                  <p class="modal-sub">
                    {{ isSettingPassword ? '為保障對話隱私與個資安全，首次發送請設定 4~12 位專屬密碼' : '請輸入您設定的密碼以解鎖並檢視歷史對話內容' }}
                  </p>
                </div>
              </div>
            </div>

            <form class="modal-form" @submit.prevent="handlePasswordSubmit">
              <div class="modal-field">
                <label class="modal-label">防護密碼</label>
                <input
                  ref="passwordInputRef"
                  v-model="passwordInput"
                  type="password"
                  class="modal-input"
                  placeholder="請輸入密碼"
                  required
                  autofocus
                />
              </div>

              <div v-if="isSettingPassword" class="modal-field">
                <label class="modal-label">確認密碼</label>
                <input
                  v-model="passwordConfirmInput"
                  type="password"
                  class="modal-input"
                  placeholder="請再次輸入相同密碼"
                  required
                />
              </div>

              <p v-if="passwordError" class="modal-error-text" role="alert">{{ passwordError }}</p>

              <div class="modal-footer">
                <button
                  v-if="!isSettingPassword"
                  type="button"
                  class="btn btn-outline"
                  @click="closeChatDrawer"
                >
                  取消
                </button>
                <button
                  class="btn btn-primary"
                  type="submit"
                  :disabled="isVerifyingPassword"
                >
                  {{ isVerifyingPassword ? '處理中...' : (isSettingPassword ? '儲存並保護' : '解鎖進入') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </transition>

      <!-- ══════════════════════════════════════════════════════
           4.1 訊息收回確認彈窗 (Modal-Card 動畫)
           ══════════════════════════════════════════════════════ -->
      <transition name="sys-modal">
        <div v-if="msgToRecall" class="chat-inner-modal-backdrop" @click="cancelRecall">
          <div class="history-modal-card chat-modal-card chat-inner-modal-card" role="dialog" aria-modal="true" @click.stop>
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
                    確定要收回這則訊息嗎？收回後聊天室將保留「此訊息已被收回」提示。
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

      <!-- ══════════════════════════════════════════════════════
           5. 訊息對話串 (Message Stream)
           ══════════════════════════════════════════════════════ -->
      <div ref="messageListRef" class="chat-message-list">
        <!-- 無訊息提示 -->
        <div v-if="!isLoadingMessages && !messages.length" class="chat-empty-hint">
          <div class="empty-sparkle">✦</div>
          <p class="empty-title">目前尚無對話紀錄</p>
          <p class="empty-sub">在下方輸入訊息，助教會盡快為您解答！</p>
        </div>

        <!-- 訊息清單 -->
        <div
          v-for="msg in messages"
          :key="msg.id"
          :id="`msg-${msg.id}`"
          class="chat-msg-row"
          :class="[
            msg.sender_role === 'student' ? 'row-me' : 'row-them',
            { 'is-recalled-row': msg.is_recalled }
          ]"
        >
          <!-- 對方 (助教) 頭像 -->
          <div v-if="msg.sender_role === 'ta'" class="chat-msg-avatar">TA</div>

          <!-- 訊息主體 -->
          <div class="chat-bubble-wrap">
            <!-- 引用內容卡片 (Reply Header) -->
            <div
              v-if="msg.reply_to_id && getQuotedMsg(msg.reply_to_id)"
              class="quote-preview-pill"
              @click="scrollToMsg(msg.reply_to_id)"
            >
              <div class="quote-bar"></div>
              <div class="quote-info">
                <span class="quote-sender">
                  {{ getQuotedMsg(msg.reply_to_id)?.sender_role === 'student' ? (getQuotedMsg(msg.reply_to_id)?.student_name || '我') : '助教' }}
                </span>
                <span class="quote-snippet">
                  {{ getQuotedMsg(msg.reply_to_id)?.is_recalled ? '（訊息已收回）' : (getQuotedMsg(msg.reply_to_id)?.content || '［圖片附件］') }}
                </span>
              </div>
            </div>

            <!-- 收回狀態：虛線外框顯示已刪除訊息 -->
            <div v-if="msg.is_recalled" class="recalled-msg-bubble">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
              </svg>
              <span>此訊息已被收回</span>
            </div>

            <!-- 正常訊息氣泡 (Q 彈動畫 cubic-bezier(.33,1.53,.69,.99)) -->
            <div v-else class="chat-bubble" :class="msg.sender_role === 'student' ? 'bubble-me' : 'bubble-them'">
              <!-- 圖片附件 (單圖或多圖 30% 堆疊遮擋) -->
              <!-- 圖片附件 (單圖或多圖最多 5 張堆疊遮擋，超過 5 張以 4 張 +「+N」呈現) -->
              <template v-if="getMessageAttachments(msg).length === 1">
                <div
                  class="chat-image-wrap"
                  :data-img-src="getMessageAttachments(msg)[0].url"
                  @click="openGallery(getMessageAttachments(msg), 0, msg.sender_role === 'student' ? 'bottom-right' : 'bottom-left')"
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
                      @click.stop="openGallery(getMessageAttachments(msg), aIdx, msg.sender_role === 'student' ? 'bottom-right' : 'bottom-left')"
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
                      @click.stop="openGallery(getMessageAttachments(msg), 4, msg.sender_role === 'student' ? 'bottom-right' : 'bottom-left')"
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

            <!-- ══════════════════════════════════════════════
                 6. 訊息功能操作工具列容器 (無佔位，hover 氣泡上移顯示，含對話時間)
                 ══════════════════════════════════════════════ -->
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
                    <!-- SVGRepo Heart -->
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </button>
                  <span v-if="isHoverTooltipReady && hoveredActionKey === `${msg.id}-like`" class="action-tooltip">
                    {{ isMsgLiked(msg) ? '取消讚' : '按讚' }}
                  </span>
                </div>

                <!-- 2. 收回 (Recall, 圓形外框 + 類似引用的弧形箭頭) -->
                <div v-if="msg.sender_role === 'student'" class="action-btn-item">
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

                <!-- 3. 下載 (Download, 若為圖片) -->
                <div v-if="msg.attachment_url" class="action-btn-item">
                  <button
                    class="msg-action-btn"
                    type="button"
                    @click="handleDownloadImage(msg.attachment_url, msg.attachment_name || 'image.png')"
                    @mouseenter="hoveredActionKey = `${msg.id}-download`"
                    @mouseleave="hoveredActionKey = null"
                  >
                    <!-- SVGRepo Download -->
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

                <!-- 4. 複製 (Copy, 若有文字) -->
                <div v-if="msg.content" class="action-btn-item">
                  <button
                    class="msg-action-btn"
                    type="button"
                    @click="handleCopyText(msg.content)"
                    @mouseenter="hoveredActionKey = `${msg.id}-copy`"
                    @mouseleave="hoveredActionKey = null"
                  >
                    <!-- SVGRepo Copy -->
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
                    <!-- SVGRepo Reply/Quote -->
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

      <!-- ══════════════════════════════════════════════════════
           7. 抽屜底端輸入列 (Drawer Composer)
           ══════════════════════════════════════════════════════ -->
      <div class="chat-drawer-footer">
        <!-- 引用提示列 (Quote Banner) -->
        <div v-if="replyingMsg" class="drawer-reply-banner">
          <div class="reply-content">
            <span class="reply-target">回覆 {{ replyingMsg.sender_role === 'student' ? '我' : '助教' }}:</span>
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
              title="新增附件 (最多10張)"
              @click.stop="toggleOptionMenu"
            >
              <span class="option-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </span>
            </button>

            <!-- 彈出選單 -->
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

          <!-- 抽屜輸入框 -->
          <textarea
            ref="drawerInputRef"
            v-model="inputContent"
            class="drawer-textarea"
            placeholder="輸入訊息... (Enter 發送)"
            rows="1"
            @keydown.enter.exact.prevent="handleSubmitFromDrawer"
            @input="adjustDrawerInputHeight"
          ></textarea>

          <!-- 送出按鈕 (與 QC 保持一致之 compose-send-btn) -->
          <button
            class="drawer-send-btn compose-send-btn"
            type="button"
            :disabled="isSending || (!inputContent.trim() && !attachedFiles.length)"
            title="發送訊息"
            aria-label="發送訊息"
            @click="handleSubmitFromDrawer"
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
    </aside>

    <!-- ══════════════════════════════════════════════════════════
         8. 圖片點擊放大 Lightbox 彈窗 (支援上一張/下一張 Gallery 導覽)
         ══════════════════════════════════════════════════════════ -->
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

    <!-- 複製成功微 Toast -->
    <transition name="fade">
      <div v-if="copyToastText" class="chat-copy-toast">
        {{ copyToastText }}
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  type ChatMessage,
  fetchStudentMessages,
  sendMessage,
  uploadAttachment,
  uploadMultipleAttachments,
  getMessageAttachments,
  recallMessage,
  deleteMessage,
  toggleLikeMessage,
  getStudentHasPassword,
  setStudentChatPassword,
  verifyStudentChatPassword,
  checkStudentHasHistory,
  markConversationAsRead,
} from '../chatService'
import { renderMarkdown } from '../markdown'

const props = defineProps<{
  studentId: string
  studentName: string
}>()

const emit = defineEmits<{
  (e: 'require-login'): void
  (e: 'drawer-state-change', isOpen: boolean): void
}>()

// ── 附件資料結構 ──
interface AttachedFileItem {
  id: string
  file: File
  preview: string
  name: string
}

// ── 響應式狀態 ──
const isCapsuleExpanded = ref(false)
const isChatDrawerOpen = ref(false)
const isOptionMenuOpen = ref(false)
const inputContent = ref('')
const capsuleHeight = ref(56)
const attachedFiles = ref<AttachedFileItem[]>([])
const isSending = ref(false)
const isLoadingMessages = ref(false)
const messages = ref<ChatMessage[]>([])
const replyingMsg = ref<ChatMessage | null>(null)
const unreadCount = ref(0)

// ── 密碼防護狀態 ──
const showPasswordModal = ref(false)
const isSettingPassword = ref(false)
const passwordInput = ref('')
const passwordConfirmInput = ref('')
const passwordError = ref('')
const isVerifyingPassword = ref(false)
const isSessionUnlocked = ref(false)

// ── 訊息收回確認狀態 ──
const msgToRecall = ref<ChatMessage | null>(null)
const isRecalling = ref(false)

// ── 拖曳上傳狀態 ──
const isDraggingOver = ref(false)
let dragCounter = 0
const isQcDraggingOver = ref(false)
let qcDragCounter = 0

// ── 圖片放大 Lightbox & Gallery 導覽 ──
const zoomedImage = ref<string | null>(null)
const zoomedImageOrigin = ref<'bottom-right' | 'bottom-left'>('bottom-right')
const galleryImages = ref<string[]>([])
const galleryCurrentIndex = ref(0)

// ── 按鈕列懸停 > 1 秒共享計時器 ──
const isHoverTooltipReady = ref(false)
const hoveredActionKey = ref<string | null>(null)
let actionBarHoverTimer: ReturnType<typeof setTimeout> | null = null

// ── 複製通知 Toast ──
const copyToastText = ref('')
let copyToastTimer: ReturnType<typeof setTimeout> | null = null

// ── DOM 參考 ──
const messageListRef = ref<HTMLElement | null>(null)
const qcInputRef = ref<HTMLTextAreaElement | null>(null)
const drawerInputRef = ref<HTMLTextAreaElement | null>(null)
const passwordInputRef = ref<HTMLInputElement | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null
let imageObserver: IntersectionObserver | null = null

// ── 點擊全域關閉 Option Menu ──
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
    if (isCapsuleExpanded.value) {
      closeQcCard()
      return
    }
    if (zoomedImage.value) {
      zoomedImage.value = null
      return
    }
    if (isChatDrawerOpen.value) {
      closeChatDrawer()
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

function preventWindowDrop(e: DragEvent) {
  e.preventDefault()
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick)
  window.addEventListener('keydown', handleGlobalKeyDown)
  window.addEventListener('dragover', preventWindowDrop)
  window.addEventListener('drop', preventWindowDrop)
  setupIntersectionObserver()
  checkInitialUnread()

  // 每 5 秒輪詢新訊息（支援離線或未啟用 Realtime 之環境）
  pollTimer = setInterval(() => {
    if (props.studentId.trim()) {
      refreshMessagesSilently()
    }
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
  () => props.studentId,
  (newId) => {
    if (newId.trim()) {
      isSessionUnlocked.value = false
      refreshMessagesSilently()
    }
  },
)

// 監聽對話框開啟狀態，與側邊欄進行聯動移出
watch(isChatDrawerOpen, (isOpen) => {
  emit('drawer-state-change', isOpen)
  if (isOpen) {
    nextTick(() => {
      scrollToBottom()
      setupIntersectionObserver()
    })
  }
})

// ── 輸入框換行動態高度調整 (Auto-Grow Height) ──
function adjustQcInputHeight() {
  const el = qcInputRef.value
  if (!el) return

  const text = inputContent.value || ''
  // 初始展開或未輸入文字時，嚴格鎖定初始高度：textarea 28px、膠囊 56px，先不要增高
  if (!text.trim()) {
    el.style.height = '28px'
    el.style.overflowY = 'hidden'
    capsuleHeight.value = 56
    return
  }

  // 使用者有輸入多行內容，才動態測量換行高度
  el.style.height = 'auto'
  const scrollH = el.scrollHeight
  const targetTextH = Math.min(Math.max(scrollH, 28), 130)
  el.style.height = `${targetTextH}px`
  capsuleHeight.value = Math.min(Math.max(targetTextH + 28, 56), 154)
  el.style.overflowY = scrollH > 130 ? 'auto' : 'hidden'
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
  capsuleHeight.value = 56
  if (qcInputRef.value) {
    qcInputRef.value.style.height = '28px'
    qcInputRef.value.style.overflowY = 'hidden'
  }
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
      adjustQcInputHeight()
      adjustDrawerInputHeight()
    })
  }
})

// ── 1. 膠囊點擊邏輯 ──
async function handleCapsuleClick() {
  if (isCapsuleExpanded.value) return

  // 檢查登入
  if (!props.studentId.trim() || !props.studentName.trim()) {
    emit('require-login')
    return
  }

  // 檢查是否有過對話紀錄
  try {
    const hasHistory = await checkStudentHasHistory(props.studentId)
    if (hasHistory) {
      // 有歷史紀錄，直接開啟對話框
      openChatDrawer()
    } else {
      // 沒有紀錄，展開 QC 卡片（保持初始高度 28px/56px，不預先拉長）
      isCapsuleExpanded.value = true
      capsuleHeight.value = 56
      nextTick(() => {
        if (qcInputRef.value) {
          qcInputRef.value.style.height = '28px'
          qcInputRef.value.style.overflowY = 'hidden'
          qcInputRef.value.focus()
        }
      })
    }
  } catch {
    isCapsuleExpanded.value = true
    capsuleHeight.value = 56
    nextTick(() => {
      if (qcInputRef.value) {
        qcInputRef.value.style.height = '28px'
        qcInputRef.value.style.overflowY = 'hidden'
        qcInputRef.value.focus()
      }
    })
  }
}

function closeQcCard() {
  isCapsuleExpanded.value = false
  isOptionMenuOpen.value = false
  inputContent.value = ''
  clearAttachments()
  resetInputHeight()
}

function toggleOptionMenu() {
  isOptionMenuOpen.value = !isOptionMenuOpen.value
}

// ── 2. 開啟對話框與密碼驗證流程 ──
async function openChatDrawer() {
  isCapsuleExpanded.value = false
  isChatDrawerOpen.value = true

  // 檢查密碼
  const hasPassword = await getStudentHasPassword(props.studentId)
  if (hasPassword && !isSessionUnlocked.value) {
    // 需要密碼解鎖
    isSettingPassword.value = false
    showPasswordModal.value = true
    passwordInput.value = ''
    passwordError.value = ''
    nextTick(() => {
      passwordInputRef.value?.focus()
    })
  } else {
    // 直接載入訊息
    loadMessages()
  }
}

function closeChatDrawer() {
  isChatDrawerOpen.value = false
  showPasswordModal.value = false
  replyingMsg.value = null
}

async function loadMessages() {
  if (!props.studentId.trim()) return
  isLoadingMessages.value = true
  try {
    const list = await fetchStudentMessages(props.studentId)
    messages.value = list
    await markConversationAsRead(props.studentId, 'student')
    unreadCount.value = 0
  } finally {
    isLoadingMessages.value = false
    nextTick(() => {
      scrollToBottom()
      setupIntersectionObserver()
    })
  }
}

async function refreshMessagesSilently() {
  if (!props.studentId.trim()) return
  const list = await fetchStudentMessages(props.studentId)
  messages.value = list

  // 計算助教未讀訊息
  const unread = list.filter((m) => m.sender_role === 'ta' && !m.is_read_by_student).length
  unreadCount.value = unread

  if (isChatDrawerOpen.value && unread > 0) {
    await markConversationAsRead(props.studentId, 'student')
    unreadCount.value = 0
  }
  nextTick(() => setupIntersectionObserver())
}

async function checkInitialUnread() {
  if (!props.studentId.trim()) return
  const list = await fetchStudentMessages(props.studentId)
  unreadCount.value = list.filter((m) => m.sender_role === 'ta' && !m.is_read_by_student).length
}

// ── 3. 處理多附件檔案選擇與拖曳上傳 (最多 10 張圖片，超出提示) ──
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
  if (e.dataTransfer?.types?.includes('Files')) {
    dragCounter++
    isDraggingOver.value = true
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
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

  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length) {
    processFiles(files)
  }
}

// ── QC 膠囊輸入框拖曳圖片事件 ──
function handleQcDragEnter(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer?.types?.includes('Files')) {
    qcDragCounter++
    isQcDraggingOver.value = true
  }
}

function handleQcDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

function handleQcDragLeave(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  qcDragCounter--
  if (qcDragCounter <= 0) {
    qcDragCounter = 0
    isQcDraggingOver.value = false
  }
}

function handleQcDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  qcDragCounter = 0
  isQcDraggingOver.value = false

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

// ── 4. Telegram 風格送出過渡動態 ──
async function handleSubmitFromQc() {
  const text = inputContent.value.trim()
  if (!text && !attachedFiles.value.length) return
  if (isSending.value) return

  isSending.value = true

  // 關閉 QC 卡片，直接展開對話框（移除飛入位移動畫）
  isCapsuleExpanded.value = false
  isChatDrawerOpen.value = true

  // 發送訊息至後端 (支援多附件上傳)
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
      student_id: props.studentId,
      student_name: props.studentName,
      sender_role: 'student',
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
    isSending.value = false

    nextTick(() => {
      scrollToBottom()
      setupIntersectionObserver()
    })

    // 學生在 QC 頁面按下傳送後，先傳送出去，3 秒後再跳出密碼設定提示
    setTimeout(async () => {
      const hasPassword = await getStudentHasPassword(props.studentId)
      if (!hasPassword && !isSessionUnlocked.value) {
        isSettingPassword.value = true
        showPasswordModal.value = true
        passwordInput.value = ''
        passwordConfirmInput.value = ''
        passwordError.value = ''
        nextTick(() => passwordInputRef.value?.focus())
      }
    }, 3000)
  } catch (err) {
    console.error('發送失敗:', err)
    isSending.value = false
  }
}

// ── 5. 從抽屜發送訊息 (支援多附件) ──
async function handleSubmitFromDrawer() {
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
      student_id: props.studentId,
      student_name: props.studentName,
      sender_role: 'student',
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
    console.error('抽屜發送失敗:', err)
  } finally {
    isSending.value = false
  }
}

// ── 6. 密碼提交處理 ──
async function handlePasswordSubmit() {
  const pass = passwordInput.value.trim()
  if (!pass) {
    passwordError.value = '密碼不得為空。'
    return
  }

  isVerifyingPassword.value = true
  passwordError.value = ''

  try {
    if (isSettingPassword.value) {
      if (pass !== passwordConfirmInput.value.trim()) {
        passwordError.value = '兩次輸入的密碼不相符！'
        isVerifyingPassword.value = false
        return
      }
      if (pass.length < 4) {
        passwordError.value = '密碼長度建議至少 4 碼以上。'
        isVerifyingPassword.value = false
        return
      }
      await setStudentChatPassword(props.studentId, props.studentName, pass)
      isSessionUnlocked.value = true
      showPasswordModal.value = false
      showToast('防護密碼設定成功！')
    } else {
      const valid = await verifyStudentChatPassword(props.studentId, pass)
      if (valid) {
        isSessionUnlocked.value = true
        showPasswordModal.value = false
        loadMessages()
      } else {
        passwordError.value = '密碼錯誤，請重新輸入。'
      }
    }
  } catch {
    passwordError.value = '驗證異常，請稍後再試。'
  } finally {
    isVerifyingPassword.value = false
  }
}

// ── 7. 訊息操作 (按讚、收回、複製、引用、下載) ──
async function handleLike(msg: ChatMessage) {
  if (!msg.liked_by) msg.liked_by = []
  const wasLiked = msg.liked_by.includes(props.studentId)
  const prevLikes = msg.likes
  const prevLikedBy = [...msg.liked_by]

  // 1. 立即更新外觀效果 (Optimistic UI)
  if (wasLiked) {
    msg.likes = Math.max(0, msg.likes - 1)
    msg.liked_by = msg.liked_by.filter((id) => id !== props.studentId)
  } else {
    msg.likes = msg.likes + 1
    msg.liked_by.push(props.studentId)
  }

  // 2. 等待資料庫彙整完畢，若失敗則回滾
  try {
    const res = await toggleLikeMessage(msg.id, props.studentId)
    msg.likes = res.likes
    if (!msg.liked_by) msg.liked_by = []
    if (res.isLiked && !msg.liked_by.includes(props.studentId)) {
      msg.liked_by.push(props.studentId)
    } else if (!res.isLiked) {
      msg.liked_by = msg.liked_by.filter((id) => id !== props.studentId)
    }
  } catch (err) {
    console.error('按讚更新失敗:', err)
    msg.likes = prevLikes
    msg.liked_by = prevLikedBy
  }
}

function isMsgLiked(msg: ChatMessage): boolean {
  return Array.isArray(msg.liked_by) && msg.liked_by.includes(props.studentId)
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
      // 若只有一則訊息時收回訊息將直接刪除該訊息使得沒有對話紀錄，下次開啟仍為QC
      const success = await deleteMessage(target.id)
      if (success) {
        messages.value = []
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

function handleCopyText(content: string) {
  if (!navigator.clipboard) {
    showToast('瀏覽器不支援複製')
    return
  }
  navigator.clipboard.writeText(content).then(() => {
    showToast('已複製到剪貼簿')
  })
}

function handleQuote(msg: ChatMessage) {
  replyingMsg.value = msg
  nextTick(() => {
    drawerInputRef.value?.focus()
  })
}

function handleDownloadImage(url: string, fileName: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  showToast('開始下載圖片')
}

// ── 8. 工具提示懸停延遲計時器 ──
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

// ── 9. 圖片 Lazyload 與骨架載入 ──
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
    { root: messageListRef.value, threshold: 0.1 },
  )

  const wraps = messageListRef.value?.querySelectorAll('.chat-image-wrap, .chat-stack-img-wrap') || []
  wraps.forEach((w) => imageObserver?.observe(w))
}

function onImageLoaded(e: Event) {
  const img = e.target as HTMLImageElement
  img.classList.add('is-loaded')
  const wrap = img.closest('.chat-image-wrap, .chat-stack-img-wrap')
  const skeleton = wrap?.querySelector('.chat-image-skeleton') as HTMLElement
  if (skeleton) {
    skeleton.style.display = 'none'
  }
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

// ── 輔助函式 ──
function getQuotedMsg(replyId: number): ChatMessage | undefined {
  return messages.value.find((m) => m.id === replyId)
}

function scrollToMsg(replyId: number) {
  const el = document.getElementById(`msg-${replyId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('highlight-flash')
    setTimeout(() => el.classList.remove('highlight-flash'), 1200)
  }
}

function scrollToBottom() {
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

function formatTime(isoStr?: string): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function showToast(text: string) {
  if (copyToastTimer) clearTimeout(copyToastTimer)
  copyToastText.value = text
  copyToastTimer = setTimeout(() => {
    copyToastText.value = ''
    copyToastTimer = null
  }, 2000)
}
</script>

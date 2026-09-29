<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  announcements,
  isLoadingAnnouncements,
  lastAnnouncementsSyncTime,
  fetchAnnouncementsFromDb,
  saveAnnouncementsToDb,
  defaultAnnouncements,
  type Announcement,
} from '../announcementService'
import { renderMarkdown } from '../markdown'
import MathCurveLoader from './MathCurveLoader.vue'

const searchKeyword = ref('')
const selectedTagFilter = ref<string>('all')

const isDirty = ref(false)
const saveToastMessage = ref('')
let saveToastTimer: ReturnType<typeof setTimeout> | null = null

// 編輯 / 新增對話框狀態
const showEditModal = ref(false)
const isEditingNew = ref(false)
const editingId = ref<string>('')
const editTitle = ref('')
const editTag = ref('通知')
const editCustomTag = ref('')
const editIsPinned = ref(false)
const editContent = ref('')
const editActiveTab = ref<'edit' | 'preview'>('edit')
const editError = ref('')

const PRESET_TAGS = ['重要', '更新', '通知', '活動', '作業']

function showSaveToast(msg: string) {
  if (saveToastTimer) clearTimeout(saveToastTimer)
  saveToastMessage.value = msg
  saveToastTimer = setTimeout(() => {
    saveToastMessage.value = ''
  }, 4000)
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${d.getFullYear()}/${month}/${day} ${hour}:${min}`
  } catch {
    return iso
  }
}

function getTagClass(tag?: string) {
  if (!tag) return 'tag-default'
  if (tag.includes('重要')) return 'tag-important'
  if (tag.includes('更新')) return 'tag-update'
  if (tag.includes('作業') || tag.includes('活動')) return 'tag-activity'
  return 'tag-default'
}

const filteredAnnouncements = computed(() => {
  let list = [...announcements.value]
  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(
      a =>
        a.title.toLowerCase().includes(kw) ||
        a.content.toLowerCase().includes(kw) ||
        (a.tag && a.tag.toLowerCase().includes(kw))
    )
  }
  if (selectedTagFilter.value !== 'all') {
    list = list.filter(a => a.tag === selectedTagFilter.value)
  }
  // 置頂排前，日期新到舊
  return list.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
})

const pinnedCount = computed(() => announcements.value.filter(a => a.isPinned).length)

function openCreateModal() {
  isEditingNew.value = true
  editingId.value = 'ann-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
  editTitle.value = ''
  editTag.value = '通知'
  editCustomTag.value = ''
  editIsPinned.value = false
  editContent.value = ''
  editActiveTab.value = 'edit'
  editError.value = ''
  showEditModal.value = true
}

function openEditModal(ann: Announcement) {
  isEditingNew.value = false
  editingId.value = ann.id
  editTitle.value = ann.title
  if (PRESET_TAGS.includes(ann.tag || '')) {
    editTag.value = ann.tag || '通知'
    editCustomTag.value = ''
  } else {
    editTag.value = '自訂'
    editCustomTag.value = ann.tag || ''
  }
  editIsPinned.value = !!ann.isPinned
  editContent.value = ann.content
  editActiveTab.value = 'edit'
  editError.value = ''
  showEditModal.value = true
}

function handleSaveModal() {
  const trimmedTitle = editTitle.value.trim()
  if (!trimmedTitle) {
    editError.value = '請輸入公告標題！'
    return
  }
  const finalTag = editTag.value === '自訂' ? (editCustomTag.value.trim() || '通知') : editTag.value

  const nowIso = new Date().toISOString()
  if (isEditingNew.value) {
    announcements.value.unshift({
      id: editingId.value,
      title: trimmedTitle,
      tag: finalTag,
      isPinned: editIsPinned.value,
      content: editContent.value,
      createdAt: nowIso,
    })
  } else {
    const idx = announcements.value.findIndex(a => a.id === editingId.value)
    if (idx !== -1) {
      announcements.value[idx] = {
        ...announcements.value[idx],
        title: trimmedTitle,
        tag: finalTag,
        isPinned: editIsPinned.value,
        content: editContent.value,
        updatedAt: nowIso,
      }
    }
  }
  isDirty.value = true
  showEditModal.value = false
  showSaveToast(`已在本地暫存「${trimmedTitle}」，請點擊右上角「儲存至雲端」以同步全班！`)
}

function togglePin(ann: Announcement) {
  ann.isPinned = !ann.isPinned
  isDirty.value = true
  showSaveToast(`已${ann.isPinned ? '置頂' : '取消置頂'}「${ann.title}」`)
}

function handleDelete(ann: Announcement) {
  if (!confirm(`確定要刪除公告「${ann.title}」嗎？此操作不可逆！`)) return
  announcements.value = announcements.value.filter(a => a.id !== ann.id)
  isDirty.value = true
  showSaveToast(`已刪除公告「${ann.title}」，請記得點擊「儲存至雲端」`)
}

function handleResetDefaults() {
  if (!confirm('確定要載入預設公告範例嗎？這將覆蓋現有公告清單！')) return
  announcements.value = JSON.parse(JSON.stringify(defaultAnnouncements))
  isDirty.value = true
  showSaveToast('已載入預設公告，請記得點擊「儲存至雲端」')
}

async function handleSaveToCloud() {
  const res = await saveAnnouncementsToDb(announcements.value)
  if (res.success) {
    isDirty.value = false
    showSaveToast('🎉 ' + res.message)
  } else {
    alert(res.message)
  }
}

async function handleRefreshFromCloud() {
  if (isDirty.value) {
    if (!confirm('目前有尚未儲存至雲端的修改，重新整理將會捨棄這些修改，確定繼續？')) {
      return
    }
  }
  await fetchAnnouncementsFromDb()
  isDirty.value = false
  showSaveToast('已從雲端重新整理最新公告！')
}

onMounted(() => {
  fetchAnnouncementsFromDb()
})
</script>

<template>
  <div class="admin-announcement-container">
    <!-- 頂部資訊與控制欄 -->
    <div class="ann-subbar">
      <div class="ann-metrics">
        <div class="metric-card">
          <span class="metric-label">公告總則數</span>
          <strong class="metric-value">{{ announcements.length }} 則</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">置頂重要公告</span>
          <strong class="metric-value text-amber">{{ pinnedCount }} 則</strong>
        </div>
        <div class="metric-card">
          <span class="metric-label">最新同步狀態</span>
          <strong class="metric-value text-sm">{{ lastAnnouncementsSyncTime ? formatDate(lastAnnouncementsSyncTime) : '尚未同步' }}</strong>
        </div>
      </div>

      <div class="ann-actions-row">
        <div class="filter-controls">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              v-model="searchKeyword"
              placeholder="搜尋公告標題或內文..."
              class="input-control"
            />
          </div>
          <select v-model="selectedTagFilter" class="select-control">
            <option value="all">所有分類標籤</option>
            <option v-for="tag in PRESET_TAGS" :key="tag" :value="tag">{{ tag }}</option>
          </select>
        </div>

        <div class="btn-group">
          <button class="btn btn-outline" :disabled="isLoadingAnnouncements" @click="handleRefreshFromCloud" title="重新自雲端載入公告">
            <svg class="btn-svg" :class="{ 'btn-spin': isLoadingAnnouncements }" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            從雲端重整
          </button>
          <button class="btn btn-secondary" @click="handleResetDefaults" title="載入系統內建預設公告範例">
            範例公告
          </button>
          <button class="btn btn-primary" @click="openCreateModal">
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            新增公告
          </button>
          <button
            class="btn btn-success"
            :class="{ 'pulse-btn': isDirty }"
            :disabled="isLoadingAnnouncements"
            @click="handleSaveToCloud"
            title="儲存並發佈公告至雲端資料庫，即時同步全班學生"
          >
            <svg class="btn-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            {{ isLoadingAnnouncements ? '儲存中...' : (isDirty ? '★ 發佈至雲端 (有未存變更)' : '發佈至雲端') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 儲存反饋 Toast -->
    <transition name="fade">
      <div v-if="saveToastMessage" class="ann-toast" role="status">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>{{ saveToastMessage }}</span>
      </div>
    </transition>

    <!-- 公告列表主區塊 -->
    <div class="ann-list-wrapper">
      <div v-if="isLoadingAnnouncements" class="ann-loading">
        <MathCurveLoader size="md" label="正在與雲端同步公告資料庫..." />
      </div>

      <div v-else-if="filteredAnnouncements.length === 0" class="ann-empty">
        <div class="empty-icon">📢</div>
        <p>目前沒有符合條件的公告</p>
        <button class="btn btn-primary" @click="openCreateModal">立即新增第一則公告</button>
      </div>

      <div v-else class="ann-cards-grid">
        <div
          v-for="item in filteredAnnouncements"
          :key="item.id"
          class="admin-ann-card"
          :class="{ 'card-pinned': item.isPinned }"
        >
          <div class="card-top-bar">
            <div class="badge-cluster">
              <span v-if="item.isPinned" class="ann-badge tag-pinned">📌 已置頂</span>
              <span class="ann-badge" :class="getTagClass(item.tag)">{{ item.tag || '通知' }}</span>
            </div>
            <span class="card-time">{{ formatDate(item.createdAt) }}</span>
          </div>

          <h3 class="card-title">{{ item.title }}</h3>

          <div class="card-content-preview markdown-content" v-html="renderMarkdown(item.content)"></div>

          <div class="card-footer-actions">
            <button
              type="button"
              class="btn-card-action"
              :class="{ 'btn-pin-active': item.isPinned }"
              :title="item.isPinned ? '取消置頂' : '置頂顯示'"
              @click="togglePin(item)"
            >
              {{ item.isPinned ? '📌 取消置頂' : '📌 置頂' }}
            </button>
            <button
              type="button"
              class="btn-card-action btn-edit"
              title="編輯公告內容"
              @click="openEditModal(item)"
            >
              ✏️ 編輯
            </button>
            <button
              type="button"
              class="btn-card-action btn-delete"
              title="刪除此公告"
              @click="handleDelete(item)"
            >
              🗑️ 刪除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增 / 編輯公告彈窗 -->
    <transition name="modal-fade">
      <div v-if="showEditModal" class="ann-modal-overlay" @click.self="showEditModal = false">
        <div class="ann-modal-box">
          <div class="ann-modal-header">
            <h3>{{ isEditingNew ? '新增課程公告' : '編輯課程公告' }}</h3>
            <button type="button" class="btn-modal-close" @click="showEditModal = false">✕</button>
          </div>

          <div class="ann-modal-body">
            <div v-if="editError" class="modal-error-alert">{{ editError }}</div>

            <div class="form-row">
              <label class="form-label required">公告標題</label>
              <input
                v-model="editTitle"
                type="text"
                class="form-input"
                placeholder="例如：實作編輯器升級通知、期中專題說明..."
              />
            </div>

            <div class="form-row form-row-inline">
              <div class="form-col">
                <label class="form-label">分類標籤</label>
                <div class="tag-selector">
                  <button
                    v-for="tag in PRESET_TAGS"
                    :key="tag"
                    type="button"
                    class="tag-opt-btn"
                    :class="{ active: editTag === tag }"
                    @click="editTag = tag"
                  >
                    {{ tag }}
                  </button>
                  <button
                    type="button"
                    class="tag-opt-btn"
                    :class="{ active: editTag === '自訂' }"
                    @click="editTag = '自訂'"
                  >
                    自訂標籤
                  </button>
                </div>
                <input
                  v-if="editTag === '自訂'"
                  v-model="editCustomTag"
                  type="text"
                  class="form-input mt-2"
                  placeholder="輸入自訂標籤名稱..."
                />
              </div>

              <div class="form-col-pinned">
                <label class="form-label">置頂狀態</label>
                <label class="checkbox-label">
                  <input v-model="editIsPinned" type="checkbox" />
                  <span>在學生端頂部置頂顯示</span>
                </label>
              </div>
            </div>

            <div class="form-row">
              <div class="content-header-tabs">
                <label class="form-label mb-0">公告內容 (支援 Markdown 語法)</label>
                <div class="tab-pill-group">
                  <button
                    type="button"
                    class="tab-pill"
                    :class="{ active: editActiveTab === 'edit' }"
                    @click="editActiveTab = 'edit'"
                  >
                    編輯原始碼
                  </button>
                  <button
                    type="button"
                    class="tab-pill"
                    :class="{ active: editActiveTab === 'preview' }"
                    @click="editActiveTab = 'preview'"
                  >
                    即時預覽
                  </button>
                </div>
              </div>

              <div v-if="editActiveTab === 'edit'" class="editor-wrap">
                <textarea
                  v-model="editContent"
                  rows="9"
                  class="form-textarea custom-scrollbar"
                  placeholder="支援 Markdown：如 **粗體**、- 列表項目、`code` 代碼等..."
                ></textarea>
              </div>
              <div v-else class="preview-wrap custom-scrollbar markdown-content" v-html="renderMarkdown(editContent || '*（目前尚無內文）*')"></div>
            </div>
          </div>

          <div class="ann-modal-footer">
            <button type="button" class="btn btn-outline" @click="showEditModal = false">取消</button>
            <button type="button" class="btn btn-primary" @click="handleSaveModal">確認儲存</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.admin-announcement-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  background: #f8fafc;
  overflow: hidden;
}

.ann-subbar {
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 14px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex-shrink: 0;
}

.ann-metrics {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.metric-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 140px;
}

.metric-label {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
}

.metric-value {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.text-amber {
  color: #d97706;
}
.text-sm {
  font-size: 13px;
  font-weight: 600;
}

.ann-actions-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  font-size: 12px;
  color: #94a3b8;
  pointer-events: none;
}

.input-control {
  padding: 7px 12px 7px 30px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  width: 240px;
  background: #ffffff;
  color: #1e293b;
  outline: none;
  transition: border-color 0.15s ease;
}

.input-control:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.select-control {
  padding: 7px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  background: #ffffff;
  color: #1e293b;
  outline: none;
}

.btn-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-success {
  background: #16a34a;
  color: #ffffff;
  border: none;
}
.btn-success:hover {
  background: #15803d;
}

.pulse-btn {
  animation: pulse-border 1.8s infinite;
}

@keyframes pulse-border {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.5);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(22, 163, 74, 0);
  }
}

.ann-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #1e293b;
  color: #ffffff;
  border-radius: 8px;
  padding: 10px 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  z-index: 10000;
  font-size: 13px;
  font-weight: 600;
}

.ann-list-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.ann-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.admin-ann-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.admin-ann-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
}

.admin-ann-card.card-pinned {
  border-color: #fde68a;
  background: #fffdf5;
}

.card-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.badge-cluster {
  display: flex;
  gap: 6px;
  align-items: center;
}

.card-time {
  font-size: 11px;
  color: #94a3b8;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 10px 0;
  line-height: 1.4;
}

.card-content-preview {
  flex: 1;
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
  max-height: 120px;
  overflow-y: auto;
  margin-bottom: 14px;
  padding-right: 4px;
}

.card-footer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid #f1f5f9;
  padding-top: 12px;
}

.btn-card-action {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-card-action:hover {
  background: #f8fafc;
  color: #0f172a;
}

.btn-card-action.btn-pin-active {
  background: #fef3c7;
  color: #b45309;
  border-color: #fde68a;
}

.btn-card-action.btn-edit:hover {
  background: #eff6ff;
  color: #2563eb;
  border-color: #bfdbfe;
}

.btn-card-action.btn-delete:hover {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fecaca;
}

.ann-loading, .ann-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 20px;
  color: #64748b;
  gap: 12px;
}

.empty-icon {
  font-size: 40px;
}

/* 彈窗樣式 */
.ann-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.ann-modal-box {
  background: #ffffff;
  border-radius: 14px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.ann-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.ann-modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.btn-modal-close {
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.btn-modal-close:hover {
  color: #0f172a;
}

.ann-modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-error-alert {
  background: #fee2e2;
  color: #dc2626;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row-inline {
  flex-direction: row;
  justify-content: space-between;
  gap: 16px;
}

.form-col {
  flex: 1;
}

.form-col-pinned {
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: flex-end;
}

.form-label {
  font-size: 12.5px;
  font-weight: 700;
  color: #334155;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

.form-input {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  color: #0f172a;
  outline: none;
}
.form-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.tag-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-opt-btn {
  padding: 4px 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s ease;
}

.tag-opt-btn:hover {
  background: #e2e8f0;
}

.tag-opt-btn.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  cursor: pointer;
  padding: 6px 0;
}

.content-header-tabs {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.tab-pill-group {
  display: flex;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.tab-pill {
  border: none;
  background: transparent;
  color: #64748b;
  padding: 3px 10px;
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
}

.tab-pill.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.form-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  background: #ffffff;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: #0f172a;
  outline: none;
  resize: vertical;
}

.form-textarea:focus {
  background: #ffffff;
  background-color: #ffffff;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.preview-wrap {
  min-height: 180px;
  max-height: 240px;
  overflow-y: auto;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px 14px;
  font-size: 13px;
}

.ann-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.mt-2 {
  margin-top: 6px;
}
.mb-0 {
  margin-bottom: 0;
}
</style>

/* ===== Image Protect — Client App ===== */
(function () {
  'use strict';

  // --- State ---
  let selectedFile = null;
  let deleteMode = 'token'; // 'token' or 'password'

  // --- DOM refs ---
  const $ = (sel) => document.querySelector(sel);
  const dropZone = $('#drop-zone');
  const fileInput = $('#file-input');
  const filePreview = $('#file-preview');
  const previewImg = $('#preview-img');
  const fileName = $('#file-name');
  const fileSize = $('#file-size');
  const removeFile = $('#remove-file');
  const uploadBtn = $('#upload-btn');
  const uploadResult = $('#upload-result');
  const cdnUrlInput = $('#cdn-url');
  const deleteTokenDisplay = $('#delete-token');
  const uploadAnother = $('#upload-another');
  const deleteImageId = $('#delete-image-id');
  const deleteTokenField = $('#delete-token-input');
  const deleteAdminPassword = $('#delete-admin-password');
  const deleteBtn = $('#delete-btn');
  const toggleTokenAuth = $('#toggle-token-auth');
  const togglePasswordAuth = $('#toggle-password-auth');
  const tokenAuthField = $('#token-auth-field');
  const passwordAuthField = $('#password-auth-field');
  const themeToggle = $('#theme-toggle');

  // --- Dark Mode ---
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });

  // --- Toast ---
  function toast(message, type = 'info') {
    const container = $('#toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    if (type === 'error') el.setAttribute('role', 'alert');
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 300ms';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // --- Safe JSON parse from fetch response ---
  async function safeJson(res) {
    if (!res.ok) {
      try {
        return await res.json();
      } catch {
        const messages = {
          413: 'ファイルが大きすぎます',
          429: 'リクエストが多すぎます。しばらくお待ちください',
          502: 'サーバーエラーが発生しました',
          504: 'サーバーがタイムアウトしました',
        };
        return { success: false, error: messages[res.status] || `エラーが発生しました (${res.status})` };
      }
    }
    try {
      return await res.json();
    } catch {
      return { success: false, error: 'サーバーから不正なレスポンスが返されました' };
    }
  }

  // --- File Selection ---
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function selectFile(file) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast('許可されていないファイル形式です', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('ファイルが大きすぎます（最大10MB）', 'error');
      return;
    }
    selectedFile = file;
    previewImg.src = URL.createObjectURL(file);
    fileName.textContent = file.name;
    fileSize.textContent = formatSize(file.size);
    dropZone.classList.add('hidden');
    filePreview.classList.remove('hidden');
    uploadBtn.disabled = false;
  }

  function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    dropZone.classList.remove('hidden');
    filePreview.classList.add('hidden');
    uploadBtn.disabled = true;
    if (previewImg.src.startsWith('blob:')) {
      URL.revokeObjectURL(previewImg.src);
    }
  }

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) selectFile(fileInput.files[0]);
  });
  removeFile.addEventListener('click', clearFile);

  // Drag & Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
  });

  // --- Upload ---
  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'アップロード中...';

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await safeJson(res);

      if (!data.success) {
        toast(data.error || 'アップロードに失敗しました', 'error');
        return;
      }

      cdnUrlInput.value = data.cdnUrl;
      deleteTokenDisplay.value = data.deleteToken;

      $('#upload-section .card').classList.add('hidden');
      uploadResult.classList.remove('hidden');
      toast('画像をアップロードしました！', 'success');
    } catch (err) {
      toast('アップロードに失敗しました: ' + err.message, 'error');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = '画像をアップロード';
    }
  });

  uploadAnother.addEventListener('click', () => {
    clearFile();
    uploadResult.classList.add('hidden');
    $('#upload-section .card').classList.remove('hidden');
  });

  // --- Copy to Clipboard ---
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const targetId = btn.dataset.copy;
    const input = document.getElementById(targetId);
    if (!input) return;
    try {
      await navigator.clipboard.writeText(input.value);
      const original = btn.textContent;
      btn.textContent = 'コピー完了！';
      setTimeout(() => { btn.textContent = original; }, 1500);
    } catch {
      toast('コピーに失敗しました', 'error');
    }
  });

  // --- Delete Auth Toggle ---
  toggleTokenAuth.addEventListener('click', () => {
    deleteMode = 'token';
    toggleTokenAuth.classList.add('active');
    toggleTokenAuth.setAttribute('aria-pressed', 'true');
    togglePasswordAuth.classList.remove('active');
    togglePasswordAuth.setAttribute('aria-pressed', 'false');
    tokenAuthField.classList.remove('hidden');
    passwordAuthField.classList.add('hidden');
  });

  togglePasswordAuth.addEventListener('click', () => {
    deleteMode = 'password';
    togglePasswordAuth.classList.add('active');
    togglePasswordAuth.setAttribute('aria-pressed', 'true');
    toggleTokenAuth.classList.remove('active');
    toggleTokenAuth.setAttribute('aria-pressed', 'false');
    passwordAuthField.classList.remove('hidden');
    tokenAuthField.classList.add('hidden');
  });

  // --- Delete Image ---
  deleteBtn.addEventListener('click', async () => {
    const id = deleteImageId.value.trim();
    if (!id) {
      toast('画像IDを入力してください', 'error');
      return;
    }

    if (deleteMode === 'token') {
      const token = deleteTokenField.value.trim();
      if (!token) {
        toast('削除トークンを入力してください', 'error');
        return;
      }
      await deleteWithToken(id, token);
    } else {
      const password = deleteAdminPassword.value.trim();
      if (!password) {
        toast('管理パスワードを入力してください', 'error');
        return;
      }
      await deleteWithPassword(id, password);
    }
  });

  async function deleteWithToken(id, token) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = '削除中...';
    try {
      const res = await fetch(`/api/image/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'X-Delete-Token': token },
      });
      const data = await safeJson(res);
      if (data.success) {
        toast('画像を削除しました', 'success');
        deleteImageId.value = '';
        deleteTokenField.value = '';
      } else {
        toast(data.error || '削除に失敗しました', 'error');
      }
    } catch (err) {
      toast('削除に失敗しました: ' + err.message, 'error');
    } finally {
      deleteBtn.disabled = false;
      deleteBtn.textContent = '画像を削除';
    }
  }

  async function deleteWithPassword(id, password) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = '認証中...';
    try {
      // Step 1: Authenticate to get session token
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const authData = await safeJson(authRes);

      if (!authData.success || !authData.token) {
        toast(authData.error || '認証に失敗しました', 'error');
        return;
      }

      // Step 2: Delete with session token
      deleteBtn.textContent = '削除中...';
      const delRes = await fetch(`/api/image/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authData.token}` },
      });
      const delData = await safeJson(delRes);

      if (delData.success) {
        toast('画像を削除しました', 'success');
        deleteImageId.value = '';
        deleteAdminPassword.value = '';
      } else {
        toast(delData.error || '削除に失敗しました', 'error');
      }
    } catch (err) {
      toast('削除に失敗しました: ' + err.message, 'error');
    } finally {
      deleteBtn.disabled = false;
      deleteBtn.textContent = '画像を削除';
    }
  }

  // --- Scroll Animation ---
  function initScrollAnimations() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.animate-on-scroll').forEach((el) => observer.observe(el));
  }

  // --- Init ---
  initScrollAnimations();
})();

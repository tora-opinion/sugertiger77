/* ===== Image Protect — Client App ===== */
(function () {
  'use strict';

  // --- State ---
  let selectedFile = null;
  let adminToken = sessionStorage.getItem('admin_token') || null;
  let imageCursor = null;

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
  const signedUrlInput = $('#signed-url');
  const deleteTokenInput = $('#delete-token');
  const uploadAnother = $('#upload-another');
  const deleteImageId = $('#delete-image-id');
  const deleteTokenField = $('#delete-token-input');
  const deleteBtn = $('#delete-btn');
  const adminLogin = $('#admin-login');
  const adminPanel = $('#admin-panel');
  const adminPassword = $('#admin-password');
  const adminLoginBtn = $('#admin-login-btn');
  const adminLogoutBtn = $('#admin-logout-btn');
  const imageCount = $('#image-count');
  const imageList = $('#image-list');
  const loadMore = $('#load-more');
  const themeToggle = $('#theme-toggle');
  const themeIcon = $('#theme-icon');

  // --- Dark Mode ---
  function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      themeIcon.textContent = '☀️';
    }
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
  });

  // --- Toast ---
  function toast(message, type = 'info') {
    const container = $('#toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 300ms';
      setTimeout(() => el.remove(), 300);
    }, 3000);
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
      toast('File type not allowed', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('File too large (max 10MB)', 'error');
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
    uploadBtn.textContent = 'Uploading...';

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!data.success) {
        toast(data.error || 'Upload failed', 'error');
        return;
      }

      cdnUrlInput.value = data.cdnUrl;
      signedUrlInput.value = data.signedUrl;
      deleteTokenInput.value = data.deleteToken;

      $('#upload-section .card').classList.add('hidden');
      uploadResult.classList.remove('hidden');
      toast('Image uploaded successfully!', 'success');
    } catch (err) {
      toast('Upload failed: ' + err.message, 'error');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload Image';
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
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = original; }, 1500);
    } catch {
      toast('Failed to copy', 'error');
    }
  });

  // --- Delete Image ---
  deleteBtn.addEventListener('click', async () => {
    const id = deleteImageId.value.trim();
    const token = deleteTokenField.value.trim();
    if (!id || !token) {
      toast('Both fields required', 'error');
      return;
    }

    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';

    try {
      const res = await fetch(`/api/image/${id}`, {
        method: 'DELETE',
        headers: { 'X-Delete-Token': token },
      });
      const data = await res.json();
      if (data.success) {
        toast('Image deleted', 'success');
        deleteImageId.value = '';
        deleteTokenField.value = '';
      } else {
        toast(data.error || 'Delete failed', 'error');
      }
    } catch (err) {
      toast('Delete failed: ' + err.message, 'error');
    } finally {
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete Image';
    }
  });

  // --- Admin Auth ---
  function showAdminPanel() {
    adminLogin.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    loadImages();
  }

  function hideAdminPanel() {
    adminToken = null;
    sessionStorage.removeItem('admin_token');
    imageCursor = null;
    adminLogin.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    imageList.innerHTML = '';
  }

  adminLoginBtn.addEventListener('click', async () => {
    const password = adminPassword.value.trim();
    if (!password) {
      toast('Password required', 'error');
      return;
    }

    adminLoginBtn.disabled = true;
    adminLoginBtn.textContent = 'Logging in...';

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        adminToken = data.token;
        sessionStorage.setItem('admin_token', data.token);
        adminPassword.value = '';
        toast('Logged in', 'success');
        showAdminPanel();
      } else {
        toast(data.error || 'Login failed', 'error');
      }
    } catch (err) {
      toast('Login failed: ' + err.message, 'error');
    } finally {
      adminLoginBtn.disabled = false;
      adminLoginBtn.textContent = 'Login';
    }
  });

  adminLogoutBtn.addEventListener('click', hideAdminPanel);

  // --- Image List ---
  async function loadImages(append = false) {
    try {
      const params = new URLSearchParams();
      if (imageCursor) params.set('cursor', imageCursor);
      params.set('limit', '20');

      const res = await fetch(`/api/images?${params}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();

      if (!data.success) {
        if (data.code === 401) {
          hideAdminPanel();
          toast('Session expired', 'error');
        }
        return;
      }

      if (!append) imageList.innerHTML = '';

      imageCount.textContent = `${data.images.length} image(s)`;

      for (const img of data.images) {
        const card = document.createElement('div');
        card.className = 'image-card';

        const imgEl = document.createElement('img');
        imgEl.src = '/cdn/' + encodeURIComponent(img.id);
        imgEl.alt = img.filename.replace(/[<>"&]/g, '');
        imgEl.loading = 'lazy';
        card.appendChild(imgEl);

        const info = document.createElement('div');
        info.className = 'image-card-info';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';
        nameSpan.textContent = img.filename;
        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'text-muted';
        sizeSpan.textContent = formatSize(img.size);
        info.appendChild(nameSpan);
        info.appendChild(sizeSpan);
        card.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'image-card-actions';
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger btn-sm';
        delBtn.dataset.deleteId = img.id;
        delBtn.textContent = 'Delete';
        actions.appendChild(delBtn);
        card.appendChild(actions);

        imageList.appendChild(card);
      }

      if (data.cursor) {
        imageCursor = data.cursor;
        loadMore.classList.remove('hidden');
      } else {
        imageCursor = null;
        loadMore.classList.add('hidden');
      }
    } catch (err) {
      toast('Failed to load images: ' + err.message, 'error');
    }
  }

  loadMore.addEventListener('click', () => loadImages(true));

  // Admin delete
  imageList.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-delete-id]');
    if (!btn) return;
    const id = btn.dataset.deleteId;
    if (!confirm('Delete this image?')) return;

    btn.disabled = true;
    btn.textContent = '...';

    try {
      const res = await fetch(`/api/image/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (data.success) {
        btn.closest('.image-card').remove();
        toast('Image deleted', 'success');
      } else {
        toast(data.error || 'Delete failed', 'error');
      }
    } catch (err) {
      toast('Delete failed: ' + err.message, 'error');
    }
  });

  // --- Init ---
  initTheme();
  if (adminToken) {
    showAdminPanel();
  }
})();

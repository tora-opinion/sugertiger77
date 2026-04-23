// Constants
const SMALL_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
const DEFAULT_PART_SIZE = 16 * 1024 * 1024; // 16MB
const PART_CONCURRENCY = 4;
const PART_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

// DOM Elements - Upload
const apiKeyInput = document.getElementById('apiKey');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const selectBtn = document.getElementById('selectBtn');
const progressSection = document.getElementById('progressSection');
const fileName = document.getElementById('fileName');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const progressStatus = document.getElementById('progressStatus');
const resultSection = document.getElementById('resultSection');
const cdnUrlInput = document.getElementById('cdnUrl');
const deleteTokenInput = document.getElementById('deleteToken');
const resetBtn = document.getElementById('resetBtn');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const errorResetBtn = document.getElementById('errorResetBtn');

// DOM Elements - Delete
const deleteFileIdInput = document.getElementById('deleteFileId');
const deleteTokenInputField = document.getElementById('deleteTokenInput');
const deleteBtn = document.getElementById('deleteBtn');
const deleteResult = document.getElementById('deleteResult');
const deleteError = document.getElementById('deleteError');
const deleteErrorMessage = document.getElementById('deleteErrorMessage');

// DOM Elements - Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// State
let isUploading = false;

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabId = tab.dataset.tab;

    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(`${tabId}-tab`).classList.add('active');
  });
});

// Upload Event Listeners
selectBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
resetBtn.addEventListener('click', resetUI);
errorResetBtn.addEventListener('click', resetUI);

// Copy buttons
document.querySelectorAll('.btn-copy').forEach(btn => {
  btn.addEventListener('click', () => {
    const inputId = btn.dataset.copy;
    const input = document.getElementById(inputId);
    navigator.clipboard.writeText(input.value);
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
});

// Drag and drop
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

dropzone.addEventListener('click', (e) => {
  if (e.target === selectBtn) return;
  fileInput.click();
});

// Delete Event Listeners
deleteBtn.addEventListener('click', handleDelete);

function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
}

async function handleFile(file) {
  if (isUploading) return;

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showError('Please enter an API key');
    return;
  }

  if (!apiKey.match(/^fsk_[a-f0-9]{32}$/i)) {
    showError('Invalid API key format');
    return;
  }

  isUploading = true;
  showProgress(file.name);

  try {
    let result;
    if (file.size <= SMALL_FILE_THRESHOLD) {
      result = await uploadSmallFile(file, apiKey);
    } else {
      result = await uploadLargeFile(file, apiKey);
    }
    showResult(result.cdnUrl, result.deleteToken);
  } catch (err) {
    showError(err.message || 'Upload failed');
  } finally {
    isUploading = false;
  }
}

async function uploadSmallFile(file, apiKey) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  updateProgress(100);

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Upload failed');
  }

  return data;
}

async function uploadLargeFile(file, apiKey) {
  // Start multipart upload
  updateStatus('Starting multipart upload...');

  const startResponse = await fetch('/api/upload/start', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    }),
  });

  const startData = await startResponse.json();
  if (!startData.success) {
    throw new Error(startData.error || 'Failed to start upload');
  }

  const { uploadId } = startData;
  const partSize = Number.isFinite(startData.partSize) && startData.partSize > 0
    ? startData.partSize
    : DEFAULT_PART_SIZE;
  const totalParts = Math.ceil(file.size / partSize);
  const parts = new Array(totalParts);
  const partLoadedBytes = new Array(totalParts).fill(0);
  let completedParts = 0;

  const updateTotalProgress = () => {
    const uploadedBytes = partLoadedBytes.reduce((sum, loaded) => sum + loaded, 0);
    updateProgress(Math.round((uploadedBytes / file.size) * 100));
  };

  try {
    updateStatus(`Uploading parts... (0/${totalParts})`);

    let nextPartNumber = 1;
    const workerCount = Math.min(PART_CONCURRENCY, totalParts);

    const uploadWorker = async () => {
      while (nextPartNumber <= totalParts) {
        const partNumber = nextPartNumber++;
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const chunk = file.slice(start, end);
        const partIndex = partNumber - 1;

        const partData = await uploadPartWithRetry(
          uploadId,
          partNumber,
          chunk,
          apiKey,
          (loaded) => {
            partLoadedBytes[partIndex] = loaded;
            updateTotalProgress();
          },
        );

        parts[partIndex] = {
          partNumber: partData.partNumber,
          etag: partData.etag,
        };
        partLoadedBytes[partIndex] = chunk.size;
        completedParts += 1;
        updateTotalProgress();
        updateStatus(`Uploading parts... (${completedParts}/${totalParts})`);
      }
    };

    await Promise.all(
      Array.from({ length: workerCount }, () => uploadWorker()),
    );

    if (parts.some((part) => !part)) {
      throw new Error('Some parts failed to upload');
    }

    // Complete upload
    updateStatus('Completing upload...');

    const completeResponse = await fetch(`/api/upload/${uploadId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parts }),
    });

    const completeData = await completeResponse.json();
    if (!completeData.success) {
      throw new Error(completeData.error || 'Failed to complete upload');
    }

    return completeData;
  } catch (err) {
    // Abort on error
    try {
      await fetch(`/api/upload/${uploadId}/abort`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
    } catch {
      // Ignore abort errors
    }
    throw err;
  }
}

function uploadPartWithXhr(uploadId, partNumber, chunk, apiKey, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/upload/${uploadId}/part/${partNumber}`);
    xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
    xhr.responseType = 'json';

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };

    xhr.onload = () => {
      const responseData = parseXhrJson(xhr);
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(responseData.error || `Failed to upload part ${partNumber}`));
        return;
      }

      if (
        typeof responseData.partNumber !== 'number'
        || typeof responseData.etag !== 'string'
      ) {
        reject(new Error(`Invalid part response for part ${partNumber}`));
        return;
      }

      resolve({
        partNumber: responseData.partNumber,
        etag: responseData.etag,
      });
    };

    xhr.onerror = () => reject(new Error(`Network error on part ${partNumber}`));
    xhr.onabort = () => reject(new Error(`Upload aborted on part ${partNumber}`));
    xhr.send(chunk);
  });
}

async function uploadPartWithRetry(uploadId, partNumber, chunk, apiKey, onProgress) {
  let lastError = new Error(`Failed to upload part ${partNumber}`);

  for (let attempt = 0; attempt <= PART_MAX_RETRIES; attempt++) {
    try {
      onProgress(0);
      return await uploadPartWithXhr(
        uploadId,
        partNumber,
        chunk,
        apiKey,
        onProgress,
      );
    } catch (err) {
      lastError = err instanceof Error ? err : lastError;
      if (attempt === PART_MAX_RETRIES) {
        break;
      }

      const retryCount = attempt + 1;
      const waitMs = RETRY_BASE_DELAY_MS * (2 ** attempt);
      updateStatus(`Part ${partNumber} retry ${retryCount}/${PART_MAX_RETRIES}...`);
      await wait(waitMs);
    }
  }

  throw lastError;
}

function parseXhrJson(xhr) {
  if (xhr.response && typeof xhr.response === 'object') {
    return xhr.response;
  }

  if (!xhr.responseText) {
    return {};
  }

  try {
    return JSON.parse(xhr.responseText);
  } catch {
    return {};
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleDelete() {
  const fileId = deleteFileIdInput.value.trim();
  const token = deleteTokenInputField.value.trim();

  deleteResult.hidden = true;
  deleteError.hidden = true;

  if (!fileId) {
    showDeleteError('Please enter a file ID');
    return;
  }

  if (!fileId.match(/^[0-9a-f]{16}$/i)) {
    showDeleteError('Invalid file ID format (should be 16 hex characters)');
    return;
  }

  if (!token) {
    showDeleteError('Please enter a delete token');
    return;
  }

  try {
    const response = await fetch(`/api/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'X-Delete-Token': token,
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Delete failed');
    }

    deleteResult.hidden = false;
    deleteFileIdInput.value = '';
    deleteTokenInputField.value = '';
  } catch (err) {
    showDeleteError(err.message || 'Delete failed');
  }
}

function showDeleteError(message) {
  deleteError.hidden = false;
  deleteErrorMessage.textContent = message;
}

function showProgress(name) {
  dropzone.hidden = true;
  progressSection.hidden = false;
  resultSection.hidden = true;
  errorSection.hidden = true;

  fileName.textContent = name;
  updateProgress(0);
  updateStatus('Uploading...');
}

function updateProgress(percent) {
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
}

function updateStatus(status) {
  progressStatus.textContent = status;
}

function showResult(cdnUrl, deleteToken) {
  progressSection.hidden = true;
  resultSection.hidden = false;

  cdnUrlInput.value = cdnUrl;
  deleteTokenInput.value = deleteToken;
}

function showError(message) {
  dropzone.hidden = true;
  progressSection.hidden = true;
  resultSection.hidden = true;
  errorSection.hidden = false;

  errorMessage.textContent = message;
}

function resetUI() {
  dropzone.hidden = false;
  progressSection.hidden = true;
  resultSection.hidden = true;
  errorSection.hidden = true;

  fileInput.value = '';
  updateProgress(0);
}

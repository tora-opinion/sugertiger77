(function () {
  'use strict';

  // ============================================================
  // ユーティリティ
  // ============================================================
  function clamp(v) {
    return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  }

  function yieldTick() {
    return new Promise(function (r) { setTimeout(r, 0); });
  }

  // ============================================================
  // レガシー摂動（フォールバック用）
  // AdversarialEngineが利用不可時に使用
  // ============================================================

  // --- PRNG: xorshift32 ---
  function xorshift32(state) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state;
  }

  function prngNorm(seed) {
    return xorshift32(seed | 1) / 2147483647;
  }

  // --- DCT cosine table ---
  var COS_TABLE = new Float64Array(64);
  for (var k = 0; k < 8; k++) {
    for (var n = 0; n < 8; n++) {
      COS_TABLE[k * 8 + n] = Math.cos(Math.PI * (2 * n + 1) * k / 16);
    }
  }
  var SQRT_1_8 = 1 / Math.sqrt(8);
  var SQRT_2_8 = Math.sqrt(2 / 8);

  function dct1d(input, output) {
    for (var k2 = 0; k2 < 8; k2++) {
      var sum = 0;
      var off = k2 * 8;
      for (var n2 = 0; n2 < 8; n2++) sum += input[n2] * COS_TABLE[off + n2];
      output[k2] = sum * (k2 === 0 ? SQRT_1_8 : SQRT_2_8);
    }
  }

  function idct1d(input, output) {
    for (var n2 = 0; n2 < 8; n2++) {
      var sum = 0;
      for (var k2 = 0; k2 < 8; k2++) {
        var ck = k2 === 0 ? SQRT_1_8 : SQRT_2_8;
        sum += ck * input[k2] * COS_TABLE[k2 * 8 + n2];
      }
      output[n2] = sum;
    }
  }

  async function _legacyStepNoise(data, w, h, strength, onProgress) {
    var amplitude = strength * 6.0;
    var pixels = data.data;
    var CHUNK = 64;
    for (var row0 = 0; row0 < h; row0 += CHUNK) {
      var rowEnd = Math.min(row0 + CHUNK, h);
      for (var y = row0; y < rowEnd; y++) {
        for (var x = 0; x < w; x++) {
          var cb = ((x + y) % 2 === 0) ? 1.0 : -1.0;
          var seed = x * 7919 + y * 104729;
          var noise = prngNorm(seed) * amplitude * cb;
          var idx = (y * w + x) * 4;
          pixels[idx]     = clamp(pixels[idx]     + noise);
          pixels[idx + 1] = clamp(pixels[idx + 1] + noise);
          pixels[idx + 2] = clamp(pixels[idx + 2] + noise);
        }
      }
      onProgress(0 + 25 * Math.min(rowEnd / h, 1), 'highfreq');
      await yieldTick();
    }
  }

  async function _legacyStepDCT(data, w, h, strength, onProgress) {
    var pixels = data.data;
    var bw = (w >> 3);
    var bh = (h >> 3);
    var totalBlocks = bw * bh;
    if (totalBlocks === 0) return;
    var block = new Float64Array(64);
    var tmpOut = new Float64Array(8);
    var row8 = new Float64Array(8);
    var col8 = new Float64Array(8);
    var CHUNK = 64;
    var processed = 0;
    for (var byStart = 0; byStart < bh; byStart += CHUNK) {
      var byEnd = Math.min(byStart + CHUNK, bh);
      for (var by = byStart; by < byEnd; by++) {
        for (var bx = 0; bx < bw; bx++) {
          var ox = bx * 8;
          var oy = by * 8;
          for (var ch = 0; ch < 3; ch++) {
            for (var r = 0; r < 8; r++) {
              for (var c = 0; c < 8; c++) {
                block[r * 8 + c] = pixels[((oy + r) * w + (ox + c)) * 4 + ch];
              }
            }
            for (r = 0; r < 8; r++) {
              for (c = 0; c < 8; c++) row8[c] = block[r * 8 + c];
              dct1d(row8, tmpOut);
              for (c = 0; c < 8; c++) block[r * 8 + c] = tmpOut[c];
            }
            for (c = 0; c < 8; c++) {
              for (r = 0; r < 8; r++) col8[r] = block[r * 8 + c];
              dct1d(col8, tmpOut);
              for (r = 0; r < 8; r++) block[r * 8 + c] = tmpOut[r];
            }
            for (var u = 1; u <= 6; u++) {
              for (var v = 1; v <= 6; v++) {
                var uv = u + v;
                if (uv < 2 || uv > 10) continue;
                var coeff = block[u * 8 + v];
                var scale = Math.max(Math.abs(coeff) * 0.08, 1.5) * strength;
                var seed = bx * 997 + by * 991 + u * 31 + v * 37 + ch;
                block[u * 8 + v] = coeff + prngNorm(seed) * scale;
              }
            }
            for (c = 0; c < 8; c++) {
              for (r = 0; r < 8; r++) col8[r] = block[r * 8 + c];
              idct1d(col8, tmpOut);
              for (r = 0; r < 8; r++) block[r * 8 + c] = tmpOut[r];
            }
            for (r = 0; r < 8; r++) {
              for (c = 0; c < 8; c++) row8[c] = block[r * 8 + c];
              idct1d(row8, tmpOut);
              for (c = 0; c < 8; c++) block[r * 8 + c] = tmpOut[c];
            }
            for (r = 0; r < 8; r++) {
              for (c = 0; c < 8; c++) {
                pixels[((oy + r) * w + (ox + c)) * 4 + ch] = clamp(block[r * 8 + c]);
              }
            }
          }
          processed++;
        }
      }
      onProgress(25 + 50 * Math.min(processed / totalBlocks, 1), 'dct');
      await yieldTick();
    }
  }

  async function _legacyStepColorShift(data, w, h, strength, onProgress) {
    var pixels = data.data;
    var CHUNK = 64;
    for (var row0 = 0; row0 < h; row0 += CHUNK) {
      var rowEnd = Math.min(row0 + CHUNK, h);
      for (var y = row0; y < rowEnd; y++) {
        for (var x = 0; x < w; x++) {
          var idx = (y * w + x) * 4;
          pixels[idx]     = clamp(pixels[idx]     + Math.round(4.0 * Math.sin(x * 0.0147 + y * 0.0093) * strength));
          pixels[idx + 1] = clamp(pixels[idx + 1] + Math.round(4.0 * Math.sin(x * 0.0211 + y * 0.0061) * strength));
          pixels[idx + 2] = clamp(pixels[idx + 2] + Math.round(4.0 * Math.sin(x * 0.0089 + y * 0.0173) * strength));
        }
      }
      onProgress(75 + 15 * Math.min(rowEnd / h, 1), 'colorshift');
      await yieldTick();
    }
  }

  async function _legacyPerturb(imageData, w, h, strength, onProgress) {
    await _legacyStepNoise(imageData, w, h, strength, onProgress);
    await _legacyStepDCT(imageData, w, h, strength, onProgress);
    await _legacyStepColorShift(imageData, w, h, strength, onProgress);
  }

  // ============================================================
  // 透かし埋め込み（常に適用）
  // ============================================================
  async function stepWatermark(data, w, h, onProgress) {
    var msg = 'IMGPROTECT';
    var bits = [];
    for (var ci = 0; ci < msg.length; ci++) {
      var code = msg.charCodeAt(ci);
      for (var bi = 7; bi >= 0; bi--) {
        bits.push((code >> bi) & 1);
      }
    }
    var bitLen = bits.length;

    var pixels = data.data;
    var total = bitLen;
    var CHUNK = 64;

    for (var i0 = 0; i0 < total; i0 += CHUNK) {
      var iEnd = Math.min(i0 + CHUNK, total);
      for (var i = i0; i < iEnd; i++) {
        var px = (i * 97) % w;
        var py = (i * 151) % h;
        var idx = (py * w + px) * 4 + 2; // blue channel
        pixels[idx] = (pixels[idx] & 0xFE) | bits[i % bitLen];
      }
      onProgress(90 + 10 * Math.min(iEnd / total, 1), 'watermark');
      await yieldTick();
    }
  }

  // ============================================================
  // PSNR計測ヘルパー
  // ============================================================
  function measurePSNR(original, perturbed) {
    var d1 = original.data;
    var d2 = perturbed.data;
    var len = d1.length;
    var mse = 0;
    var count = 0;
    for (var i = 0; i < len; i += 4) {
      for (var c = 0; c < 3; c++) {
        var diff = d1[i + c] - d2[i + c];
        mse += diff * diff;
        count++;
      }
    }
    mse /= count;
    if (mse === 0) return Infinity;
    return 10 * Math.log10((255 * 255) / mse);
  }

  // ============================================================
  // メインエントリーポイント
  // AdversarialEngine利用可能 → PGD敵対的摂動
  // 利用不可/失敗 → レガシーノイズにフォールバック
  // 常に透かしを適用
  // ============================================================
  async function perturbImage(file, opts) {
    var options = opts || {};
    var onProgress = options.onProgress || function () {};
    var strength = options.strength !== undefined ? options.strength : 2.0;

    // 出力MIMEタイプ保持
    var mimeType = file.type || 'image/png';
    var outputMime = (mimeType === 'image/jpeg' || mimeType === 'image/webp')
      ? mimeType : 'image/png';
    var outputQuality = (outputMime === 'image/jpeg') ? 0.95
      : (outputMime === 'image/webp') ? 0.95 : 1.0;

    // デコード
    var bitmap = await createImageBitmap(file);
    var w = bitmap.width;
    var h = bitmap.height;

    if (w * h > 20000000) {
      console.warn('Large image may cause performance issues');
    }

    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    var useAdversarial = false;

    // 敵対的摂動を試行 (0-90% progress)
    if (window.AdversarialEngine && window.AdversarialEngine.isAvailable()) {
      try {
        console.log('[ImagePerturbation] Using adversarial PGD perturbation');
        await window.AdversarialEngine.perturbImage(canvas, {
          epsilon: options.epsilon || 8 / 255,
          alpha: options.alpha || 2 / 255,
          iterations: options.iterations || 40,
          onProgress: function (pct, stepName) {
            // 敵対的処理を0-90%にマッピング
            onProgress(pct * 0.9, stepName);
          }
        });
        useAdversarial = true;
      } catch (err) {
        console.warn('[ImagePerturbation] Adversarial failed, falling back to legacy:', err);
        // canvasを再描画（敵対的処理が途中で失敗した場合）
        bitmap = await createImageBitmap(file);
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
      }
    }

    // フォールバック: レガシーノイズ摂動 (0-90%)
    if (!useAdversarial) {
      console.log('[ImagePerturbation] Using legacy noise perturbation');
      var imageData = ctx.getImageData(0, 0, w, h);
      await _legacyPerturb(imageData, w, h, strength, onProgress);
      ctx.putImageData(imageData, 0, 0);
    }

    // 透かし埋め込み（常に適用、90-100%）
    var wmData = ctx.getImageData(0, 0, w, h);
    await stepWatermark(wmData, w, h, onProgress);
    ctx.putImageData(wmData, 0, 0);

    onProgress(100, 'done');

    // Blob出力（フォーマット保持）
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) { blob ? resolve(blob) : reject(new Error('toBlob failed')); },
        outputMime,
        outputQuality
      );
    });
  }

  // ============================================================
  // パブリックAPI
  // ============================================================
  window.ImagePerturbation = {
    perturbImage: perturbImage,
    VERSION: '2.0.0',
    _measurePSNR: measurePSNR
  };
})();

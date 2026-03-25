(function () {
  'use strict';

  // ============================================================
  // PRNG: xorshift32
  // ============================================================
  function xorshift32(state) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state;
  }

  function prngNorm(seed) {
    return xorshift32(seed | 1) / 2147483647;
  }

  // ============================================================
  // Precomputed DCT cosine table: cos(PI * (2n+1) * k / 16)
  // ============================================================
  const COS_TABLE = new Float64Array(64);
  for (let k = 0; k < 8; k++) {
    for (let n = 0; n < 8; n++) {
      COS_TABLE[k * 8 + n] = Math.cos(Math.PI * (2 * n + 1) * k / 16);
    }
  }
  const SQRT_1_8 = 1 / Math.sqrt(8);
  const SQRT_2_8 = Math.sqrt(2 / 8);

  // ============================================================
  // 1-D DCT-II and IDCT-II (length-8)
  // ============================================================
  function dct1d(input, output) {
    for (let k = 0; k < 8; k++) {
      let sum = 0;
      const off = k * 8;
      for (let n = 0; n < 8; n++) sum += input[n] * COS_TABLE[off + n];
      output[k] = sum * (k === 0 ? SQRT_1_8 : SQRT_2_8);
    }
  }

  function idct1d(input, output) {
    for (let n = 0; n < 8; n++) {
      let sum = 0;
      for (let k = 0; k < 8; k++) {
        const ck = k === 0 ? SQRT_1_8 : SQRT_2_8;
        sum += ck * input[k] * COS_TABLE[k * 8 + n];
      }
      output[n] = sum;
    }
  }

  // ============================================================
  // Helpers
  // ============================================================
  function clamp(v) {
    return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  }

  function yieldTick() {
    return new Promise(function (r) { setTimeout(r, 0); });
  }

  // ============================================================
  // Step 1 – High-Frequency Noise Injection (0-25 %)
  // ============================================================
  async function stepNoise(data, w, h, strength, onProgress) {
    const amplitude = strength * 2.5;
    const pixels = data.data;
    const CHUNK = 64;

    for (let row0 = 0; row0 < h; row0 += CHUNK) {
      const rowEnd = Math.min(row0 + CHUNK, h);
      for (let y = row0; y < rowEnd; y++) {
        for (let x = 0; x < w; x++) {
          const cb = ((x + y) % 2 === 0) ? 1.0 : -1.0;
          const seed = x * 7919 + y * 104729;
          const noise = prngNorm(seed) * amplitude * cb;
          const idx = (y * w + x) * 4;
          pixels[idx]     = clamp(pixels[idx]     + noise);
          pixels[idx + 1] = clamp(pixels[idx + 1] + noise);
          pixels[idx + 2] = clamp(pixels[idx + 2] + noise);
        }
      }
      onProgress(0 + 25 * Math.min(rowEnd / h, 1), 'highfreq');
      await yieldTick();
    }
  }

  // ============================================================
  // Step 2 – DCT-Domain Perturbation (25-75 %)
  // ============================================================
  async function stepDCT(data, w, h, strength, onProgress) {
    const pixels = data.data;
    const bw = (w >> 3);          // complete 8-wide blocks
    const bh = (h >> 3);
    const totalBlocks = bw * bh;
    if (totalBlocks === 0) return;

    // Reusable temp buffers
    const block  = new Float64Array(64);
    const tmp    = new Float64Array(8);
    const tmpOut = new Float64Array(8);
    const row8   = new Float64Array(8);
    const col8   = new Float64Array(8);
    const CHUNK  = 64; // rows of blocks

    let processed = 0;

    for (let byStart = 0; byStart < bh; byStart += CHUNK) {
      const byEnd = Math.min(byStart + CHUNK, bh);

      for (let by = byStart; by < byEnd; by++) {
        for (let bx = 0; bx < bw; bx++) {
          const ox = bx * 8;
          const oy = by * 8;

          for (let ch = 0; ch < 3; ch++) {
            // Extract 8x8 block
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                block[r * 8 + c] = pixels[((oy + r) * w + (ox + c)) * 4 + ch];
              }
            }

            // Forward DCT – rows
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) row8[c] = block[r * 8 + c];
              dct1d(row8, tmpOut);
              for (let c = 0; c < 8; c++) block[r * 8 + c] = tmpOut[c];
            }
            // Forward DCT – columns
            for (let c = 0; c < 8; c++) {
              for (let r = 0; r < 8; r++) col8[r] = block[r * 8 + c];
              dct1d(col8, tmpOut);
              for (let r = 0; r < 8; r++) block[r * 8 + c] = tmpOut[r];
            }

            // Perturb mid-frequency coefficients
            for (let u = 2; u <= 5; u++) {
              for (let v = 2; v <= 5; v++) {
                const uv = u + v;
                if (uv < 4 || uv > 8) continue;
                const coeff = block[u * 8 + v];
                const scale = Math.max(Math.abs(coeff) * 0.03, 0.5) * strength;
                const seed = bx * 997 + by * 991 + u * 31 + v * 37 + ch;
                block[u * 8 + v] = coeff + prngNorm(seed) * scale;
              }
            }

            // Inverse DCT – columns
            for (let c = 0; c < 8; c++) {
              for (let r = 0; r < 8; r++) col8[r] = block[r * 8 + c];
              idct1d(col8, tmpOut);
              for (let r = 0; r < 8; r++) block[r * 8 + c] = tmpOut[r];
            }
            // Inverse DCT – rows
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) row8[c] = block[r * 8 + c];
              idct1d(row8, tmpOut);
              for (let c = 0; c < 8; c++) block[r * 8 + c] = tmpOut[c];
            }

            // Write back
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
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

  // ============================================================
  // Step 3 – Color Channel Micro-Shifts (75-90 %)
  // ============================================================
  async function stepColorShift(data, w, h, strength, onProgress) {
    const pixels = data.data;
    const CHUNK = 64;

    for (let row0 = 0; row0 < h; row0 += CHUNK) {
      const rowEnd = Math.min(row0 + CHUNK, h);
      for (let y = row0; y < rowEnd; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          pixels[idx]     = clamp(pixels[idx]     + Math.round(1.5 * Math.sin(x * 0.0147 + y * 0.0093) * strength));
          pixels[idx + 1] = clamp(pixels[idx + 1] + Math.round(1.5 * Math.sin(x * 0.0211 + y * 0.0061) * strength));
          pixels[idx + 2] = clamp(pixels[idx + 2] + Math.round(1.5 * Math.sin(x * 0.0089 + y * 0.0173) * strength));
        }
      }
      onProgress(75 + 15 * Math.min(rowEnd / h, 1), 'colorshift');
      await yieldTick();
    }
  }

  // ============================================================
  // Step 4 – Invisible Watermark (90-100 %)
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
  // PSNR dev helper
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
  // Main entry point
  // ============================================================
  async function perturbImage(file, opts) {
    var options = opts || {};
    var onProgress = options.onProgress || function () {};
    var strength = options.strength !== undefined ? options.strength : 0.8;

    // Determine output MIME type (preserve original format)
    var mimeType = file.type || 'image/png';
    var outputMime = (mimeType === 'image/jpeg' || mimeType === 'image/webp')
      ? mimeType : 'image/png';
    var outputQuality = (outputMime === 'image/jpeg') ? 0.95
      : (outputMime === 'image/webp') ? 0.95 : 1.0;

    // Decode
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
    var imageData = ctx.getImageData(0, 0, w, h);

    // Pipeline
    await stepNoise(imageData, w, h, strength, onProgress);
    await stepDCT(imageData, w, h, strength, onProgress);
    await stepColorShift(imageData, w, h, strength, onProgress);
    await stepWatermark(imageData, w, h, onProgress);

    ctx.putImageData(imageData, 0, 0);
    onProgress(100);

    // Export blob in original format
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) { blob ? resolve(blob) : reject(new Error('toBlob failed')); },
        outputMime,
        outputQuality
      );
    });
  }

  // ============================================================
  // Public API
  // ============================================================
  window.ImagePerturbation = {
    perturbImage: perturbImage,
    VERSION: '1.0.0',
    _measurePSNR: measurePSNR
  };
})();

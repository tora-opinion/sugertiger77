(function () {
  'use strict';

  // ============================================================
  // Adversarial Perturbation Engine — TF.js PGD Attack
  // サロゲートモデルを使用した敵対的摂動エンジン
  // ============================================================

  var _model = null;
  var _modelLoadPromise = null;
  var _modelType = null; // 'pretrained' or 'custom'
  var MODEL_INPUT_SIZE = 224;

  // ---- ユーティリティ ----
  function yieldTick() {
    return new Promise(function (r) { setTimeout(r, 0); });
  }

  // ============================================================
  // カスタムCNN構築（tf.grad対応を保証）
  // ランダム初期化でも畳み込み勾配は空間的に構造化された
  // 摂動を生成し、ランダムノイズより遥かに効果的
  // ============================================================
  function buildSurrogateModel() {
    var model = tf.sequential();
    model.add(tf.layers.conv2d({
      inputShape: [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3],
      filters: 32, kernelSize: 3, activation: 'relu', padding: 'same'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    model.add(tf.layers.conv2d({
      filters: 64, kernelSize: 3, activation: 'relu', padding: 'same'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    model.add(tf.layers.conv2d({
      filters: 128, kernelSize: 3, activation: 'relu', padding: 'same'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    model.add(tf.layers.globalAveragePooling2d({}));
    model.add(tf.layers.dense({ units: 256, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1000, activation: 'softmax' }));
    return model;
  }

  // ============================================================
  // モデル読み込み（デュアルアプローチ）
  // 1. 事前学習済みMobileNet V1（LayersModel）を試行
  // 2. 失敗時はカスタムCNNにフォールバック
  // ============================================================
  async function loadModel(onProgress) {
    if (_model) return _model;
    if (_modelLoadPromise) return _modelLoadPromise;

    _modelLoadPromise = (async function () {
      if (onProgress) onProgress(0, 'モデルを読み込み中...');

      // 事前学習済みMobileNet V1 LayersModelを試行
      var pretrainedUrls = [
        'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json'
      ];

      for (var i = 0; i < pretrainedUrls.length; i++) {
        try {
          if (onProgress) onProgress(10, '事前学習済みモデルをダウンロード中...');
          var loaded = await tf.loadLayersModel(pretrainedUrls[i], {
            onProgress: function (fraction) {
              if (onProgress) onProgress(10 + fraction * 70, '事前学習済みモデルをダウンロード中...');
            }
          });
          _model = loaded;
          _modelType = 'pretrained';
          console.log('[AdversarialEngine] Loaded pretrained model from:', pretrainedUrls[i]);
          if (onProgress) onProgress(100, 'モデル読み込み完了');
          return _model;
        } catch (err) {
          console.warn('[AdversarialEngine] Failed to load pretrained model:', pretrainedUrls[i], err.message);
        }
      }

      // フォールバック: カスタムCNN構築
      if (onProgress) onProgress(80, 'カスタムモデルを構築中...');
      console.log('[AdversarialEngine] Building custom surrogate CNN');
      _model = buildSurrogateModel();
      _modelType = 'custom';

      // ウォームアップ: 一度推論を実行してカーネルをコンパイル
      var warmup = tf.zeros([1, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3]);
      var out = _model.predict(warmup);
      out.dispose();
      warmup.dispose();

      if (onProgress) onProgress(100, 'モデル構築完了');
      console.log('[AdversarialEngine] Custom CNN ready');
      return _model;
    })();

    try {
      return await _modelLoadPromise;
    } catch (err) {
      _modelLoadPromise = null;
      throw err;
    }
  }

  // ============================================================
  // MobileNet V2前処理: [0,1] → [-1,1]
  // カスタムCNN: [0,1]のまま使用
  // ============================================================
  function preprocessForModel(tensor) {
    if (_modelType === 'pretrained') {
      return tensor.mul(2).sub(1);
    }
    return tensor;
  }

  // ============================================================
  // PGD (Projected Gradient Descent) 敵対的摂動
  //
  // アルゴリズム:
  // 1. 画像を224×224にリサイズ → x_small
  // 2. 予測クラス取得: y = argmax(model(preprocess(x_small)))
  // 3. 初期化: x_adv = x_small + uniform(-ε, ε)
  // 4. T回反復:
  //      gradient = ∇_{x_adv} Loss(model(preprocess(x_adv)), y)
  //      x_adv = x_adv + α * sign(gradient)  (非標的: 損失最大化)
  //      delta = clip(x_adv - x_small, -ε, ε)
  //      x_adv = clip(x_small + delta, 0, 1)
  // 5. 摂動量: delta_small = x_adv - x_small (224×224)
  // 6. 元サイズにリサイズ → delta_full
  // 7. 戻り値: x + delta_full (0-1にクランプ)
  // ============================================================
  async function pgdAttack(imageTensor, opts) {
    var epsilon = opts.epsilon || 8 / 255;
    var alpha = opts.alpha || 2 / 255;
    var iterations = opts.iterations || 40;
    var onProgress = opts.onProgress || function () {};

    var model = await loadModel();
    var origH = imageTensor.shape[0];
    var origW = imageTensor.shape[1];

    var xSmall = null;
    var xAdv = null;

    try {
      // Step 1: 224×224にリサイズ
      xSmall = tf.tidy(function () {
        return tf.image.resizeBilinear(
          imageTensor.expandDims(0),
          [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]
        ).squeeze(0);
      });

      // Step 2: 予測クラス取得
      var targetClassIdx = tf.tidy(function () {
        var input = preprocessForModel(xSmall.expandDims(0));
        var logits = model.predict(input);
        return logits.argMax(-1).dataSync()[0];
      });

      // Step 3: PGD初期化（ランダムスタート）
      xAdv = tf.tidy(function () {
        var noise = tf.randomUniform(xSmall.shape, -epsilon, epsilon);
        return xSmall.add(noise).clipByValue(0, 1);
      });

      // Step 4: PGD反復
      for (var t = 0; t < iterations; t++) {
        var newXAdv = tf.tidy(function () {
          // 損失 = -logit(y_true)。勾配降下で損失を最小化 = logitを最大化...ではなく、
          // loss.neg()を返すので、tf.gradの勾配方向に+αすると元クラスのlogitが下がる（非標的攻撃）
          var gradFn = tf.grad(function (xInput) {
            var preprocessed = preprocessForModel(xInput.expandDims(0));
            var logits = model.predict(preprocessed);
            var targetLogit = logits.gather([targetClassIdx], 1).sum();
            return targetLogit.neg();
          });

          var gradient = gradFn(xAdv);

          // x_adv = x_adv + α * sign(gradient)
          // gradient = ∇(-logit_target) = -∇(logit_target)
          // → 加算すると logit_target が減少（非標的攻撃として正しい）
          var step = gradient.sign().mul(alpha);
          var xAdvNew = xAdv.add(step);

          // ε-ball投影
          var delta = xAdvNew.sub(xSmall).clipByValue(-epsilon, epsilon);
          return xSmall.add(delta).clipByValue(0, 1);
        });

        xAdv.dispose();
        xAdv = newXAdv;

        // 5回ごとにメインスレッドに制御を返す
        if (t % 5 === 0) {
          onProgress(Math.round((t / iterations) * 100), 'adversarial');
          await yieldTick();
        }
      }

      onProgress(100, 'adversarial');

      // Step 5-6: 摂動量を元サイズにリサイズ
      var result = tf.tidy(function () {
        var deltaSmall = xAdv.sub(xSmall);
        var deltaFull = tf.image.resizeBilinear(
          deltaSmall.expandDims(0),
          [origH, origW]
        ).squeeze(0);
        return imageTensor.add(deltaFull).clipByValue(0, 1);
      });

      return result;
    } finally {
      if (xSmall) xSmall.dispose();
      if (xAdv) xAdv.dispose();
    }
  }

  // ============================================================
  // メインAPI: canvas上の画像に敵対的摂動を適用
  // ============================================================
  async function perturbImage(canvas, opts) {
    var options = opts || {};
    var onProgress = options.onProgress || function () {};

    onProgress(0, 'preparing');

    // canvasからテンソルに変換 [0, 1]
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var w = canvas.width;
    var h = canvas.height;
    var imageData = ctx.getImageData(0, 0, w, h);

    var imageTensor = tf.tidy(function () {
      return tf.browser.fromPixels(imageData).toFloat().div(255);
    });

    // PGD攻撃実行
    var advTensor;
    try {
      advTensor = await pgdAttack(imageTensor, {
        epsilon: options.epsilon || 8 / 255,
        alpha: options.alpha || 2 / 255,
        iterations: options.iterations || 40,
        onProgress: function (pct, step) {
          onProgress(pct, step);
        }
      });
    } finally {
      imageTensor.dispose();
    }

    // テンソルをcanvasに書き戻し
    try {
      await tf.browser.toPixels(advTensor, canvas);
    } finally {
      advTensor.dispose();
    }

    onProgress(100, 'done');
  }

  // ============================================================
  // パブリックAPI
  // ============================================================
  window.AdversarialEngine = {
    perturbImage: perturbImage,
    loadModel: loadModel,
    isAvailable: function () {
      return typeof tf !== 'undefined';
    },
    VERSION: '1.0.0'
  };

})();

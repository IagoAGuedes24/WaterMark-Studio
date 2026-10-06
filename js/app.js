/**
 * Watermark Studio - Aplicação Completa
 * Empacotado para execução universal (funciona tanto em http://, https:// quanto via file://)
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. StorageManager: Gerenciamento de Arquivos e Pastas
     ========================================================================== */
  const StorageManager = {
    isSupported() {
      return 'showDirectoryPicker' in window && window.isSecureContext;
    },

    async pickInputDirectory() {
      if (!('showDirectoryPicker' in window)) {
        throw new Error('showDirectoryPicker não suportado.');
      }

      const dirHandle = await window.showDirectoryPicker({
        id: 'watermark-input-dir',
        mode: 'read',
        startIn: 'pictures'
      });

      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
      const files = [];

      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file') {
          const lowerName = name.toLowerCase();
          if (validExtensions.some(ext => lowerName.endsWith(ext))) {
            files.push({
              name,
              handle,
              getFile: () => handle.getFile()
            });
          }
        }
      }

      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      return { dirHandle, files };
    },

    async pickOutputDirectory() {
      if (!('showDirectoryPicker' in window)) {
        throw new Error('showDirectoryPicker não suportado.');
      }

      const dirHandle = await window.showDirectoryPicker({
        id: 'watermark-output-dir',
        mode: 'readwrite',
        startIn: 'pictures'
      });

      const permission = await this.verifyPermission(dirHandle, true);
      if (!permission) {
        throw new Error('Permissão de gravação na pasta de destino não foi concedida.');
      }

      return dirHandle;
    },

    async saveFile(dirHandle, fileName, blob) {
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    },

    async verifyPermission(fileHandle, readWrite = false) {
      const options = {};
      if (readWrite) options.mode = 'readwrite';

      if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
      }
      if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
      }
      return false;
    }
  };

  /* ==========================================================================
     2. WatermarkEngine: Processamento no Canvas & EXIF
     ========================================================================== */
  class WatermarkEngine {
    constructor() {
      this.watermarkImage = null;
      this.watermarkAspect = 1;
      this.watermarkWidth = 0;
      this.watermarkHeight = 0;
    }

    async loadWatermark(source) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          this.watermarkImage = img;
          this.watermarkWidth = img.naturalWidth || img.width;
          this.watermarkHeight = img.naturalHeight || img.height;
          this.watermarkAspect = this.watermarkWidth / this.watermarkHeight;
          resolve();
        };

        img.onerror = () => reject(new Error('Falha ao carregar a imagem da marca d\'água.'));

        if (typeof source === 'string') {
          img.src = source;
        } else {
          img.src = URL.createObjectURL(source);
        }
      });
    }

    calculatePlacement(photoWidth, photoHeight, config) {
      const { position = 'bottom-right', sizePercent = 14, marginPercent = 3, scaleMode = 'min' } = config;
      const referenceDim = scaleMode === 'width' ? photoWidth : Math.min(photoWidth, photoHeight);

      const wmWidth = Math.round(referenceDim * (sizePercent / 100));
      const wmHeight = Math.round(wmWidth / this.watermarkAspect);
      const margin = Math.round(referenceDim * (marginPercent / 100));

      let x = 0;
      let y = 0;

      switch (position) {
        case 'top-left':
          x = margin;
          y = margin;
          break;
        case 'top-center':
          x = Math.round((photoWidth - wmWidth) / 2);
          y = margin;
          break;
        case 'top-right':
          x = photoWidth - wmWidth - margin;
          y = margin;
          break;
        case 'middle-left':
          x = margin;
          y = Math.round((photoHeight - wmHeight) / 2);
          break;
        case 'center':
          x = Math.round((photoWidth - wmWidth) / 2);
          y = Math.round((photoHeight - wmHeight) / 2);
          break;
        case 'middle-right':
          x = photoWidth - wmWidth - margin;
          y = Math.round((photoHeight - wmHeight) / 2);
          break;
        case 'bottom-left':
          x = margin;
          y = photoHeight - wmHeight - margin;
          break;
        case 'bottom-center':
          x = Math.round((photoWidth - wmWidth) / 2);
          y = photoHeight - wmHeight - margin;
          break;
        case 'bottom-right':
        default:
          x = photoWidth - wmWidth - margin;
          y = photoHeight - wmHeight - margin;
          break;
      }

      return { x, y, width: wmWidth, height: wmHeight };
    }

    async decodeImage(file) {
      if ('createImageBitmap' in window) {
        try {
          return await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch (e) {
          return await createImageBitmap(file);
        }
      }

      return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Erro ao decodificar imagem'));
        };
        img.src = url;
      });
    }

    async processImage(photoFile, config) {
      if (!this.watermarkImage) {
        throw new Error('Nenhuma marca d\'água foi carregada.');
      }

      const photoBitmap = await this.decodeImage(photoFile);
      const photoWidth = photoBitmap.width;
      const photoHeight = photoBitmap.height;

      const canvas = document.createElement('canvas');
      canvas.width = photoWidth;
      canvas.height = photoHeight;
      const ctx = canvas.getContext('2d');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Desenhar a foto base
      ctx.drawImage(photoBitmap, 0, 0, photoWidth, photoHeight);

      if (typeof photoBitmap.close === 'function') {
        photoBitmap.close();
      }

      // 2. Desenhar a marca d'água
      const placement = this.calculatePlacement(photoWidth, photoHeight, config);

      ctx.save();
      ctx.globalAlpha = (config.opacity ?? 95) / 100;
      ctx.drawImage(this.watermarkImage, placement.x, placement.y, placement.width, placement.height);
      ctx.restore();

      const quality = (config.quality ?? 92) / 100;

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            canvas.width = 1;
            canvas.height = 1;
            if (blob) resolve(blob);
            else reject(new Error('Falha ao exportar JPEG.'));
          },
          'image/jpeg',
          quality
        );
      });
    }

    renderPreview(previewCanvas, sampleImage, config) {
      if (!sampleImage) return;

      const ctx = previewCanvas.getContext('2d');
      const photoWidth = sampleImage.width;
      const photoHeight = sampleImage.height;

      previewCanvas.width = photoWidth;
      previewCanvas.height = photoHeight;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(sampleImage, 0, 0, photoWidth, photoHeight);

      if (this.watermarkImage) {
        const placement = this.calculatePlacement(photoWidth, photoHeight, config);

        ctx.save();
        ctx.globalAlpha = (config.opacity ?? 95) / 100;
        ctx.drawImage(this.watermarkImage, placement.x, placement.y, placement.width, placement.height);
        ctx.restore();

        if (config.showPlacementBox) {
          ctx.save();
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = Math.max(3, Math.round(photoWidth * 0.002));
          ctx.setLineDash([10, 8]);
          ctx.strokeRect(placement.x, placement.y, placement.width, placement.height);
          ctx.restore();
        }
      }
    }
  }

  /* ==========================================================================
     3. Controlador da Interface e Aplicação
     ========================================================================== */
  const state = {
    engine: new WatermarkEngine(),
    inputFiles: [],
    previewSamples: [], // Limite inteligente: máximo 10 fotos para navegação
    inputDirHandle: null,
    outputDirHandle: null,
    currentSampleIndex: 0,
    currentSampleBitmap: null,
    isProcessing: false,
    isPaused: false,
    isCancelled: false,
    config: {
      position: 'bottom-right',
      sizePercent: 14,
      marginPercent: 3,
      opacity: 95,
      quality: 92,
      scaleMode: 'min',
      showPlacementBox: false,
      fileSuffix: ''
    }
  };

  let elements = {};

  function initApp() {
    bindElements();
    setupEventListeners();
    checkProtocolNotice();

    // Carregar logo sugerida padrão (Crisma de Fátima)
    const DEFAULT_SUGGESTED_LOGO = './assets/logo-crisma-fatima.png';
    state.engine.loadWatermark(DEFAULT_SUGGESTED_LOGO)
      .then(() => {
        if (elements.watermarkNameDisplay) elements.watermarkNameDisplay.textContent = 'Crisma de Fátima (Sugerida)';
        if (elements.watermarkPreviewThumb) {
          elements.watermarkPreviewThumb.src = DEFAULT_SUGGESTED_LOGO;
          elements.watermarkPreviewThumb.style.display = 'block';
        }
      })
      .catch((err) => console.warn('Não foi possível carregar a logo sugerida:', err));

    createPlaceholderSample();
  }

  function bindElements() {
    elements = {
      btnSelectInputDir: document.getElementById('btn-select-input-dir'),
      btnSelectOutputDir: document.getElementById('btn-select-output-dir'),
      inputFolderFallback: document.getElementById('input-folder-fallback'),
      inputWatermarkFile: document.getElementById('input-watermark-file'),
      watermarkDropZone: document.getElementById('watermark-drop-zone'),
      watermarkPreviewThumb: document.getElementById('watermark-preview-thumb'),
      watermarkNameDisplay: document.getElementById('watermark-name-display'),
      inputDirStatus: document.getElementById('input-dir-status'),
      outputDirStatus: document.getElementById('output-dir-status'),

      positionButtons: document.querySelectorAll('.position-btn'),
      sliderSize: document.getElementById('slider-size'),
      valSize: document.getElementById('val-size'),
      sliderMargin: document.getElementById('slider-margin'),
      valMargin: document.getElementById('val-margin'),
      sliderOpacity: document.getElementById('slider-opacity'),
      valOpacity: document.getElementById('val-opacity'),
      selectQuality: document.getElementById('select-quality'),
      selectScaleMode: document.getElementById('select-scale-mode'),
      inputFileSuffix: document.getElementById('input-file-suffix'),
      checkPlacementBox: document.getElementById('check-placement-box'),

      previewCanvas: document.getElementById('preview-canvas'),
      previewContainer: document.getElementById('preview-container'),
      previewInfoBadge: document.getElementById('preview-info-badge'),
      previewOrientationBadge: document.getElementById('preview-orientation-badge'),
      btnPrevSample: document.getElementById('btn-prev-sample'),
      btnNextSample: document.getElementById('btn-next-sample'),
      sampleCounter: document.getElementById('sample-counter'),

      btnStartProcess: document.getElementById('btn-start-process'),
      processingCard: document.getElementById('processing-card'),
      progressBar: document.getElementById('progress-bar'),
      progressPercent: document.getElementById('progress-percent'),
      progressCounter: document.getElementById('progress-counter'),
      progressEta: document.getElementById('progress-eta'),
      progressCurrentFile: document.getElementById('progress-current-file'),
      btnPauseProcess: document.getElementById('btn-pause-process'),
      btnCancelProcess: document.getElementById('btn-cancel-process'),

      modalSuccess: document.getElementById('modal-success'),
      modalSuccessClose: document.getElementById('modal-success-close'),
      modalTotalProcessed: document.getElementById('modal-total-processed'),
      modalTotalTime: document.getElementById('modal-total-time'),
      modalAvgSpeed: document.getElementById('modal-avg-speed')
    };
  }

  function checkProtocolNotice() {
    const isFileProtocol = window.location.protocol === 'file:';
    const warningBox = document.getElementById('browser-warning');
    if (isFileProtocol && warningBox) {
      warningBox.style.display = 'flex';
      warningBox.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>
          <strong>Dica:</strong> Você abriu o arquivo direto (protocolo <code>file://</code>). 
          Para salvar automaticamente centenas de fotos direto nas pastas do seu computador, execute o <strong>iniciar_local.bat</strong> ou use o link online do GitHub Pages!
        </span>
      `;
    }
  }

  function setupEventListeners() {
    // 1. Botões de Pasta
    elements.btnSelectInputDir.addEventListener('click', handleSelectInputDir);
    elements.btnSelectOutputDir.addEventListener('click', handleSelectOutputDir);

    // Fallback de Seleção de Pasta
    elements.inputFolderFallback.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFallbackFolderFiles(Array.from(e.target.files));
      }
    });

    // 2. Upload de Logo & Botão de Logo Sugerida
    const btnUseSuggested = document.getElementById('btn-use-suggested-logo');
    if (btnUseSuggested) {
      btnUseSuggested.addEventListener('click', async () => {
        try {
          await state.engine.loadWatermark('./assets/logo-crisma-fatima.png');
          elements.watermarkNameDisplay.textContent = 'Crisma de Fátima (Sugerida)';
          elements.watermarkPreviewThumb.src = './assets/logo-crisma-fatima.png';
          elements.watermarkPreviewThumb.style.display = 'block';
          renderCurrentPreview();
        } catch (err) {
          alert('Erro ao carregar a logo sugerida: ' + err.message);
        }
      });
    }

    elements.inputWatermarkFile.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        loadCustomWatermark(e.target.files[0]);
      }
    });

    // Drag and Drop para a logo
    elements.watermarkDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.watermarkDropZone.classList.add('dragover');
    });

    elements.watermarkDropZone.addEventListener('dragleave', () => {
      elements.watermarkDropZone.classList.remove('dragover');
    });

    elements.watermarkDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.watermarkDropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        loadCustomWatermark(e.dataTransfer.files[0]);
      }
    });

    // 3. Grid de Posicionamento (9 Posições)
    elements.positionButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        elements.positionButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.config.position = btn.dataset.position;
        renderCurrentPreview();
      });
    });

    // 4. Sliders e Seletores
    elements.sliderSize.addEventListener('input', (e) => {
      state.config.sizePercent = parseFloat(e.target.value);
      elements.valSize.textContent = `${state.config.sizePercent}%`;
      renderCurrentPreview();
    });

    elements.sliderMargin.addEventListener('input', (e) => {
      state.config.marginPercent = parseFloat(e.target.value);
      elements.valMargin.textContent = `${state.config.marginPercent}%`;
      renderCurrentPreview();
    });

    elements.sliderOpacity.addEventListener('input', (e) => {
      state.config.opacity = parseInt(e.target.value, 10);
      elements.valOpacity.textContent = `${state.config.opacity}%`;
      renderCurrentPreview();
    });

    elements.selectQuality.addEventListener('change', (e) => {
      state.config.quality = parseInt(e.target.value, 10);
    });

    elements.selectScaleMode.addEventListener('change', (e) => {
      state.config.scaleMode = e.target.value;
      renderCurrentPreview();
    });

    elements.inputFileSuffix.addEventListener('input', (e) => {
      state.config.fileSuffix = e.target.value;
    });

    elements.checkPlacementBox.addEventListener('change', (e) => {
      state.config.showPlacementBox = e.target.checked;
      renderCurrentPreview();
    });

    // 5. Navegação de Fotos de Amostra (Limite de 10 amostras)
    elements.btnPrevSample.addEventListener('click', () => navigateSample(-1));
    elements.btnNextSample.addEventListener('click', () => navigateSample(1));

    // 6. Botão de Iniciar Processamento
    elements.btnStartProcess.addEventListener('click', startBatchProcessing);
    elements.btnPauseProcess.addEventListener('click', togglePauseProcessing);
    elements.btnCancelProcess.addEventListener('click', cancelBatchProcessing);

    // 7. Modal
    elements.modalSuccessClose.addEventListener('click', () => {
      elements.modalSuccess.style.display = 'none';
    });
  }

  function createPlaceholderSample() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 1920, 1080);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1920, 1080);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1920; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1080);
      ctx.stroke();
    }
    for (let y = 0; y < 1080; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1920, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '600 36px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Amostra de Demonstração (1920 × 1080 px)', 1920 / 2, 1080 / 2 - 20);
    ctx.font = '400 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Selecione a pasta com suas fotos para visualizar o teste real aqui', 1920 / 2, 1080 / 2 + 30);

    state.currentSampleBitmap = canvas;
    updatePreviewInfo(1920, 1080, 'Demonstração');
    renderCurrentPreview();
  }

  async function loadCustomWatermark(file) {
    try {
      await state.engine.loadWatermark(file);
      elements.watermarkNameDisplay.textContent = file.name;
      elements.watermarkPreviewThumb.src = URL.createObjectURL(file);
      elements.watermarkPreviewThumb.style.display = 'block';
      renderCurrentPreview();
    } catch (err) {
      alert('Erro ao carregar a marca d\'água: ' + err.message);
    }
  }

  async function handleSelectInputDir() {
    // Tenta usar File System Access API se suportado e seguro
    if (StorageManager.isSupported() && window.location.protocol !== 'file:') {
      try {
        const { dirHandle, files } = await StorageManager.pickInputDirectory();
        if (files.length === 0) {
          alert('Nenhuma foto (JPG, PNG, WebP) foi encontrada na pasta selecionada.');
          return;
        }

        applyLoadedFiles(files, dirHandle.name, dirHandle);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('showDirectoryPicker não pôde ser usado, utilizando seletor nativo:', err);
      }
    }

    // Fallback garantido: abre o seletor nativo de pastas do sistema
    elements.inputFolderFallback.click();
  }

  function handleFallbackFolderFiles(rawFiles) {
    const validExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const files = rawFiles
      .filter((file) => {
        const lower = file.name.toLowerCase();
        return validExts.some((ext) => lower.endsWith(ext));
      })
      .map((file) => ({
        name: file.name,
        handle: null,
        fileObj: file,
        getFile: async () => file
      }));

    if (files.length === 0) {
      alert('Nenhuma foto válida (JPG, PNG, WebP) foi encontrada na pasta selecionada.');
      return;
    }

    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const folderName = rawFiles[0].webkitRelativePath
      ? rawFiles[0].webkitRelativePath.split('/')[0]
      : 'Pasta de Fotos';

    applyLoadedFiles(files, folderName, null);
  }

  function applyLoadedFiles(files, folderName, dirHandle = null) {
    state.inputDirHandle = dirHandle;
    state.inputFiles = files;
    
    // Limite inteligente: seleciona as primeiras 10 fotos para a prévia visual
    state.previewSamples = files.slice(0, 10);
    state.currentSampleIndex = 0;

    elements.inputDirStatus.innerHTML = `<strong>${files.length}</strong> fotos encontradas em <code>${folderName}</code>`;
    elements.inputDirStatus.classList.add('ready');

    elements.btnPrevSample.disabled = false;
    elements.btnNextSample.disabled = false;

    loadSamplePhoto(0);
    checkReadyToProcess();
  }

  async function handleSelectOutputDir() {
    if (StorageManager.isSupported() && window.location.protocol !== 'file:') {
      try {
        const dirHandle = await StorageManager.pickOutputDirectory();
        state.outputDirHandle = dirHandle;

        elements.outputDirStatus.innerHTML = `Destino definido: <code>${dirHandle.name}</code>`;
        elements.outputDirStatus.classList.add('ready');
        checkReadyToProcess();
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        alert('Aviso: ' + err.message);
      }
    } else {
      alert(
        'Aviso de Permissão:\n\n' +
        'O navegador só permite gravar automaticamente direto no disco quando o app roda em um servidor seguro (como o iniciar_local.bat ou no GitHub Pages).\n\n' +
        'Recomendamos dar dois cliques no arquivo "iniciar_local.bat" na pasta do projeto para liberar o salvamento direto no Windows!'
      );
    }
  }

  async function loadSamplePhoto(index) {
    if (!state.previewSamples || state.previewSamples.length === 0) return;

    const item = state.previewSamples[index];
    try {
      const file = await item.getFile();
      const bitmap = await state.engine.decodeImage(file);

      if (state.currentSampleBitmap && typeof state.currentSampleBitmap.close === 'function') {
        state.currentSampleBitmap.close();
      }

      state.currentSampleBitmap = bitmap;
      elements.sampleCounter.textContent = `Amostra ${index + 1} de ${state.previewSamples.length}`;

      const orientation = bitmap.width >= bitmap.height ? 'Horizontal' : 'Vertical';
      updatePreviewInfo(bitmap.width, bitmap.height, item.name, orientation);
      renderCurrentPreview();
    } catch (err) {
      console.error('Erro ao carregar amostra:', err);
    }
  }

  async function navigateSample(delta) {
    if (state.previewSamples.length === 0) return;

    let newIndex = state.currentSampleIndex + delta;
    if (newIndex < 0) newIndex = state.previewSamples.length - 1;
    if (newIndex >= state.previewSamples.length) newIndex = 0;

    state.currentSampleIndex = newIndex;
    await loadSamplePhoto(newIndex);
  }

  function updatePreviewInfo(width, height, name, orientation = null) {
    elements.previewInfoBadge.textContent = `${width} × ${height} px • ${name}`;
    if (orientation) {
      elements.previewOrientationBadge.textContent = orientation;
      elements.previewOrientationBadge.className = 'badge ' + (orientation === 'Vertical' ? 'badge-vertical' : 'badge-horizontal');
      elements.previewOrientationBadge.style.display = 'inline-flex';
    } else {
      elements.previewOrientationBadge.style.display = 'none';
    }
  }

  let previewAnimFrame = null;
  function renderCurrentPreview() {
    if (previewAnimFrame) cancelAnimationFrame(previewAnimFrame);

    previewAnimFrame = requestAnimationFrame(() => {
      if (state.currentSampleBitmap) {
        state.engine.renderPreview(elements.previewCanvas, state.currentSampleBitmap, state.config);
      }
    });
  }

  function checkReadyToProcess() {
    const ready = state.inputFiles.length > 0 && state.outputDirHandle !== null;
    elements.btnStartProcess.disabled = !ready;
    if (ready) {
      elements.btnStartProcess.classList.add('pulse');
    } else {
      elements.btnStartProcess.classList.remove('pulse');
    }
  }

  async function startBatchProcessing() {
    if (state.inputFiles.length === 0) {
      alert('Por favor, selecione primeiro a pasta de fotos de origem.');
      return;
    }

    if (!state.outputDirHandle) {
      alert('Por favor, selecione primeiro a pasta onde as fotos serão salvas.');
      await handleSelectOutputDir();
      if (!state.outputDirHandle) return;
    }

    state.isProcessing = true;
    state.isPaused = false;
    state.isCancelled = false;

    toggleControlsDisabled(true);
    elements.processingCard.style.display = 'block';
    elements.processingCard.scrollIntoView({ behavior: 'smooth' });

    const total = state.inputFiles.length;
    let processed = 0;
    const startTime = performance.now();
    elements.btnPauseProcess.textContent = 'Pausar';

    for (let i = 0; i < total; i++) {
      if (state.isCancelled) break;

      while (state.isPaused && !state.isCancelled) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const item = state.inputFiles[i];
      elements.progressCurrentFile.textContent = item.name;

      try {
        const file = await item.getFile();
        const processedBlob = await state.engine.processImage(file, state.config);

        let outputName = item.name;
        if (state.config.fileSuffix) {
          const lastDot = item.name.lastIndexOf('.');
          if (lastDot > 0) {
            outputName = `${item.name.substring(0, lastDot)}_${state.config.fileSuffix}${item.name.substring(lastDot)}`;
          }
        }

        await StorageManager.saveFile(state.outputDirHandle, outputName, processedBlob);
        processed++;
      } catch (err) {
        console.error(`Erro ao processar ${item.name}:`, err);
      }

      const currentPercent = Math.round(((i + 1) / total) * 100);
      elements.progressBar.style.width = `${currentPercent}%`;
      elements.progressPercent.textContent = `${currentPercent}%`;
      elements.progressCounter.textContent = `${i + 1} de ${total} fotos`;

      const elapsedSeconds = (performance.now() - startTime) / 1000;
      const speed = (i + 1) / elapsedSeconds;
      const remainingSeconds = Math.max(0, (total - (i + 1)) / (speed || 1));
      elements.progressEta.textContent = `Tempo restante: ~${formatSeconds(remainingSeconds)} (${speed.toFixed(1)} fotos/s)`;
    }

    const totalDuration = (performance.now() - startTime) / 1000;
    state.isProcessing = false;
    toggleControlsDisabled(false);
    elements.processingCard.style.display = 'none';

    if (!state.isCancelled) {
      elements.modalTotalProcessed.textContent = `${processed} de ${total} fotos`;
      elements.modalTotalTime.textContent = formatSeconds(totalDuration);
      elements.modalAvgSpeed.textContent = `${(processed / totalDuration).toFixed(1)} fotos/s`;
      elements.modalSuccess.style.display = 'flex';
    } else {
      alert(`Processamento cancelado pelo usuário. ${processed} fotos foram salvas antes do cancelamento.`);
    }
  }

  function togglePauseProcessing() {
    state.isPaused = !state.isPaused;
    elements.btnPauseProcess.textContent = state.isPaused ? 'Continuar' : 'Pausar';
  }

  function cancelBatchProcessing() {
    if (confirm('Tem certeza de que deseja interromper o processamento em lote?')) {
      state.isCancelled = true;
      state.isPaused = false;
    }
  }

  function toggleControlsDisabled(disabled) {
    elements.btnSelectInputDir.disabled = disabled;
    elements.btnSelectOutputDir.disabled = disabled;
    elements.btnStartProcess.disabled = disabled;
    elements.sliderSize.disabled = disabled;
    elements.sliderMargin.disabled = disabled;
    elements.sliderOpacity.disabled = disabled;
    elements.positionButtons.forEach((btn) => (btn.disabled = disabled));
  }

  function formatSeconds(sec) {
    const s = Math.round(sec);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const remainingS = s % 60;
    return `${m}m ${remainingS}s`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();

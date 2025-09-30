// Gerenciador de Galeria - Fotos Dinâmicas
class GalleryManager {
  constructor() {
    this.photos = [];
    this.isLoading = false;
    this.lastLoadTime = null;
    this.currentPhotoIndex = 0;
    this.fallbackPhotos = this.getFallbackPhotos();
    this.lazyLoadObserver = null;
  }

  /**
   * Carrega fotos do espaço do Supabase
   * @param {boolean} useCache - Se deve usar cache
   * @returns {Promise<Array>} Lista de fotos
   */
  async loadSpacePhotos(useCache = true) {
    console.log('📸 Carregando fotos do espaço...', { useCache });
    
    // Verificar cache primeiro
    if (useCache) {
      const cacheKey = cacheManager.generateKey('space_photos');
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('🎯 Fotos carregadas do cache');
        this.photos = cached;
        return cached;
      }
    }

    // Evitar múltiplas requisições simultâneas
    if (this.isLoading) {
      console.log('⏳ Carregamento já em andamento...');
      return this.photos;
    }

    this.isLoading = true;

    try {
      // Tentar carregar do Supabase
      const result = await this.loadFromSupabase();
      
      if (result.success && result.data.length > 0) {
        this.photos = result.data;
        this.lastLoadTime = Date.now();
        
        // Salvar no cache
        const cacheKey = cacheManager.generateKey('space_photos');
        cacheManager.set(cacheKey, this.photos);
        
        console.log(`✅ ${this.photos.length} fotos carregadas do Supabase`);
        return this.photos;
      } else {
        throw new Error(result.error || 'Nenhuma foto encontrada');
      }
      
    } catch (error) {
      console.warn('⚠️ Falha ao carregar do Supabase, usando fallback:', error.message);
      
      // Usar dados de fallback
      this.photos = this.fallbackPhotos;
      return this.photos;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Carrega fotos do Supabase
   * @returns {Promise<Object>} Resultado da operação
   */
  async loadFromSupabase() {
    try {
      if (!window.supabaseClient) {
        throw new Error('Cliente Supabase não disponível');
      }

      const result = await supabaseClient.getSpacePhotos(false);
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Validar e processar fotos
      const validPhotos = [];
      for (const photo of result.data || []) {
        if (this.isValidPhoto(photo)) {
          validPhotos.push(this.processPhoto(photo));
        } else {
          console.warn('⚠️ Foto inválida ignorada:', photo);
        }
      }

      return {
        success: true,
        data: validPhotos
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Valida dados de uma foto
   * @param {Object} photo - Dados da foto
   * @returns {boolean} Se a foto é válida
   */
  isValidPhoto(photo) {
    return photo && 
           (photo.image_url || photo.url) && 
           typeof (photo.image_url || photo.url) === 'string';
  }

  /**
   * Processa dados de uma foto
   * @param {Object} photo - Dados brutos da foto
   * @returns {Object} Foto processada
   */
  processPhoto(photo) {
    return {
      id: photo.id || Date.now() + Math.random(),
      url: photo.image_url || photo.url,
      title: photo.title || photo.name || 'Foto do espaço',
      description: photo.description || '',
      upload_date: photo.upload_date || photo.created_at || new Date().toISOString(),
      category: photo.category || 'espaco'
    };
  }

  /**
   * Exibe galeria de fotos em modal
   * @param {number} startIndex - Índice da foto inicial
   */
  async showGallery(startIndex = 0) {
    console.log('🖼️ Exibindo galeria de fotos...');

    try {
      // Carregar fotos se necessário
      if (this.photos.length === 0) {
        await this.loadSpacePhotos();
      }

      // Criar modal da galeria
      const modal = this.createGalleryModal();
      document.body.appendChild(modal);

      // Renderizar fotos
      this.renderGalleryPhotos(modal);

      // Configurar navegação
      this.setupGalleryNavigation(modal, startIndex);

      // Exibir modal
      modal.style.display = 'flex';

      console.log(`🎨 Galeria exibida com ${this.photos.length} fotos`);

    } catch (error) {
      console.error('❌ Erro ao exibir galeria:', error);
      this.showErrorMessage('Erro ao carregar galeria de fotos');
    }
  }

  /**
   * Cria modal da galeria
   * @returns {HTMLElement} Modal da galeria
   */
  createGalleryModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'galleryModal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 90%; max-height: 90%; overflow: hidden;">
        <div class="modal-header">
          <h3 class="modal-title">📸 Fotos do Espaço</h3>
          <button class="close-modal" type="button">&times;</button>
        </div>
        
        <div class="gallery-container" style="height: 70vh; overflow-y: auto;">
          <div class="gallery-loading" style="text-align: center; padding: 40px; color: #666;">
            <div style="font-size: 2rem; margin-bottom: 10px;">📸</div>
            <div>Carregando fotos...</div>
          </div>
        </div>
      </div>
    `;

    // Configurar eventos de fechamento
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.addEventListener('click', () => this.closeGallery());
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeGallery();
    });

    return modal;
  }

  /**
   * Renderiza fotos na galeria
   * @param {HTMLElement} modal - Modal da galeria
   */
  renderGalleryPhotos(modal) {
    const container = modal.querySelector('.gallery-container');
    
    if (this.photos.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <div style="font-size: 3rem; margin-bottom: 15px;">📷</div>
          <h3>Nenhuma foto disponível</h3>
          <p>As fotos do espaço serão adicionadas em breve!</p>
        </div>
      `;
      return;
    }

    // Criar grid de fotos
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 15px;
      padding: 20px;
    `;

    this.photos.forEach((photo, index) => {
      const photoElement = this.createPhotoElement(photo, index);
      grid.appendChild(photoElement);
    });

    container.innerHTML = '';
    container.appendChild(grid);

    // Configurar lazy loading
    this.setupLazyLoading();
  }

  /**
   * Cria elemento de uma foto
   * @param {Object} photo - Dados da foto
   * @param {number} index - Índice da foto
   * @returns {HTMLElement} Elemento da foto
   */
  createPhotoElement(photo, index) {
    const photoDiv = document.createElement('div');
    photoDiv.className = 'gallery-item';
    photoDiv.style.cssText = `
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      aspect-ratio: 4/3;
      background: #f5f5f5;
      position: relative;
      transition: transform 0.3s ease;
    `;

    photoDiv.innerHTML = `
      <img data-src="${photo.url}" 
           alt="${photo.title}"
           style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;"
           class="lazy-load">
      <div class="photo-overlay" style="
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgba(0,0,0,0.7));
        color: white;
        padding: 15px;
        transform: translateY(100%);
        transition: transform 0.3s ease;
        font-size: 0.9rem;
      ">
        <div style="font-weight: 600;">${photo.title}</div>
        ${photo.description ? `<div style="font-size: 0.8rem; opacity: 0.9;">${photo.description}</div>` : ''}
      </div>
    `;

    // Eventos de hover
    photoDiv.addEventListener('mouseenter', () => {
      photoDiv.style.transform = 'translateY(-3px)';
      const overlay = photoDiv.querySelector('.photo-overlay');
      overlay.style.transform = 'translateY(0)';
    });

    photoDiv.addEventListener('mouseleave', () => {
      photoDiv.style.transform = 'translateY(0)';
      const overlay = photoDiv.querySelector('.photo-overlay');
      overlay.style.transform = 'translateY(100%)';
    });

    // Evento de clique para visualização ampliada
    photoDiv.addEventListener('click', () => {
      this.showPhotoViewer(index);
    });

    return photoDiv;
  }

  /**
   * Configura lazy loading para as imagens
   */
  setupLazyLoading() {
    if (this.lazyLoadObserver) {
      this.lazyLoadObserver.disconnect();
    }

    this.lazyLoadObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.getAttribute('data-src');
          
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.remove('lazy-load');
            this.lazyLoadObserver.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px'
    });

    // Observar todas as imagens lazy
    document.querySelectorAll('.lazy-load').forEach(img => {
      this.lazyLoadObserver.observe(img);
    });
  }

  /**
   * Exibe visualizador de foto ampliada
   * @param {number} photoIndex - Índice da foto
   */
  showPhotoViewer(photoIndex) {
    this.currentPhotoIndex = photoIndex;
    
    const viewer = this.createPhotoViewer();
    document.body.appendChild(viewer);
    
    this.updatePhotoViewer(viewer);
    viewer.style.display = 'flex';
  }

  /**
   * Cria visualizador de foto
   * @returns {HTMLElement} Visualizador
   */
  createPhotoViewer() {
    const viewer = document.createElement('div');
    viewer.className = 'image-viewer';
    viewer.id = 'photoViewer';
    viewer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.9);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    `;

    viewer.innerHTML = `
      <button class="viewer-close" style="
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255,255,255,0.2);
        color: white;
        border: none;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        font-size: 2rem;
        cursor: pointer;
        z-index: 2001;
      ">&times;</button>
      
      <button class="viewer-prev" style="
        position: absolute;
        left: 20px;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(255,255,255,0.2);
        color: white;
        border: none;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        font-size: 2rem;
        cursor: pointer;
        z-index: 2001;
      ">‹</button>
      
      <button class="viewer-next" style="
        position: absolute;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(255,255,255,0.2);
        color: white;
        border: none;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        font-size: 2rem;
        cursor: pointer;
        z-index: 2001;
      ">›</button>
      
      <div class="viewer-content" style="
        max-width: 90%;
        max-height: 80%;
        text-align: center;
      ">
        <img id="viewerImage" style="
          max-width: 100%;
          max-height: 100%;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        ">
        <div id="viewerInfo" style="
          color: white;
          margin-top: 15px;
          font-size: 1.1rem;
        "></div>
      </div>
      
      <div class="viewer-counter" style="
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        background: rgba(0,0,0,0.5);
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.9rem;
      "></div>
    `;

    // Configurar eventos
    viewer.querySelector('.viewer-close').addEventListener('click', () => this.closePhotoViewer());
    viewer.querySelector('.viewer-prev').addEventListener('click', () => this.previousPhoto());
    viewer.querySelector('.viewer-next').addEventListener('click', () => this.nextPhoto());
    
    viewer.addEventListener('click', (e) => {
      if (e.target === viewer) this.closePhotoViewer();
    });

    // Navegação por teclado
    document.addEventListener('keydown', this.handleKeyNavigation.bind(this));

    return viewer;
  }

  /**
   * Atualiza visualizador com foto atual
   * @param {HTMLElement} viewer - Visualizador
   */
  updatePhotoViewer(viewer) {
    const photo = this.photos[this.currentPhotoIndex];
    if (!photo) return;

    const img = viewer.querySelector('#viewerImage');
    const info = viewer.querySelector('#viewerInfo');
    const counter = viewer.querySelector('.viewer-counter');

    img.src = photo.url;
    img.alt = photo.title;
    
    info.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 5px;">${photo.title}</div>
      ${photo.description ? `<div style="font-size: 0.9rem; opacity: 0.8;">${photo.description}</div>` : ''}
    `;
    
    counter.textContent = `${this.currentPhotoIndex + 1} de ${this.photos.length}`;

    // Mostrar/ocultar botões de navegação
    const prevBtn = viewer.querySelector('.viewer-prev');
    const nextBtn = viewer.querySelector('.viewer-next');
    
    prevBtn.style.display = this.currentPhotoIndex > 0 ? 'block' : 'none';
    nextBtn.style.display = this.currentPhotoIndex < this.photos.length - 1 ? 'block' : 'none';
  }

  /**
   * Navega para foto anterior
   */
  previousPhoto() {
    if (this.currentPhotoIndex > 0) {
      this.currentPhotoIndex--;
      const viewer = document.getElementById('photoViewer');
      if (viewer) this.updatePhotoViewer(viewer);
    }
  }

  /**
   * Navega para próxima foto
   */
  nextPhoto() {
    if (this.currentPhotoIndex < this.photos.length - 1) {
      this.currentPhotoIndex++;
      const viewer = document.getElementById('photoViewer');
      if (viewer) this.updatePhotoViewer(viewer);
    }
  }

  /**
   * Manipula navegação por teclado
   * @param {KeyboardEvent} e - Evento do teclado
   */
  handleKeyNavigation(e) {
    const viewer = document.getElementById('photoViewer');
    if (!viewer || viewer.style.display === 'none') return;

    switch (e.key) {
      case 'Escape':
        this.closePhotoViewer();
        break;
      case 'ArrowLeft':
        this.previousPhoto();
        break;
      case 'ArrowRight':
        this.nextPhoto();
        break;
    }
  }

  /**
   * Fecha galeria
   */
  closeGallery() {
    const modal = document.getElementById('galleryModal');
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Fecha visualizador de foto
   */
  closePhotoViewer() {
    const viewer = document.getElementById('photoViewer');
    if (viewer) {
      viewer.remove();
    }
    
    // Remover listener de teclado
    document.removeEventListener('keydown', this.handleKeyNavigation);
  }

  /**
   * Configura navegação da galeria
   * @param {HTMLElement} modal - Modal da galeria
   * @param {number} startIndex - Índice inicial
   */
  setupGalleryNavigation(modal, startIndex) {
    this.currentPhotoIndex = startIndex;
  }

  /**
   * Mostra mensagem de erro
   * @param {string} message - Mensagem de erro
   */
  showErrorMessage(message) {
    const errorInfo = {
      type: 'error',
      userMessage: message
    };
    
    if (window.errorHandler) {
      errorHandler.showUserFriendlyMessage(errorInfo, 5000);
    }
  }

  /**
   * Retorna fotos de fallback
   * @returns {Array} Lista de fotos padrão
   */
  getFallbackPhotos() {
    return [
      {
        id: 'fallback-1',
        url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=400',
        title: 'Salão Principal',
        description: 'Amplo salão para eventos de todos os tamanhos',
        category: 'espaco'
      },
      {
        id: 'fallback-2', 
        url: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400',
        title: 'Área Externa',
        description: 'Jardim e área externa para cerimônias',
        category: 'espaco'
      },
      {
        id: 'fallback-3',
        url: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=400', 
        title: 'Cozinha Profissional',
        description: 'Cozinha equipada para grandes eventos',
        category: 'cozinha'
      }
    ];
  }

  /**
   * Recarrega fotos forçando busca no servidor
   */
  async refreshPhotos() {
    console.log('🔄 Forçando atualização de fotos...');
    cacheManager.invalidate('space_photos');
    return await this.loadSpacePhotos(false);
  }

  /**
   * Retorna estatísticas da galeria
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      totalPhotos: this.photos.length,
      lastLoad: this.lastLoadTime,
      currentIndex: this.currentPhotoIndex,
      categories: [...new Set(this.photos.map(p => p.category))]
    };
  }
}

// Instância global do gerenciador de galeria
const galleryManager = new GalleryManager();

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.galleryManager = galleryManager;
}

console.log('✅ Gallery Manager inicializado');
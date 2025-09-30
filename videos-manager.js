// Gerenciador de Vídeos - Seção Dinâmica
class VideosManager {
  constructor() {
    this.videos = [];
    this.isLoading = false;
    this.lastLoadTime = null;
    this.fallbackVideos = this.getFallbackVideos();
  }

  /**
   * Carrega vídeos em destaque do Supabase
   * @param {boolean} useCache - Se deve usar cache
   * @returns {Promise<Array>} Lista de vídeos
   */
  async loadFeaturedVideos(useCache = true) {
    console.log('🎬 Carregando vídeos em destaque...', { useCache });
    
    // Verificar cache primeiro
    if (useCache) {
      const cacheKey = cacheManager.generateKey('featured_videos');
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('🎯 Vídeos carregados do cache');
        this.videos = cached;
        return cached;
      }
    }

    // Evitar múltiplas requisições simultâneas
    if (this.isLoading) {
      console.log('⏳ Carregamento já em andamento...');
      return this.videos;
    }

    this.isLoading = true;

    try {
      // Tentar carregar do Supabase
      const result = await this.loadFromSupabase();
      
      if (result.success && result.data.length > 0) {
        this.videos = result.data;
        this.lastLoadTime = Date.now();
        
        // Salvar no cache
        const cacheKey = cacheManager.generateKey('featured_videos');
        cacheManager.set(cacheKey, this.videos);
        
        console.log(`✅ ${this.videos.length} vídeos carregados do Supabase`);
        this.renderVideos();
        return this.videos;
      } else {
        throw new Error(result.error || 'Nenhum vídeo encontrado');
      }
      
    } catch (error) {
      console.warn('⚠️ Falha ao carregar do Supabase, usando fallback:', error.message);
      
      // Usar dados de fallback
      this.videos = this.fallbackVideos;
      this.renderVideos();
      
      // Mostrar mensagem discreta
      this.showOfflineMessage();
      
      return this.videos;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Carrega vídeos do Supabase
   * @returns {Promise<Object>} Resultado da operação
   */
  async loadFromSupabase() {
    try {
      if (!window.supabaseClient) {
        throw new Error('Cliente Supabase não disponível');
      }

      const result = await supabaseClient.getFeaturedVideos(false);
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Validar e processar vídeos
      const validVideos = [];
      for (const video of result.data || []) {
        if (this.isValidVideo(video)) {
          validVideos.push(this.processVideo(video));
        } else {
          console.warn('⚠️ Vídeo inválido ignorado:', video);
        }
      }

      return {
        success: true,
        data: validVideos
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Valida dados de um vídeo
   * @param {Object} video - Dados do vídeo
   * @returns {boolean} Se o vídeo é válido
   */
  isValidVideo(video) {
    return video && 
           (video.video_url || video.url) && 
           typeof (video.video_url || video.url) === 'string';
  }

  /**
   * Processa dados de um vídeo
   * @param {Object} video - Dados brutos do vídeo
   * @returns {Object} Vídeo processado
   */
  processVideo(video) {
    const url = video.video_url || video.url;
    const videoData = {
      id: video.id || Date.now() + Math.random(),
      url: url,
      title: video.title || video.name || 'Vídeo do buffet',
      description: video.description || '',
      thumbnail: video.thumbnail_url || this.generateThumbnail(url),
      added_date: video.added_date || video.created_at || new Date().toISOString(),
      platform: this.detectPlatform(url),
      embed_url: this.generateEmbedUrl(url)
    };

    return videoData;
  }

  /**
   * Detecta plataforma do vídeo
   * @param {string} url - URL do vídeo
   * @returns {string} Plataforma detectada
   */
  detectPlatform(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    } else if (url.includes('vimeo.com')) {
      return 'vimeo';
    } else if (url.includes('instagram.com')) {
      return 'instagram';
    } else if (url.includes('tiktok.com')) {
      return 'tiktok';
    }
    return 'other';
  }

  /**
   * Gera URL de embed para o vídeo
   * @param {string} url - URL original do vídeo
   * @returns {string} URL de embed
   */
  generateEmbedUrl(url) {
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1].split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1].split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('vimeo.com/')) {
      const videoId = url.split('vimeo.com/')[1];
      return `https://player.vimeo.com/video/${videoId}`;
    }
    
    return url; // Retorna URL original se não conseguir gerar embed
  }

  /**
   * Gera thumbnail para o vídeo
   * @param {string} url - URL do vídeo
   * @returns {string} URL do thumbnail
   */
  generateThumbnail(url) {
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1].split('&')[0];
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1].split('?')[0];
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
    
    // Placeholder para outras plataformas
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"%3E%3Crect width="320" height="180" fill="%239c27b0"/%3E%3Ctext x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="24" fill="white"%3E🎬%3C/text%3E%3C/svg%3E';
  }

  /**
   * Renderiza vídeos na seção
   */
  renderVideos() {
    const videosContainer = this.getVideosContainer();
    if (!videosContainer) {
      console.error('❌ Container de vídeos não encontrado');
      return;
    }

    if (this.videos.length === 0) {
      this.renderEmptyState(videosContainer);
      return;
    }

    // Criar grid de vídeos
    const videosGrid = document.createElement('div');
    videosGrid.className = 'videos-grid';
    videosGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 20px;
    `;

    this.videos.forEach(video => {
      const videoElement = this.createVideoElement(video);
      videosGrid.appendChild(videoElement);
    });

    videosContainer.innerHTML = '';
    videosContainer.appendChild(videosGrid);

    console.log(`🎨 ${this.videos.length} vídeos renderizados`);
  }

  /**
   * Encontra container de vídeos
   * @returns {HTMLElement} Container de vídeos
   */
  getVideosContainer() {
    return document.querySelector('#featuredVideosContainer');
  }

  /**
   * Renderiza estado vazio
   * @param {HTMLElement} container - Container de vídeos
   */
  renderEmptyState(container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #666;">
        <div style="font-size: 3rem; margin-bottom: 15px;">🎬</div>
        <h3>Nenhum vídeo disponível</h3>
        <p>Os vídeos em destaque serão adicionados em breve!</p>
      </div>
    `;
  }

  /**
   * Cria elemento de um vídeo
   * @param {Object} video - Dados do vídeo
   * @returns {HTMLElement} Elemento do vídeo
   */
  createVideoElement(video) {
    const videoCard = document.createElement('div');
    videoCard.className = 'video-card';
    videoCard.style.cssText = `
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      cursor: pointer;
    `;

    videoCard.innerHTML = `
      <div class="video-thumbnail" style="
        position: relative;
        width: 100%;
        height: 200px;
        background: #f5f5f5;
        overflow: hidden;
      ">
        <img src="${video.thumbnail}" 
             alt="${video.title}"
             style="width: 100%; height: 100%; object-fit: cover;"
             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"320\\" height=\\"180\\" viewBox=\\"0 0 320 180\\"%3E%3Crect width=\\"320\\" height=\\"180\\" fill=\\"%239c27b0\\"/%3E%3Ctext x=\\"50%\\" y=\\"50%\\" dominant-baseline=\\"middle\\" text-anchor=\\"middle\\" font-family=\\"Arial\\" font-size=\\"24\\" fill=\\"white\\"%3E🎬%3C/text%3E%3C/svg%3E'">
        
        <div class="play-overlay" style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        ">
          <div style="
            width: 60px;
            height: 60px;
            background: rgba(255,255,255,0.9);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: #9c27b0;
          ">▶</div>
        </div>
        
        <div class="platform-badge" style="
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          text-transform: uppercase;
        ">${video.platform}</div>
      </div>
      
      <div class="video-content" style="padding: 15px;">
        <h3 style="margin: 0 0 8px 0; font-size: 1.1rem; color: #333;">${video.title}</h3>
        ${video.description ? `<p style="margin: 0; color: #666; font-size: 0.9rem; line-height: 1.4;">${video.description}</p>` : ''}
      </div>
    `;

    // Eventos de hover
    videoCard.addEventListener('mouseenter', () => {
      videoCard.style.transform = 'translateY(-5px)';
      videoCard.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
      const overlay = videoCard.querySelector('.play-overlay');
      overlay.style.opacity = '1';
    });

    videoCard.addEventListener('mouseleave', () => {
      videoCard.style.transform = 'translateY(0)';
      videoCard.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
      const overlay = videoCard.querySelector('.play-overlay');
      overlay.style.opacity = '0';
    });

    // Evento de clique para reproduzir vídeo
    videoCard.addEventListener('click', () => {
      this.playVideo(video);
    });

    return videoCard;
  }

  /**
   * Reproduz vídeo em modal
   * @param {Object} video - Dados do vídeo
   */
  playVideo(video) {
    const modal = this.createVideoModal(video);
    document.body.appendChild(modal);
    modal.style.display = 'flex';
  }

  /**
   * Cria modal para reprodução de vídeo
   * @param {Object} video - Dados do vídeo
   * @returns {HTMLElement} Modal do vídeo
   */
  createVideoModal(video) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'videoModal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 90%; max-height: 90%; background: black; border-radius: 12px; overflow: hidden;">
        <div class="modal-header" style="background: rgba(0,0,0,0.8); color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
          <h3 class="modal-title" style="margin: 0; font-size: 1.2rem;">${video.title}</h3>
          <button class="close-modal" type="button" style="background: none; border: none; color: white; font-size: 2rem; cursor: pointer;">&times;</button>
        </div>
        
        <div class="video-player" style="position: relative; width: 100%; height: 70vh;">
          ${this.createVideoPlayer(video)}
        </div>
        
        ${video.description ? `
          <div style="background: rgba(0,0,0,0.8); color: white; padding: 15px;">
            <p style="margin: 0; font-size: 0.9rem; line-height: 1.4;">${video.description}</p>
          </div>
        ` : ''}
      </div>
    `;

    // Configurar eventos de fechamento
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.addEventListener('click', () => this.closeVideoModal());
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeVideoModal();
    });

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeVideoModal();
    });

    return modal;
  }

  /**
   * Cria player de vídeo baseado na plataforma
   * @param {Object} video - Dados do vídeo
   * @returns {string} HTML do player
   */
  createVideoPlayer(video) {
    if (video.platform === 'youtube' || video.platform === 'vimeo') {
      return `
        <iframe 
          src="${video.embed_url}" 
          style="width: 100%; height: 100%; border: none;"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen>
        </iframe>
      `;
    } else {
      // Para outras plataformas, mostrar link
      return `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: white; text-align: center;">
          <div style="font-size: 4rem; margin-bottom: 20px;">🎬</div>
          <h3>Vídeo Externo</h3>
          <p style="margin-bottom: 20px;">Este vídeo está hospedado em ${video.platform}</p>
          <a href="${video.url}" target="_blank" style="
            background: #9c27b0;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
          ">🔗 Assistir no ${video.platform}</a>
        </div>
      `;
    }
  }

  /**
   * Fecha modal de vídeo
   */
  closeVideoModal() {
    const modal = document.getElementById('videoModal');
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Mostra mensagem de modo offline
   */
  showOfflineMessage() {
    const message = {
      type: 'info',
      userMessage: 'Exibindo vídeos salvos. Conecte-se à internet para ver atualizações.'
    };
    
    if (window.errorHandler) {
      errorHandler.showUserFriendlyMessage(message, 3000);
    }
  }

  /**
   * Retorna vídeos de fallback
   * @returns {Array} Lista de vídeos padrão
   */
  getFallbackVideos() {
    return [
      {
        id: 'fallback-video-1',
        title: 'Tour pelo Nosso Espaço',
        description: 'Conheça todas as áreas do nosso buffet em um tour completo',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        platform: 'youtube',
        added_date: new Date().toISOString()
      },
      {
        id: 'fallback-video-2',
        title: 'Festa de Aniversário - Cliente Satisfeito',
        description: 'Veja como foi a festa de aniversário da Maria, com 150 convidados',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        platform: 'youtube',
        added_date: new Date().toISOString()
      }
    ];
  }

  /**
   * Recarrega vídeos forçando busca no servidor
   */
  async refreshVideos() {
    console.log('🔄 Forçando atualização de vídeos...');
    cacheManager.invalidate('featured_videos');
    return await this.loadFeaturedVideos(false);
  }

  /**
   * Retorna estatísticas dos vídeos
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      totalVideos: this.videos.length,
      lastLoad: this.lastLoadTime,
      platforms: [...new Set(this.videos.map(v => v.platform))],
      isLoading: this.isLoading
    };
  }
}

// Instância global do gerenciador de vídeos
const videosManager = new VideosManager();

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.videosManager = videosManager;
}

console.log('✅ Videos Manager inicializado');
// Sistema de Otimização de Performance
class PerformanceOptimizer {
  constructor() {
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2
    };
    
    this.timeoutConfig = {
      default: 10000,
      image: 15000,
      api: 8000
    };
    
    this.metrics = {
      requests: 0,
      failures: 0,
      retries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      totalResponseTime: 0
    };
    
    this.activeRequests = new Map();
    this.imageObserver = null;
    this.setupImageOptimization();
  }

  /**
   * Executa operação com retry automático
   * @param {Function} operation - Operação a ser executada
   * @param {Object} options - Opções de configuração
   * @returns {Promise} Resultado da operação
   */
  async withRetry(operation, options = {}) {
    const config = {
      maxRetries: options.maxRetries || this.retryConfig.maxRetries,
      baseDelay: options.baseDelay || this.retryConfig.baseDelay,
      context: options.context || 'operação',
      timeout: options.timeout || this.timeoutConfig.default
    };

    let lastError;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      try {
        this.metrics.requests++;
        
        // Aplicar timeout
        const result = await this.withTimeout(operation(), config.timeout);
        
        // Registrar métricas de sucesso
        const responseTime = Date.now() - startTime;
        this.updateMetrics(responseTime, true);
        
        if (attempt > 1) {
          console.log(`✅ Sucesso na tentativa ${attempt} para ${config.context}`);
        }
        
        return result;

      } catch (error) {
        lastError = error;
        this.metrics.failures++;
        
        if (attempt <= config.maxRetries) {
          this.metrics.retries++;
          const delay = Math.min(
            config.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
            this.retryConfig.maxDelay
          );
          
          console.warn(`⚠️ Tentativa ${attempt} falhou para ${config.context}. Tentando novamente em ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    // Registrar métricas de falha
    const responseTime = Date.now() - startTime;
    this.updateMetrics(responseTime, false);
    
    console.error(`❌ Todas as tentativas falharam para ${config.context}:`, lastError.message);
    throw lastError;
  }

  /**
   * Aplica timeout a uma operação
   * @param {Promise} promise - Promise da operação
   * @param {number} timeout - Timeout em millisegundos
   * @returns {Promise} Promise com timeout
   */
  withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operação excedeu timeout de ${timeout}ms`));
        }, timeout);
      })
    ]);
  }

  /**
   * Implementa debounce para funções
   * @param {Function} func - Função a ser debounced
   * @param {number} delay - Delay em millisegundos
   * @returns {Function} Função debounced
   */
  debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Implementa throttle para funções
   * @param {Function} func - Função a ser throttled
   * @param {number} delay - Delay em millisegundos
   * @returns {Function} Função throttled
   */
  throttle(func, delay) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return func.apply(this, args);
      }
    };
  }

  /**
   * Carrega recursos de forma lazy
   * @param {Function} loader - Função de carregamento
   * @param {Object} options - Opções
   * @returns {Promise} Resultado do carregamento
   */
  async lazyLoad(loader, options = {}) {
    const cacheKey = options.cacheKey;
    
    // Verificar cache primeiro
    if (cacheKey && window.cacheManager) {
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }
      this.metrics.cacheMisses++;
    }

    // Verificar se já está carregando
    if (cacheKey && this.activeRequests.has(cacheKey)) {
      console.log(`⏳ Aguardando carregamento em andamento: ${cacheKey}`);
      return await this.activeRequests.get(cacheKey);
    }

    // Iniciar carregamento
    const loadPromise = this.withRetry(loader, {
      context: options.context || 'lazy load',
      timeout: options.timeout
    });

    if (cacheKey) {
      this.activeRequests.set(cacheKey, loadPromise);
    }

    try {
      const result = await loadPromise;
      
      // Salvar no cache
      if (cacheKey && window.cacheManager && result) {
        cacheManager.set(cacheKey, result, options.cacheTTL);
      }
      
      return result;
    } finally {
      if (cacheKey) {
        this.activeRequests.delete(cacheKey);
      }
    }
  }

  /**
   * Configura otimização de imagens
   */
  setupImageOptimization() {
    // Intersection Observer para lazy loading de imagens
    if ('IntersectionObserver' in window) {
      this.imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            this.imageObserver.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.1
      });
    }

    console.log('✅ Otimização de imagens configurada');
  }

  /**
   * Carrega imagem com otimizações
   * @param {HTMLImageElement} img - Elemento de imagem
   */
  async loadImage(img) {
    const src = img.dataset.src || img.dataset.lazySrc;
    if (!src) return;

    try {
      // Mostrar placeholder enquanto carrega
      this.showImagePlaceholder(img);
      
      // Carregar imagem com timeout
      await this.withTimeout(this.preloadImage(src), this.timeoutConfig.image);
      
      // Aplicar imagem carregada
      img.src = src;
      img.classList.add('loaded');
      img.classList.remove('loading');
      
      // Remover atributos de lazy loading
      delete img.dataset.src;
      delete img.dataset.lazySrc;
      
    } catch (error) {
      console.warn('⚠️ Erro ao carregar imagem:', error.message);
      this.showImageError(img);
    }
  }

  /**
   * Pré-carrega imagem
   * @param {string} src - URL da imagem
   * @returns {Promise} Promise de carregamento
   */
  preloadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
      img.src = src;
    });
  }

  /**
   * Mostra placeholder de carregamento
   * @param {HTMLImageElement} img - Elemento de imagem
   */
  showImagePlaceholder(img) {
    img.classList.add('loading');
    if (!img.src || img.src === window.location.href) {
      img.src = this.generatePlaceholder(img.width || 300, img.height || 200);
    }
  }

  /**
   * Mostra erro de carregamento
   * @param {HTMLImageElement} img - Elemento de imagem
   */
  showImageError(img) {
    img.classList.add('error');
    img.classList.remove('loading');
    img.src = this.generateErrorPlaceholder(img.width || 300, img.height || 200);
  }

  /**
   * Gera placeholder SVG
   * @param {number} width - Largura
   * @param {number} height - Altura
   * @returns {string} Data URL do SVG
   */
  generatePlaceholder(width, height) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="#f0f0f0"/>
        <circle cx="${width/2}" cy="${height/2}" r="20" fill="#ccc"/>
        <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="12" fill="#999">Carregando...</text>
      </svg>
    `;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  /**
   * Gera placeholder de erro
   * @param {number} width - Largura
   * @param {number} height - Altura
   * @returns {string} Data URL do SVG
   */
  generateErrorPlaceholder(width, height) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="#ffebee"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="14" fill="#f44336">❌ Erro ao carregar</text>
      </svg>
    `;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  /**
   * Observa imagens para lazy loading
   * @param {HTMLImageElement} img - Elemento de imagem
   */
  observeImage(img) {
    if (this.imageObserver) {
      this.imageObserver.observe(img);
    } else {
      // Fallback para navegadores sem IntersectionObserver
      this.loadImage(img);
    }
  }

  /**
   * Otimiza carregamento de dados em lote
   * @param {Array} items - Itens para carregar
   * @param {Function} loader - Função de carregamento
   * @param {Object} options - Opções
   * @returns {Promise<Array>} Resultados
   */
  async batchLoad(items, loader, options = {}) {
    const batchSize = options.batchSize || 5;
    const delay = options.delay || 100;
    const results = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        const batchResults = await Promise.all(
          batch.map(item => this.withRetry(() => loader(item), {
            context: `batch item ${i + batch.indexOf(item)}`,
            timeout: options.timeout
          }))
        );
        
        results.push(...batchResults);
        
        // Delay entre lotes para não sobrecarregar
        if (i + batchSize < items.length && delay > 0) {
          await this.delay(delay);
        }
        
      } catch (error) {
        console.warn(`⚠️ Erro no lote ${Math.floor(i / batchSize)}:`, error.message);
        // Continuar com próximo lote mesmo se um falhar
      }
    }

    return results;
  }

  /**
   * Implementa cache inteligente com estratégias
   * @param {string} key - Chave do cache
   * @param {Function} loader - Função de carregamento
   * @param {Object} options - Opções
   * @returns {Promise} Resultado
   */
  async smartCache(key, loader, options = {}) {
    const strategy = options.strategy || 'cache-first';
    const ttl = options.ttl || 300000; // 5 minutos
    const staleWhileRevalidate = options.staleWhileRevalidate || false;

    switch (strategy) {
      case 'cache-first':
        return await this.cacheFirst(key, loader, ttl);
      
      case 'network-first':
        return await this.networkFirst(key, loader, ttl);
      
      case 'stale-while-revalidate':
        return await this.staleWhileRevalidate(key, loader, ttl);
      
      default:
        return await this.cacheFirst(key, loader, ttl);
    }
  }

  /**
   * Estratégia cache-first
   */
  async cacheFirst(key, loader, ttl) {
    // Tentar cache primeiro
    if (window.cacheManager) {
      const cached = cacheManager.get(key);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }
    }

    // Se não houver cache, carregar da rede
    this.metrics.cacheMisses++;
    const result = await this.withRetry(loader, { context: `cache-first: ${key}` });
    
    if (window.cacheManager && result) {
      cacheManager.set(key, result, ttl);
    }
    
    return result;
  }

  /**
   * Estratégia network-first
   */
  async networkFirst(key, loader, ttl) {
    try {
      // Tentar rede primeiro
      const result = await this.withRetry(loader, { 
        context: `network-first: ${key}`,
        maxRetries: 1 // Menos tentativas para network-first
      });
      
      if (window.cacheManager && result) {
        cacheManager.set(key, result, ttl);
      }
      
      return result;
    } catch (error) {
      // Se falhar, tentar cache
      if (window.cacheManager) {
        const cached = cacheManager.get(key);
        if (cached) {
          console.warn(`⚠️ Usando cache após falha de rede para ${key}`);
          this.metrics.cacheHits++;
          return cached;
        }
      }
      
      throw error;
    }
  }

  /**
   * Estratégia stale-while-revalidate
   */
  async staleWhileRevalidate(key, loader, ttl) {
    let cached = null;
    
    if (window.cacheManager) {
      cached = cacheManager.get(key);
    }

    // Se houver cache, retornar imediatamente
    if (cached) {
      this.metrics.cacheHits++;
      
      // Revalidar em background
      this.withRetry(loader, { context: `revalidate: ${key}` })
        .then(result => {
          if (window.cacheManager && result) {
            cacheManager.set(key, result, ttl);
          }
        })
        .catch(error => {
          console.warn(`⚠️ Falha na revalidação de ${key}:`, error.message);
        });
      
      return cached;
    }

    // Se não houver cache, carregar normalmente
    this.metrics.cacheMisses++;
    const result = await this.withRetry(loader, { context: `initial load: ${key}` });
    
    if (window.cacheManager && result) {
      cacheManager.set(key, result, ttl);
    }
    
    return result;
  }

  /**
   * Delay helper
   * @param {number} ms - Millisegundos
   * @returns {Promise} Promise de delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Atualiza métricas de performance
   * @param {number} responseTime - Tempo de resposta
   * @param {boolean} success - Se foi sucesso
   */
  updateMetrics(responseTime, success) {
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.requests;
  }

  /**
   * Limpa recursos e observers
   */
  cleanup() {
    if (this.imageObserver) {
      this.imageObserver.disconnect();
    }
    this.activeRequests.clear();
  }

  /**
   * Retorna métricas de performance
   * @returns {Object} Métricas
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.requests > 0 ? 
        ((this.metrics.requests - this.metrics.failures) / this.metrics.requests * 100).toFixed(2) + '%' : '0%',
      cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 ?
        (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(2) + '%' : '0%',
      activeRequests: this.activeRequests.size
    };
  }

  /**
   * Reseta métricas
   */
  resetMetrics() {
    this.metrics = {
      requests: 0,
      failures: 0,
      retries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      totalResponseTime: 0
    };
  }
}

// Instância global do otimizador
const performanceOptimizer = new PerformanceOptimizer();

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.performanceOptimizer = performanceOptimizer;
}

// Cleanup ao descarregar página
window.addEventListener('beforeunload', () => {
  performanceOptimizer.cleanup();
});

console.log('✅ Performance Optimizer inicializado');
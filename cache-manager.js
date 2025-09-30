// Sistema de Cache Local para Performance
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutos
    this.maxSize = 100; // Máximo de entradas no cache
  }

  /**
   * Armazena dados no cache com TTL
   * @param {string} key - Chave do cache
   * @param {any} data - Dados para armazenar
   * @param {number} ttl - Time to live em millisegundos
   */
  set(key, data, ttl = this.defaultTTL) {
    // Limpar cache se estiver muito grande
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    console.log(`✅ Cache: Dados armazenados para '${key}'`);
  }

  /**
   * Recupera dados do cache se ainda válidos
   * @param {string} key - Chave do cache
   * @returns {any|null} Dados ou null se expirado/inexistente
   */
  get(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      // Log cache miss
      if (window.monitoringSystem) {
        monitoringSystem.logCacheAccess(key, false);
      }
      return null;
    }

    const now = Date.now();
    const isExpired = (now - cached.timestamp) > cached.ttl;

    if (isExpired) {
      this.cache.delete(key);
      console.log(`⏰ Cache: Dados expirados para '${key}'`);
      // Log cache miss por expiração
      if (window.monitoringSystem) {
        monitoringSystem.logCacheAccess(key, false);
      }
      return null;
    }

    console.log(`🎯 Cache: Hit para '${key}'`);
    // Log cache hit
    if (window.monitoringSystem) {
      monitoringSystem.logCacheAccess(key, true);
    }
    return cached.data;
  }

  /**
   * Invalida entradas do cache por padrão
   * @param {string} pattern - Padrão para buscar chaves
   */
  invalidate(pattern) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    console.log(`🗑️ Cache: ${count} entradas invalidadas para padrão '${pattern}'`);
  }

  /**
   * Limpa todo o cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🧹 Cache: ${size} entradas removidas`);
  }

  /**
   * Remove entradas expiradas
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.cache.entries()) {
      if ((now - value.timestamp) > value.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    console.log(`🧽 Cache: ${removed} entradas expiradas removidas`);
  }

  /**
   * Gera chave de cache baseada em parâmetros
   * @param {string} prefix - Prefixo da chave
   * @param {object} params - Parâmetros para incluir na chave
   * @returns {string} Chave gerada
   */
  generateKey(prefix, params = {}) {
    const paramString = Object.keys(params).length > 0 
      ? JSON.stringify(params) 
      : '';
    return `${prefix}_${paramString}`;
  }

  /**
   * Retorna estatísticas do cache
   * @returns {object} Estatísticas
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let valid = 0;

    for (const value of this.cache.values()) {
      if ((now - value.timestamp) > value.ttl) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
      maxSize: this.maxSize
    };
  }
}

// Instância global do cache manager
const cacheManager = new CacheManager();

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.cacheManager = cacheManager;
}

console.log('✅ Cache Manager inicializado');
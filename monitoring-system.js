// Sistema de Monitoramento e Logging
class MonitoringSystem {
  constructor() {
    this.logs = [];
    this.metrics = {
      pageLoad: null,
      userInteractions: 0,
      errors: 0,
      apiCalls: 0,
      cacheHits: 0,
      performanceMarks: new Map()
    };
    
    this.config = {
      maxLogs: 1000,
      logLevel: 'info', // debug, info, warn, error
      enableConsole: true,
      enableStorage: true,
      enableMetrics: true
    };
    
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    this.errorTypes = {
      NETWORK: 'network',
      VALIDATION: 'validation',
      SUPABASE: 'supabase',
      UI: 'ui',
      PERFORMANCE: 'performance'
    };
    
    this.init();
  }

  /**
   * Inicializa o sistema de monitoramento
   */
  init() {
    this.setupPerformanceMonitoring();
    this.setupErrorHandling();
    this.setupUserInteractionTracking();
    this.loadStoredLogs();
    
    console.log('✅ Sistema de monitoramento inicializado');
  }

  /**
   * Configura monitoramento de performance
   */
  setupPerformanceMonitoring() {
    // Monitorar carregamento da página
    if (window.performance && window.performance.timing) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const timing = window.performance.timing;
          this.metrics.pageLoad = {
            domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
            loadComplete: timing.loadEventEnd - timing.navigationStart,
            firstPaint: this.getFirstPaint(),
            timestamp: new Date().toISOString()
          };
          
          this.log('info', 'Performance', 'Página carregada', this.metrics.pageLoad);
        }, 0);
      });
    }

    // Monitorar Web Vitals se disponível
    this.setupWebVitals();
  }

  /**
   * Configura Web Vitals
   */
  setupWebVitals() {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          
          this.log('info', 'WebVitals', 'LCP medido', {
            value: lastEntry.startTime,
            element: lastEntry.element?.tagName
          });
        });
        
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        this.log('warn', 'WebVitals', 'Erro ao configurar LCP observer', error.message);
      }
    }
  }

  /**
   * Obtém First Paint se disponível
   */
  getFirstPaint() {
    if (window.performance && window.performance.getEntriesByType) {
      const paintEntries = window.performance.getEntriesByType('paint');
      const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
      return firstPaint ? firstPaint.startTime : null;
    }
    return null;
  }

  /**
   * Configura tratamento de erros globais
   */
  setupErrorHandling() {
    // Erros JavaScript
    window.addEventListener('error', (event) => {
      this.logError(this.errorTypes.UI, 'Erro JavaScript global', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // Promises rejeitadas
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(this.errorTypes.NETWORK, 'Promise rejeitada não tratada', {
        reason: event.reason,
        stack: event.reason?.stack
      });
    });

    // Erros de recursos
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.logError(this.errorTypes.NETWORK, 'Erro ao carregar recurso', {
          element: event.target.tagName,
          source: event.target.src || event.target.href,
          type: event.target.type
        });
      }
    }, true);
  }

  /**
   * Configura rastreamento de interações do usuário
   */
  setupUserInteractionTracking() {
    // Cliques
    document.addEventListener('click', (event) => {
      this.trackInteraction('click', {
        element: event.target.tagName,
        className: event.target.className,
        id: event.target.id,
        text: event.target.textContent?.substring(0, 50)
      });
    });

    // Mudanças de aba
    document.addEventListener('visibilitychange', () => {
      this.trackInteraction('visibility', {
        hidden: document.hidden,
        timestamp: new Date().toISOString()
      });
    });

    // Tempo na página
    let startTime = Date.now();
    window.addEventListener('beforeunload', () => {
      const timeOnPage = Date.now() - startTime;
      this.log('info', 'UserBehavior', 'Tempo na página', {
        duration: timeOnPage,
        interactions: this.metrics.userInteractions
      });
    });
  }

  /**
   * Registra log
   * @param {string} level - Nível do log
   * @param {string} category - Categoria
   * @param {string} message - Mensagem
   * @param {any} data - Dados adicionais
   */
  log(level, category, message, data = null) {
    if (this.logLevels[level] < this.logLevels[this.config.logLevel]) {
      return; // Filtrar por nível
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      category,
      message,
      data,
      url: window.location.href,
      userAgent: navigator.userAgent.substring(0, 100)
    };

    // Adicionar ao array de logs
    this.logs.push(logEntry);
    
    // Manter tamanho controlado
    if (this.logs.length > this.config.maxLogs) {
      this.logs.shift();
    }

    // Log no console se habilitado
    if (this.config.enableConsole) {
      const consoleMethod = level === 'error' ? 'error' : 
                           level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](`[${category}] ${message}`, data || '');
    }

    // Salvar no storage se habilitado
    if (this.config.enableStorage) {
      this.saveToStorage();
    }

    // Atualizar métricas
    if (level === 'error') {
      this.metrics.errors++;
    }
  }

  /**
   * Registra erro específico
   * @param {string} type - Tipo do erro
   * @param {string} message - Mensagem
   * @param {any} details - Detalhes
   */
  logError(type, message, details = null) {
    this.log('error', `Error:${type}`, message, {
      errorType: type,
      details,
      stack: new Error().stack
    });
  }

  /**
   * Registra chamada de API
   * @param {string} endpoint - Endpoint
   * @param {string} method - Método HTTP
   * @param {number} duration - Duração em ms
   * @param {boolean} success - Se foi sucesso
   * @param {any} error - Erro se houver
   */
  logApiCall(endpoint, method, duration, success, error = null) {
    this.metrics.apiCalls++;
    
    this.log(success ? 'info' : 'error', 'API', `${method} ${endpoint}`, {
      duration,
      success,
      error: error?.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Registra hit de cache
   * @param {string} key - Chave do cache
   * @param {boolean} hit - Se foi hit ou miss
   */
  logCacheAccess(key, hit) {
    if (hit) {
      this.metrics.cacheHits++;
    }
    
    this.log('debug', 'Cache', hit ? 'Cache hit' : 'Cache miss', {
      key,
      hit
    });
  }

  /**
   * Rastreia interação do usuário
   * @param {string} type - Tipo de interação
   * @param {any} data - Dados da interação
   */
  trackInteraction(type, data) {
    this.metrics.userInteractions++;
    
    this.log('debug', 'Interaction', `User ${type}`, data);
  }

  /**
   * Marca início de operação para medição de performance
   * @param {string} name - Nome da operação
   */
  startPerformanceMark(name) {
    const startTime = Date.now();
    this.metrics.performanceMarks.set(name, startTime);
    
    if (window.performance && window.performance.mark) {
      window.performance.mark(`${name}-start`);
    }
  }

  /**
   * Marca fim de operação e calcula duração
   * @param {string} name - Nome da operação
   * @returns {number} Duração em ms
   */
  endPerformanceMark(name) {
    const startTime = this.metrics.performanceMarks.get(name);
    if (!startTime) {
      this.log('warn', 'Performance', `Marca de início não encontrada: ${name}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.metrics.performanceMarks.delete(name);

    if (window.performance && window.performance.mark && window.performance.measure) {
      window.performance.mark(`${name}-end`);
      window.performance.measure(name, `${name}-start`, `${name}-end`);
    }

    this.log('info', 'Performance', `Operação ${name} concluída`, {
      duration,
      name
    });

    return duration;
  }

  /**
   * Valida dados e registra problemas
   * @param {any} data - Dados para validar
   * @param {string} context - Contexto da validação
   * @param {Function} validator - Função de validação
   */
  validateAndLog(data, context, validator) {
    try {
      const result = validator(data);
      
      if (result.valid) {
        this.log('debug', 'Validation', `Dados válidos: ${context}`);
        return result;
      } else {
        this.logError(this.errorTypes.VALIDATION, `Dados inválidos: ${context}`, {
          errors: result.errors,
          data: JSON.stringify(data).substring(0, 200)
        });
        return result;
      }
    } catch (error) {
      this.logError(this.errorTypes.VALIDATION, `Erro na validação: ${context}`, {
        error: error.message,
        data: JSON.stringify(data).substring(0, 200)
      });
      return { valid: false, errors: [error.message] };
    }
  }

  /**
   * Monitora uso de memória
   */
  checkMemoryUsage() {
    if (window.performance && window.performance.memory) {
      const memory = window.performance.memory;
      const memoryInfo = {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
      };

      this.log('info', 'Memory', 'Uso de memória', memoryInfo);

      // Alertar se uso estiver alto
      const usagePercent = (memoryInfo.used / memoryInfo.limit) * 100;
      if (usagePercent > 80) {
        this.log('warn', 'Memory', 'Alto uso de memória detectado', {
          percentage: usagePercent.toFixed(2) + '%'
        });
      }

      return memoryInfo;
    }
    return null;
  }

  /**
   * Salva logs no localStorage
   */
  saveToStorage() {
    try {
      // Salvar apenas os últimos 100 logs para não sobrecarregar
      const recentLogs = this.logs.slice(-100);
      localStorage.setItem('buffet_monitoring_logs', JSON.stringify(recentLogs));
    } catch (error) {
      console.warn('Erro ao salvar logs no storage:', error.message);
    }
  }

  /**
   * Carrega logs do localStorage
   */
  loadStoredLogs() {
    try {
      const stored = localStorage.getItem('buffet_monitoring_logs');
      if (stored) {
        const storedLogs = JSON.parse(stored);
        this.logs.unshift(...storedLogs);
        
        // Manter limite
        if (this.logs.length > this.config.maxLogs) {
          this.logs = this.logs.slice(-this.config.maxLogs);
        }
      }
    } catch (error) {
      console.warn('Erro ao carregar logs do storage:', error.message);
    }
  }

  /**
   * Exporta logs para análise
   * @param {string} format - Formato (json, csv)
   * @returns {string} Dados exportados
   */
  exportLogs(format = 'json') {
    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'category', 'message', 'data'];
      const csvRows = [headers.join(',')];
      
      this.logs.forEach(log => {
        const row = [
          log.timestamp,
          log.level,
          log.category,
          `"${log.message.replace(/"/g, '""')}"`,
          `"${JSON.stringify(log.data || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      });
      
      return csvRows.join('\n');
    }
    
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Gera relatório de saúde do sistema
   * @returns {Object} Relatório
   */
  getHealthReport() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentLogs = this.logs.filter(log => 
      new Date(log.timestamp).getTime() > oneHourAgo
    );
    
    const errorLogs = recentLogs.filter(log => log.level === 'ERROR');
    const apiLogs = recentLogs.filter(log => log.category === 'API');
    
    return {
      timestamp: new Date().toISOString(),
      totalLogs: this.logs.length,
      recentLogs: recentLogs.length,
      recentErrors: errorLogs.length,
      errorRate: recentLogs.length > 0 ? (errorLogs.length / recentLogs.length * 100).toFixed(2) + '%' : '0%',
      apiCalls: this.metrics.apiCalls,
      userInteractions: this.metrics.userInteractions,
      cacheHits: this.metrics.cacheHits,
      pageLoad: this.metrics.pageLoad,
      memoryUsage: this.checkMemoryUsage(),
      topErrors: this.getTopErrors(errorLogs),
      performance: this.getPerformanceSummary()
    };
  }

  /**
   * Obtém erros mais frequentes
   * @param {Array} errorLogs - Logs de erro
   * @returns {Array} Top erros
   */
  getTopErrors(errorLogs) {
    const errorCounts = {};
    
    errorLogs.forEach(log => {
      const key = `${log.category}: ${log.message}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    
    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
  }

  /**
   * Obtém resumo de performance
   * @returns {Object} Resumo
   */
  getPerformanceSummary() {
    const perfLogs = this.logs.filter(log => 
      log.category === 'Performance' && log.data?.duration
    );
    
    if (perfLogs.length === 0) return null;
    
    const durations = perfLogs.map(log => log.data.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const max = Math.max(...durations);
    const min = Math.min(...durations);
    
    return {
      operations: perfLogs.length,
      averageDuration: Math.round(avg),
      maxDuration: max,
      minDuration: min
    };
  }

  /**
   * Limpa logs antigos
   * @param {number} maxAge - Idade máxima em ms
   */
  cleanOldLogs(maxAge = 24 * 60 * 60 * 1000) { // 24 horas
    const cutoff = Date.now() - maxAge;
    const initialCount = this.logs.length;
    
    this.logs = this.logs.filter(log => 
      new Date(log.timestamp).getTime() > cutoff
    );
    
    const removed = initialCount - this.logs.length;
    if (removed > 0) {
      this.log('info', 'Maintenance', `${removed} logs antigos removidos`);
    }
  }

  /**
   * Configura limpeza automática
   */
  setupAutoCleanup() {
    // Limpar logs antigos a cada hora
    setInterval(() => {
      this.cleanOldLogs();
    }, 60 * 60 * 1000);
  }

  /**
   * Retorna estatísticas atuais
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      ...this.metrics,
      totalLogs: this.logs.length,
      logLevels: this.getLogLevelCounts(),
      categories: this.getCategoryCounts()
    };
  }

  /**
   * Conta logs por nível
   * @returns {Object} Contagem por nível
   */
  getLogLevelCounts() {
    const counts = {};
    this.logs.forEach(log => {
      counts[log.level] = (counts[log.level] || 0) + 1;
    });
    return counts;
  }

  /**
   * Conta logs por categoria
   * @returns {Object} Contagem por categoria
   */
  getCategoryCounts() {
    const counts = {};
    this.logs.forEach(log => {
      counts[log.category] = (counts[log.category] || 0) + 1;
    });
    return counts;
  }
}

// Instância global do sistema de monitoramento
const monitoringSystem = new MonitoringSystem();

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.monitoringSystem = monitoringSystem;
  
  // Função global para debug
  window.showHealthReport = () => {
    const report = monitoringSystem.getHealthReport();
    console.table(report);
    return report;
  };
  
  window.exportLogs = (format) => {
    const data = monitoringSystem.exportLogs(format);
    const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buffet-logs-${new Date().toISOString().split('T')[0]}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };
}

// Configurar limpeza automática
monitoringSystem.setupAutoCleanup();

console.log('✅ Sistema de monitoramento inicializado');
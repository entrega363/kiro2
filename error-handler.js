// Sistema de Tratamento Centralizado de Erros
class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 50;
    this.userNotificationElement = null;
  }

  /**
   * Trata erros de rede (conexão, timeout, etc)
   * @param {Error} error - Erro capturado
   * @param {string} context - Contexto onde ocorreu o erro
   * @returns {object} Resposta padronizada
   */
  handleNetworkError(error, context = 'operação de rede') {
    const errorInfo = {
      type: 'network',
      message: error.message,
      context,
      timestamp: new Date().toISOString(),
      userMessage: 'Problema de conexão. Tentando novamente...'
    };

    this.logError(errorInfo);

    // Determinar tipo específico de erro de rede
    if (error.message.includes('fetch')) {
      errorInfo.userMessage = 'Sem conexão com a internet. Usando dados salvos.';
    } else if (error.message.includes('timeout')) {
      errorInfo.userMessage = 'Conexão lenta. Aguarde um momento.';
    }

    return {
      success: false,
      error: errorInfo,
      shouldRetry: true,
      fallbackData: null
    };
  }

  /**
   * Trata erros de dados (validação, formato, etc)
   * @param {Error} error - Erro capturado
   * @param {string} context - Contexto onde ocorreu o erro
   * @returns {object} Resposta padronizada
   */
  handleDataError(error, context = 'processamento de dados') {
    const errorInfo = {
      type: 'data',
      message: error.message,
      context,
      timestamp: new Date().toISOString(),
      userMessage: 'Dados inválidos recebidos. Usando informações padrão.'
    };

    this.logError(errorInfo);

    return {
      success: false,
      error: errorInfo,
      shouldRetry: false,
      fallbackData: this.getDefaultData(context)
    };
  }

  /**
   * Trata erros de autenticação/autorização
   * @param {Error} error - Erro capturado
   * @param {string} context - Contexto onde ocorreu o erro
   * @returns {object} Resposta padronizada
   */
  handleAuthError(error, context = 'autenticação') {
    const errorInfo = {
      type: 'auth',
      message: error.message,
      context,
      timestamp: new Date().toISOString(),
      userMessage: 'Problema de autenticação. Verifique as configurações.'
    };

    this.logError(errorInfo);

    return {
      success: false,
      error: errorInfo,
      shouldRetry: false,
      fallbackData: null
    };
  }

  /**
   * Exibe mensagem amigável para o usuário
   * @param {object} errorInfo - Informações do erro
   * @param {number} duration - Duração da mensagem em ms
   */
  showUserFriendlyMessage(errorInfo, duration = 5000) {
    // Criar elemento de notificação se não existir
    if (!this.userNotificationElement) {
      this.createNotificationElement();
    }

    const notification = this.userNotificationElement;
    notification.textContent = errorInfo.userMessage || 'Ocorreu um problema. Tente novamente.';
    notification.className = `error-notification ${errorInfo.type || 'general'}`;
    notification.style.display = 'block';

    // Auto-ocultar após duração especificada
    setTimeout(() => {
      notification.style.display = 'none';
    }, duration);

    console.warn(`🚨 Erro exibido ao usuário: ${errorInfo.userMessage}`);
  }

  /**
   * Registra erro no log interno
   * @param {object} errorInfo - Informações do erro
   */
  logError(errorInfo) {
    // Adicionar ao log
    this.errorLog.push(errorInfo);

    // Manter tamanho do log controlado
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // Log no console para desenvolvimento
    console.error(`❌ Erro [${errorInfo.type}] em ${errorInfo.context}:`, errorInfo.message);
    
    // Integrar com sistema de monitoramento se disponível
    if (window.monitoringSystem) {
      monitoringSystem.logError(errorInfo.type, `${errorInfo.context}: ${errorInfo.message}`, {
        timestamp: errorInfo.timestamp,
        userMessage: errorInfo.userMessage
      });
    }
  }

  /**
   * Cria elemento de notificação no DOM
   */
  createNotificationElement() {
    const notification = document.createElement('div');
    notification.id = 'error-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      display: none;
      max-width: 300px;
      font-size: 14px;
      line-height: 1.4;
    `;

    document.body.appendChild(notification);
    this.userNotificationElement = notification;
  }

  /**
   * Retorna dados padrão baseado no contexto
   * @param {string} context - Contexto do erro
   * @returns {any} Dados padrão
   */
  getDefaultData(context) {
    const defaults = {
      'buscar serviços': [],
      'buscar pacotes': [],
      'buscar fotos': [],
      'buscar vídeos': [],
      'criar orçamento': { success: false, message: 'Erro ao salvar orçamento' },
      'criar agendamento': { success: false, message: 'Erro ao salvar agendamento' }
    };

    return defaults[context] || null;
  }

  /**
   * Retorna log de erros
   * @param {number} limit - Limite de entradas
   * @returns {array} Log de erros
   */
  getErrorLog(limit = 10) {
    return this.errorLog.slice(-limit);
  }

  /**
   * Limpa log de erros
   */
  clearErrorLog() {
    this.errorLog = [];
    console.log('🧹 Log de erros limpo');
  }

  /**
   * Retorna estatísticas de erros
   * @returns {object} Estatísticas
   */
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      recent: this.errorLog.slice(-5)
    };

    // Contar por tipo
    this.errorLog.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
    });

    return stats;
  }
}

// Instância global do error handler
const errorHandler = new ErrorHandler();

// Capturar erros globais não tratados
window.addEventListener('error', (event) => {
  errorHandler.handleNetworkError(event.error, 'erro global não tratado');
});

window.addEventListener('unhandledrejection', (event) => {
  errorHandler.handleNetworkError(event.reason, 'promise rejeitada não tratada');
});

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.errorHandler = errorHandler;
}

console.log('✅ Error Handler inicializado');
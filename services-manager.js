// Gerenciador de Serviços - Carregamento Dinâmico
class ServicesManager {
  constructor() {
    this.services = [];
    this.isLoading = false;
    this.lastLoadTime = null;
    this.fallbackServices = this.getFallbackServices();
  }

  /**
   * Carrega serviços do Supabase com cache e fallback
   * @param {string} category - Categoria opcional para filtrar
   * @param {boolean} useCache - Se deve usar cache
   * @returns {Promise<Array>} Lista de serviços
   */
  async loadServices(category = null, useCache = true) {
    console.log('🔄 Carregando serviços...', { category, useCache });
    
    // Iniciar monitoramento de performance
    if (window.monitoringSystem) {
      monitoringSystem.startPerformanceMark('loadServices');
    }
    
    // Verificar cache primeiro
    if (useCache) {
      const cacheKey = cacheManager.generateKey('services', { category });
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('🎯 Serviços carregados do cache');
        this.services = cached;
        return cached;
      }
    }

    // Evitar múltiplas requisições simultâneas
    if (this.isLoading) {
      console.log('⏳ Carregamento já em andamento...');
      return this.services;
    }

    this.isLoading = true;
    this.showLoadingState();

    try {
      // Tentar carregar do Supabase
      const result = await this.loadFromSupabase(category);
      
      if (result.success && result.data.length > 0) {
        this.services = result.data;
        this.lastLoadTime = Date.now();
        
        // Salvar no cache
        const cacheKey = cacheManager.generateKey('services', { category });
        cacheManager.set(cacheKey, this.services);
        
        console.log(`✅ ${this.services.length} serviços carregados do Supabase`);
        this.renderServices();
        
        // Finalizar monitoramento de performance
        if (window.monitoringSystem) {
          monitoringSystem.endPerformanceMark('loadServices');
        }
        
        return this.services;
      } else {
        throw new Error(result.error || 'Nenhum serviço encontrado');
      }
      
    } catch (error) {
      console.warn('⚠️ Falha ao carregar do Supabase, usando fallback:', error.message);
      
      // Usar dados de fallback
      this.services = this.fallbackServices;
      this.renderServices();
      
      // Mostrar mensagem discreta para o usuário
      this.showOfflineMessage();
      
      return this.services;
    } finally {
      this.isLoading = false;
      this.hideLoadingState();
    }
  }

  /**
   * Carrega serviços do Supabase
   * @param {string} category - Categoria opcional
   * @returns {Promise<Object>} Resultado da operação
   */
  async loadFromSupabase(category = null) {
    try {
      if (!window.supabaseClient) {
        throw new Error('Cliente Supabase não disponível');
      }

      const result = await supabaseClient.getServices(category, false);
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Validar dados recebidos
      const validServices = [];
      for (const service of result.data || []) {
        const validation = DataModels.validateService(service);
        if (validation.valid) {
          validServices.push(validation.sanitized);
        } else {
          console.warn('⚠️ Serviço inválido ignorado:', validation.errors);
        }
      }

      return {
        success: true,
        data: validServices
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Renderiza serviços na interface
   */
  renderServices() {
    const servicesGrid = document.querySelector('.services-grid');
    if (!servicesGrid) {
      console.error('❌ Container de serviços não encontrado');
      return;
    }

    // Limpar conteúdo atual
    servicesGrid.innerHTML = '';

    // Renderizar cada serviço
    this.services.forEach(service => {
      const serviceElement = this.createServiceElement(service);
      servicesGrid.appendChild(serviceElement);
    });

    console.log(`🎨 ${this.services.length} serviços renderizados`);
  }

  /**
   * Cria elemento HTML para um serviço
   * @param {Object} service - Dados do serviço
   * @returns {HTMLElement} Elemento do serviço
   */
  createServiceElement(service) {
    const serviceCard = document.createElement('div');
    serviceCard.className = 'service-card';
    serviceCard.setAttribute('data-service-id', service.id || service.name);

    // Determinar emoji baseado na categoria ou nome
    const emoji = this.getServiceEmoji(service);
    
    serviceCard.innerHTML = `
      ${service.image_url ? 
        `<div class="service-image" style="background-image: url('${service.image_url}')" role="img" aria-label="Imagem do serviço ${service.name}">
          <div class="service-image-overlay">${service.description || 'Serviço de qualidade'}</div>
        </div>` :
        `<div class="service-image-placeholder" data-service="${service.name.toLowerCase().replace(/\s+/g, '-')}" role="img" aria-label="Imagem do serviço ${service.name}">
          ${emoji}
          <div class="service-image-overlay">${service.description || 'Serviço de qualidade'}</div>
        </div>`
      }
      <div class="service-content">
        <h3 class="service-title">${service.name}</h3>
        <p>${service.description || 'Serviço de qualidade para sua festa'}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px;">
          <span class="service-price">R$ ${service.price_per_person.toFixed(2).replace('.', ',')}/pessoa</span>
          <button class="btn-add" onclick="addService('${service.name}', ${service.price_per_person}, 'pessoa')">Adicionar</button>
        </div>
      </div>
    `;

    return serviceCard;
  }

  /**
   * Determina emoji apropriado para o serviço
   * @param {Object} service - Dados do serviço
   * @returns {string} Emoji
   */
  getServiceEmoji(service) {
    const name = service.name.toLowerCase();
    const category = (service.category || '').toLowerCase();
    
    if (name.includes('buffet') || category.includes('buffet')) return '🍽️';
    if (name.includes('bolo') || name.includes('cake')) return '🎂';
    if (name.includes('decoração') || name.includes('decoration')) return '🎨';
    if (name.includes('coffee') || name.includes('café')) return '☕';
    if (name.includes('jantar') || name.includes('dinner')) return '🥂';
    if (name.includes('coquetel') || name.includes('cocktail')) return '🍸';
    if (name.includes('lanche') || name.includes('snack')) return '🥪';
    if (name.includes('churrasco') || name.includes('bbq')) return '🔥';
    if (name.includes('bebida') || name.includes('drink')) return '🥤';
    if (name.includes('sobremesa') || name.includes('dessert')) return '🍰';
    
    return '🎉'; // Emoji padrão
  }

  /**
   * Mostra estado de carregamento
   */
  showLoadingState() {
    const servicesGrid = document.querySelector('.services-grid');
    if (servicesGrid) {
      servicesGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
          <div style="font-size: 2rem; margin-bottom: 10px;">⏳</div>
          <div>Carregando serviços...</div>
        </div>
      `;
    }
  }

  /**
   * Esconde estado de carregamento
   */
  hideLoadingState() {
    // O estado será substituído pelos serviços renderizados
  }

  /**
   * Mostra mensagem de modo offline
   */
  showOfflineMessage() {
    const message = {
      type: 'info',
      userMessage: 'Exibindo serviços salvos. Conecte-se à internet para ver atualizações.'
    };
    
    if (window.errorHandler) {
      errorHandler.showUserFriendlyMessage(message, 3000);
    }
  }

  /**
   * Retorna serviços de fallback (dados estáticos)
   * @returns {Array} Lista de serviços padrão
   */
  getFallbackServices() {
    return [
      {
        id: 'fallback-1',
        name: 'Buffet Completo',
        description: 'Salgados, doces, bebidas e serviço completo',
        price_per_person: 45.00,
        category: 'buffet',
        active: true
      },
      {
        id: 'fallback-2',
        name: 'Bolo Personalizado',
        description: 'Bolos temáticos e personalizados para sua festa',
        price_per_person: 120.00,
        category: 'doces',
        active: true
      },
      {
        id: 'fallback-3',
        name: 'Decoração Temática',
        description: 'Decoração completa para todos os tipos de festa',
        price_per_person: 200.00,
        category: 'decoracao',
        active: true
      },
      {
        id: 'fallback-4',
        name: 'Coffee Break Corporativo',
        description: 'Café, salgados, doces e sucos para eventos empresariais',
        price_per_person: 25.00,
        category: 'corporativo',
        active: true
      }
    ];
  }

  /**
   * Recarrega serviços forçando busca no servidor
   */
  async refreshServices() {
    console.log('🔄 Forçando atualização de serviços...');
    cacheManager.invalidate('services');
    return await this.loadServices(null, false);
  }

  /**
   * Retorna estatísticas dos serviços
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      total: this.services.length,
      lastLoad: this.lastLoadTime,
      categories: [...new Set(this.services.map(s => s.category))],
      priceRange: {
        min: Math.min(...this.services.map(s => s.price_per_person)),
        max: Math.max(...this.services.map(s => s.price_per_person))
      }
    };
  }
}

// Instância global do gerenciador de serviços
const servicesManager = new ServicesManager();

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.servicesManager = servicesManager;
}

console.log('✅ Services Manager inicializado');
// Gerenciador de Pacotes - Carregamento Dinâmico
class PackagesManager {
  constructor() {
    this.packages = [];
    this.isLoading = false;
    this.lastLoadTime = null;
    this.fallbackPackages = this.getFallbackPackages();
    this.currentEventType = null;
  }

  /**
   * Carrega pacotes do Supabase com cache e fallback
   * @param {string} eventType - Tipo de evento opcional para filtrar
   * @param {boolean} useCache - Se deve usar cache
   * @returns {Promise<Array>} Lista de pacotes
   */
  async loadPackages(eventType = null, useCache = true) {
    console.log('📦 Carregando pacotes...', { eventType, useCache });
    
    // Verificar cache primeiro
    if (useCache) {
      const cacheKey = cacheManager.generateKey('packages', { eventType });
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('🎯 Pacotes carregados do cache');
        this.packages = cached;
        this.currentEventType = eventType;
        return cached;
      }
    }

    // Evitar múltiplas requisições simultâneas
    if (this.isLoading) {
      console.log('⏳ Carregamento já em andamento...');
      return this.packages;
    }

    this.isLoading = true;
    this.showLoadingState();

    try {
      // Tentar carregar do Supabase
      const result = await this.loadFromSupabase(eventType);
      
      if (result.success && result.data.length > 0) {
        this.packages = result.data;
        this.currentEventType = eventType;
        this.lastLoadTime = Date.now();
        
        // Salvar no cache
        const cacheKey = cacheManager.generateKey('packages', { eventType });
        cacheManager.set(cacheKey, this.packages);
        
        console.log(`✅ ${this.packages.length} pacotes carregados do Supabase`);
        this.renderPackages();
        return this.packages;
      } else {
        throw new Error(result.error || 'Nenhum pacote encontrado');
      }
      
    } catch (error) {
      console.warn('⚠️ Falha ao carregar do Supabase, usando fallback:', error.message);
      
      // Usar dados de fallback filtrados
      this.packages = this.filterPackagesByEventType(this.fallbackPackages, eventType);
      this.currentEventType = eventType;
      this.renderPackages();
      
      // Mostrar mensagem discreta para o usuário
      this.showOfflineMessage();
      
      return this.packages;
    } finally {
      this.isLoading = false;
      this.hideLoadingState();
    }
  }

  /**
   * Carrega pacotes do Supabase
   * @param {string} eventType - Tipo de evento opcional
   * @returns {Promise<Object>} Resultado da operação
   */
  async loadFromSupabase(eventType = null) {
    try {
      if (!window.supabaseClient) {
        throw new Error('Cliente Supabase não disponível');
      }

      const result = await supabaseClient.getPackages(eventType, false);
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Validar dados recebidos
      const validPackages = [];
      for (const package of result.data || []) {
        const validation = DataModels.validatePackage(package);
        if (validation.valid) {
          validPackages.push(validation.sanitized);
        } else {
          console.warn('⚠️ Pacote inválido ignorado:', validation.errors);
        }
      }

      return {
        success: true,
        data: validPackages
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Filtra pacotes por tipo de evento
   * @param {Array} packages - Lista de pacotes
   * @param {string} eventType - Tipo de evento
   * @returns {Array} Pacotes filtrados
   */
  filterPackagesByEventType(packages, eventType) {
    if (!eventType) return packages;
    
    return packages.filter(pkg => 
      !pkg.event_type || 
      pkg.event_type.toLowerCase() === eventType.toLowerCase() ||
      pkg.event_type.toLowerCase() === 'todos'
    );
  }

  /**
   * Renderiza pacotes na interface
   */
  renderPackages() {
    const packagesContainer = this.getPackagesContainer();
    if (!packagesContainer) {
      console.error('❌ Container de pacotes não encontrado');
      return;
    }

    // Limpar conteúdo atual (manter o label)
    const existingPackages = packagesContainer.querySelectorAll('.package-card');
    existingPackages.forEach(card => card.remove());

    // Renderizar cada pacote
    this.packages.forEach(package => {
      const packageElement = this.createPackageElement(package);
      packagesContainer.appendChild(packageElement);
    });

    console.log(`🎨 ${this.packages.length} pacotes renderizados`);
  }

  /**
   * Encontra ou cria container de pacotes
   * @returns {HTMLElement} Container de pacotes
   */
  getPackagesContainer() {
    // Procurar container existente no simulador
    let container = document.querySelector('.packages-container');
    
    if (!container) {
      // Procurar onde inserir os pacotes (após o slider de convidados)
      const simulatorForm = document.querySelector('.simulator-form');
      const guestSlider = document.querySelector('#guestSlider');
      
      if (simulatorForm && guestSlider) {
        container = document.createElement('div');
        container.className = 'packages-container';
        
        // Inserir após o slider de convidados
        const sliderParent = guestSlider.closest('div');
        sliderParent.insertAdjacentElement('afterend', container);
      }
    }
    
    return container;
  }

  /**
   * Cria elemento HTML para um pacote
   * @param {Object} package - Dados do pacote
   * @returns {HTMLElement} Elemento do pacote
   */
  createPackageElement(package) {
    const packageCard = document.createElement('div');
    packageCard.className = 'package-card';
    packageCard.setAttribute('data-package-id', package.id || package.name);

    // Criar lista de serviços inclusos
    const servicesList = this.createServicesListHTML(package.services || []);
    
    packageCard.innerHTML = `
      <div class="package-header">
        <div class="package-name">${package.name}</div>
        <div class="package-price">R$ ${package.price_per_person.toFixed(2).replace('.', ',')}/pessoa</div>
      </div>
      <div class="package-description">
        ${package.description || ''}
      </div>
      ${servicesList}
      <div class="package-actions" style="margin-top: 15px;">
        <button class="btn-add" onclick="selectPackage(this, '${package.name}', ${package.price_per_person})" style="width: 100%;">
          Selecionar Pacote
        </button>
      </div>
    `;

    return packageCard;
  }

  /**
   * Cria HTML para lista de serviços inclusos
   * @param {Array} services - Lista de serviços
   * @returns {string} HTML da lista
   */
  createServicesListHTML(services) {
    if (!services || services.length === 0) {
      return '<div class="package-services">✓ Pacote básico incluído</div>';
    }

    const serviceItems = services.map(service => {
      if (typeof service === 'string') {
        return `✓ ${service}`;
      } else if (service.name) {
        return `✓ ${service.name}`;
      }
      return '✓ Serviço incluído';
    }).join('<br>');

    return `<div class="package-services">${serviceItems}</div>`;
  }

  /**
   * Mostra estado de carregamento
   */
  showLoadingState() {
    const container = this.getPackagesContainer();
    if (container) {
      const loadingElement = document.createElement('div');
      loadingElement.className = 'packages-loading';
      loadingElement.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
          <div style="font-size: 1.5rem; margin-bottom: 10px;">📦</div>
          <div>Carregando pacotes...</div>
        </div>
      `;
      container.appendChild(loadingElement);
    }
  }

  /**
   * Esconde estado de carregamento
   */
  hideLoadingState() {
    const loadingElement = document.querySelector('.packages-loading');
    if (loadingElement) {
      loadingElement.remove();
    }
  }

  /**
   * Mostra mensagem de modo offline
   */
  showOfflineMessage() {
    const message = {
      type: 'info',
      userMessage: 'Exibindo pacotes salvos. Conecte-se à internet para ver atualizações.'
    };
    
    if (window.errorHandler) {
      errorHandler.showUserFriendlyMessage(message, 3000);
    }
  }

  /**
   * Retorna pacotes de fallback (dados estáticos)
   * @returns {Array} Lista de pacotes padrão
   */
  getFallbackPackages() {
    return [
      {
        id: 'fallback-pkg-1',
        name: 'Pacote Básico',
        description: 'Ideal para eventos menores e orçamento controlado',
        price_per_person: 35.00,
        event_type: 'todos',
        services: [
          'Buffet simples',
          'Refrigerantes',
          'Bolo básico',
          'Decoração simples'
        ],
        active: true
      },
      {
        id: 'fallback-pkg-2',
        name: 'Pacote Completo',
        description: 'Tudo que você precisa para uma festa inesquecível',
        price_per_person: 55.00,
        event_type: 'todos',
        services: [
          'Buffet completo',
          'Bebidas variadas',
          'Bolo personalizado',
          'Decoração temática',
          'Serviço de garçons'
        ],
        active: true
      },
      {
        id: 'fallback-pkg-3',
        name: 'Pacote Premium',
        description: 'O máximo em sofisticação e qualidade',
        price_per_person: 85.00,
        event_type: 'casamento',
        services: [
          'Buffet gourmet',
          'Bar completo',
          'Bolo de múltiplos andares',
          'Decoração luxuosa',
          'Serviço completo',
          'Música ambiente'
        ],
        active: true
      },
      {
        id: 'fallback-pkg-4',
        name: 'Pacote Corporativo',
        description: 'Profissional e elegante para eventos empresariais',
        price_per_person: 45.00,
        event_type: 'corporativo',
        services: [
          'Coffee break',
          'Almoço executivo',
          'Bebidas não alcoólicas',
          'Decoração corporativa',
          'Serviço discreto'
        ],
        active: true
      }
    ];
  }

  /**
   * Recarrega pacotes forçando busca no servidor
   * @param {string} eventType - Tipo de evento
   */
  async refreshPackages(eventType = null) {
    console.log('🔄 Forçando atualização de pacotes...');
    cacheManager.invalidate('packages');
    return await this.loadPackages(eventType, false);
  }

  /**
   * Filtra pacotes por tipo de evento atual
   * @param {string} eventType - Tipo de evento
   */
  async filterByEventType(eventType) {
    console.log('🔍 Filtrando pacotes por tipo:', eventType);
    this.currentEventType = eventType;
    
    // Se já temos pacotes carregados, filtrar localmente
    if (this.packages.length > 0) {
      const filtered = this.filterPackagesByEventType(this.packages, eventType);
      this.packages = filtered;
      this.renderPackages();
      return filtered;
    }
    
    // Caso contrário, carregar do servidor/cache
    return await this.loadPackages(eventType);
  }

  /**
   * Retorna estatísticas dos pacotes
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      total: this.packages.length,
      lastLoad: this.lastLoadTime,
      currentEventType: this.currentEventType,
      eventTypes: [...new Set(this.packages.map(p => p.event_type))],
      priceRange: {
        min: Math.min(...this.packages.map(p => p.price_per_person)),
        max: Math.max(...this.packages.map(p => p.price_per_person))
      }
    };
  }
}

// Instância global do gerenciador de pacotes
const packagesManager = new PackagesManager();

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.packagesManager = packagesManager;
}

console.log('✅ Packages Manager inicializado');
// Gerenciador de Orçamentos - Sistema Completo
class QuotesManager {
  constructor() {
    this.currentQuote = null;
    this.isSubmitting = false;
    this.submissionHistory = [];
  }

  /**
   * Cria um novo orçamento baseado no simulador atual
   * @returns {Promise<Object>} Resultado da operação
   */
  async createQuoteFromSimulator() {
    console.log('💰 Criando orçamento do simulador...');

    try {
      // Coletar dados do simulador
      const quoteData = this.collectSimulatorData();
      
      if (!quoteData) {
        throw new Error('Dados do simulador não encontrados');
      }

      // Validar dados antes de enviar
      const validation = DataModels.validateQuote(quoteData);
      if (!validation.valid) {
        throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
      }

      // Enviar para o Supabase
      const result = await this.submitToSupabase(validation.sanitized);
      
      if (result.success) {
        this.currentQuote = result.data;
        this.addToHistory(result.data);
        this.showSuccessMessage(result.data);
        return result;
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('❌ Erro ao criar orçamento:', error);
      this.showErrorMessage(error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Coleta dados do simulador atual
   * @returns {Object|null} Dados do orçamento
   */
  collectSimulatorData() {
    try {
      // Obter número de convidados
      const guestCountElement = document.querySelector('#guestCount');
      const guestSlider = document.querySelector('#guestSlider');
      const guestCount = guestCountElement ? 
        parseInt(guestCountElement.textContent) : 
        (guestSlider ? parseInt(guestSlider.value) : 0);

      // Obter tipo de evento selecionado
      const activeEventType = document.querySelector('.event-type.active');
      const eventType = activeEventType ? activeEventType.textContent.trim() : 'Não especificado';

      // Obter serviços selecionados
      const selectedServices = this.getSelectedServices();

      // Calcular total
      const totalAmount = this.calculateTotal(selectedServices, guestCount);

      // Solicitar dados do cliente via modal
      return this.requestClientData({
        guest_count: guestCount,
        event_type: eventType,
        selected_services: selectedServices,
        total_amount: totalAmount
      });

    } catch (error) {
      console.error('❌ Erro ao coletar dados do simulador:', error);
      return null;
    }
  }

  /**
   * Obtém serviços selecionados do simulador
   * @returns {Array} Lista de serviços selecionados
   */
  getSelectedServices() {
    const services = [];
    const serviceItems = document.querySelectorAll('#servicesList .service-item');

    serviceItems.forEach(item => {
      const nameElement = item.querySelector('.service-name');
      const calcElement = item.querySelector('.service-calc');
      
      if (nameElement && calcElement) {
        const name = nameElement.textContent.trim();
        const calcText = calcElement.textContent.trim();
        
        // Extrair quantidade e preço do texto de cálculo
        const match = calcText.match(/(\d+)\s*x\s*R\$\s*([\d,]+)/);
        if (match) {
          services.push({
            name: name,
            quantity: parseInt(match[1]),
            price_per_unit: parseFloat(match[2].replace(',', '.')),
            total: parseInt(match[1]) * parseFloat(match[2].replace(',', '.'))
          });
        }
      }
    });

    return services;
  }

  /**
   * Calcula total do orçamento
   * @param {Array} services - Serviços selecionados
   * @param {number} guestCount - Número de convidados
   * @returns {number} Total calculado
   */
  calculateTotal(services, guestCount) {
    return services.reduce((total, service) => total + service.total, 0);
  }

  /**
   * Solicita dados do cliente via modal
   * @param {Object} quoteData - Dados base do orçamento
   * @returns {Promise<Object>} Dados completos do orçamento
   */
  requestClientData(quoteData) {
    return new Promise((resolve, reject) => {
      // Criar modal para dados do cliente
      const modal = this.createClientDataModal(quoteData);
      document.body.appendChild(modal);
      modal.style.display = 'flex';

      // Configurar eventos do modal
      const form = modal.querySelector('#clientDataForm');
      const closeBtn = modal.querySelector('.close-modal');
      const cancelBtn = modal.querySelector('.cancel-btn');

      const closeModal = () => {
        modal.remove();
        reject(new Error('Operação cancelada pelo usuário'));
      };

      closeBtn.addEventListener('click', closeModal);
      cancelBtn.addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const clientData = {
          client_name: formData.get('client_name'),
          client_email: formData.get('client_email'),
          client_phone: formData.get('client_phone'),
          ...quoteData
        };

        modal.remove();
        resolve(clientData);
      });
    });
  }

  /**
   * Cria modal para coleta de dados do cliente
   * @param {Object} quoteData - Dados do orçamento
   * @returns {HTMLElement} Modal criado
   */
  createClientDataModal(quoteData) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3 class="modal-title">Finalizar Orçamento</h3>
          <button class="close-modal" type="button">&times;</button>
        </div>
        
        <div class="quote-summary" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #9c27b0;">Resumo do Orçamento</h4>
          <div><strong>Evento:</strong> ${quoteData.event_type}</div>
          <div><strong>Convidados:</strong> ${quoteData.guest_count}</div>
          <div><strong>Serviços:</strong> ${quoteData.selected_services.length} selecionados</div>
          <div style="font-size: 1.2rem; font-weight: bold; color: #4caf50; margin-top: 10px;">
            <strong>Total: R$ ${quoteData.total_amount.toFixed(2).replace('.', ',')}</strong>
          </div>
        </div>

        <form id="clientDataForm">
          <div style="margin-bottom: 15px;">
            <label for="client_name" style="display: block; margin-bottom: 5px; font-weight: 600;">Nome Completo *</label>
            <input type="text" id="client_name" name="client_name" required 
                   style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;"
                   placeholder="Seu nome completo">
          </div>

          <div style="margin-bottom: 15px;">
            <label for="client_email" style="display: block; margin-bottom: 5px; font-weight: 600;">Email *</label>
            <input type="email" id="client_email" name="client_email" required 
                   style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;"
                   placeholder="seu@email.com">
          </div>

          <div style="margin-bottom: 20px;">
            <label for="client_phone" style="display: block; margin-bottom: 5px; font-weight: 600;">Telefone *</label>
            <input type="tel" id="client_phone" name="client_phone" required 
                   style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;"
                   placeholder="(85) 99999-9999">
          </div>

          <div style="display: flex; gap: 10px;">
            <button type="button" class="cancel-btn" 
                    style="flex: 1; padding: 12px; border: 2px solid #ccc; background: white; border-radius: 8px; cursor: pointer;">
              Cancelar
            </button>
            <button type="submit" 
                    style="flex: 2; padding: 12px; background: linear-gradient(135deg, #9c27b0, #e91e63); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
              💰 Enviar Orçamento
            </button>
          </div>
        </form>
      </div>
    `;

    return modal;
  }

  /**
   * Envia orçamento para o Supabase
   * @param {Object} quoteData - Dados do orçamento
   * @returns {Promise<Object>} Resultado da operação
   */
  async submitToSupabase(quoteData) {
    if (this.isSubmitting) {
      return { success: false, error: 'Envio já em andamento' };
    }

    this.isSubmitting = true;

    try {
      if (!window.supabaseClient) {
        throw new Error('Cliente Supabase não disponível');
      }

      const result = await supabaseClient.createQuote(quoteData);
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      return {
        success: true,
        data: result.data[0] // Supabase retorna array
      };

    } catch (error) {
      // Salvar localmente se falhar
      this.saveLocallyAsFallback(quoteData);
      
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Salva orçamento localmente como fallback
   * @param {Object} quoteData - Dados do orçamento
   */
  saveLocallyAsFallback(quoteData) {
    try {
      const localQuotes = JSON.parse(localStorage.getItem('buffet_quotes') || '[]');
      const quoteWithId = {
        ...quoteData,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        status: 'pending_sync'
      };
      
      localQuotes.push(quoteWithId);
      localStorage.setItem('buffet_quotes', JSON.stringify(localQuotes));
      
      console.log('💾 Orçamento salvo localmente para sincronização posterior');
      
      this.showOfflineSuccessMessage(quoteWithId);
    } catch (error) {
      console.error('❌ Erro ao salvar localmente:', error);
    }
  }

  /**
   * Mostra mensagem de sucesso
   * @param {Object} quoteData - Dados do orçamento criado
   */
  showSuccessMessage(quoteData) {
    const message = {
      type: 'success',
      userMessage: `✅ Orçamento enviado! Protocolo: ${quoteData.protocol_number}`
    };
    
    if (window.errorHandler) {
      errorHandler.showUserFriendlyMessage(message, 5000);
    }

    // Atualizar botão do WhatsApp com protocolo
    this.updateWhatsAppButton(quoteData);
  }

  /**
   * Mostra mensagem de sucesso offline
   * @param {Object} quoteData - Dados do orçamento salvo localmente
   */
  showOfflineSuccessMessage(quoteData) {
    const message = {
      type: 'info',
      userMessage: `💾 Orçamento salvo! Será enviado quando conectar. Protocolo: ${quoteData.protocol_number}`
    };
    
    if (window.errorHandler) {
      errorHandler.showUserFriendlyMessage(message, 7000);
    }

    this.updateWhatsAppButton(quoteData);
  }

  /**
   * Mostra mensagem de erro
   * @param {string} errorMessage - Mensagem de erro
   */
  showErrorMessage(errorMessage) {
    const message = {
      type: 'error',
      userMessage: `❌ Erro ao enviar orçamento: ${errorMessage}`
    };
    
    if (window.errorHandler) {
      errorHandler.showUserFriendlyMessage(message, 5000);
    }
  }

  /**
   * Atualiza botão do WhatsApp com dados do orçamento
   * @param {Object} quoteData - Dados do orçamento
   */
  updateWhatsAppButton(quoteData) {
    const whatsappBtn = document.querySelector('#whatsappBtn');
    if (whatsappBtn) {
      whatsappBtn.style.display = 'block';
      whatsappBtn.onclick = () => this.shareOnWhatsApp(quoteData);
    }
  }

  /**
   * Compartilha orçamento no WhatsApp
   * @param {Object} quoteData - Dados do orçamento
   */
  shareOnWhatsApp(quoteData) {
    const message = this.generateWhatsAppMessage(quoteData);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/5585999999999?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  }

  /**
   * Gera mensagem para WhatsApp
   * @param {Object} quoteData - Dados do orçamento
   * @returns {string} Mensagem formatada
   */
  generateWhatsAppMessage(quoteData) {
    const services = quoteData.selected_services.map(s => 
      `• ${s.name} (${s.quantity}x) - R$ ${s.total.toFixed(2).replace('.', ',')}`
    ).join('\n');

    return `🎉 *Orçamento Buffet Sobral*

📋 *Protocolo:* ${quoteData.protocol_number}
👤 *Cliente:* ${quoteData.client_name}
📧 *Email:* ${quoteData.client_email}
📱 *Telefone:* ${quoteData.client_phone}

🎊 *Detalhes do Evento:*
• Tipo: ${quoteData.event_type}
• Convidados: ${quoteData.guest_count}

🍽️ *Serviços Selecionados:*
${services}

💰 *Total: R$ ${quoteData.total_amount.toFixed(2).replace('.', ',')}*

Gostaria de confirmar este orçamento e agendar uma conversa! 😊`;
  }

  /**
   * Adiciona orçamento ao histórico
   * @param {Object} quoteData - Dados do orçamento
   */
  addToHistory(quoteData) {
    this.submissionHistory.unshift(quoteData);
    
    // Manter apenas os últimos 10
    if (this.submissionHistory.length > 10) {
      this.submissionHistory = this.submissionHistory.slice(0, 10);
    }
  }

  /**
   * Retorna estatísticas dos orçamentos
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      totalSubmissions: this.submissionHistory.length,
      currentQuote: this.currentQuote,
      isSubmitting: this.isSubmitting,
      lastSubmission: this.submissionHistory[0] || null
    };
  }
}

// Instância global do gerenciador de orçamentos
const quotesManager = new QuotesManager();

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.quotesManager = quotesManager;
}

console.log('✅ Quotes Manager inicializado');
// Modelos de Dados e Validação
class DataModels {
  
  /**
   * Valida dados de serviço
   * @param {object} service - Dados do serviço
   * @returns {object} Resultado da validação
   */
  static validateService(service) {
    const errors = [];
    
    if (!service) {
      return { valid: false, errors: ['Serviço não fornecido'] };
    }

    // Campos obrigatórios
    if (!service.name || typeof service.name !== 'string') {
      errors.push('Nome do serviço é obrigatório');
    }

    if (!service.price_per_person || isNaN(service.price_per_person)) {
      errors.push('Preço por pessoa deve ser um número válido');
    }

    // Validações opcionais
    if (service.category && typeof service.category !== 'string') {
      errors.push('Categoria deve ser uma string');
    }

    if (service.image_url && !this.isValidUrl(service.image_url)) {
      errors.push('URL da imagem inválida');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this.sanitizeService(service)
    };
  }

  /**
   * Valida dados de pacote
   * @param {object} package - Dados do pacote
   * @returns {object} Resultado da validação
   */
  static validatePackage(package) {
    const errors = [];
    
    if (!package) {
      return { valid: false, errors: ['Pacote não fornecido'] };
    }

    // Campos obrigatórios
    if (!package.name || typeof package.name !== 'string') {
      errors.push('Nome do pacote é obrigatório');
    }

    if (!package.price_per_person || isNaN(package.price_per_person)) {
      errors.push('Preço por pessoa deve ser um número válido');
    }

    // Validar serviços inclusos se fornecidos
    if (package.services && !Array.isArray(package.services)) {
      errors.push('Serviços devem ser uma lista');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this.sanitizePackage(package)
    };
  }

  /**
   * Valida dados de orçamento
   * @param {object} quote - Dados do orçamento
   * @returns {object} Resultado da validação
   */
  static validateQuote(quote) {
    const errors = [];
    
    if (!quote) {
      return { valid: false, errors: ['Dados do orçamento não fornecidos'] };
    }

    // Campos obrigatórios
    if (!quote.client_name || typeof quote.client_name !== 'string') {
      errors.push('Nome do cliente é obrigatório');
    }

    if (!quote.client_email || !this.isValidEmail(quote.client_email)) {
      errors.push('Email válido é obrigatório');
    }

    if (!quote.client_phone || typeof quote.client_phone !== 'string') {
      errors.push('Telefone é obrigatório');
    }

    if (!quote.guest_count || isNaN(quote.guest_count) || quote.guest_count < 1) {
      errors.push('Número de convidados deve ser maior que zero');
    }

    if (!quote.selected_services || !Array.isArray(quote.selected_services)) {
      errors.push('Serviços selecionados são obrigatórios');
    }

    if (!quote.total_amount || isNaN(quote.total_amount) || quote.total_amount <= 0) {
      errors.push('Valor total deve ser maior que zero');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this.sanitizeQuote(quote)
    };
  }

  /**
   * Valida dados de agendamento
   * @param {object} booking - Dados do agendamento
   * @returns {object} Resultado da validação
   */
  static validateBooking(booking) {
    const errors = [];
    
    if (!booking) {
      return { valid: false, errors: ['Dados do agendamento não fornecidos'] };
    }

    // Campos obrigatórios
    if (!booking.client_name || typeof booking.client_name !== 'string') {
      errors.push('Nome do cliente é obrigatório');
    }

    if (!booking.client_email || !this.isValidEmail(booking.client_email)) {
      errors.push('Email válido é obrigatório');
    }

    if (!booking.client_phone || typeof booking.client_phone !== 'string') {
      errors.push('Telefone é obrigatório');
    }

    if (!booking.event_date || !this.isValidDate(booking.event_date)) {
      errors.push('Data do evento é obrigatória e deve ser válida');
    }

    if (!booking.event_type || typeof booking.event_type !== 'string') {
      errors.push('Tipo de evento é obrigatório');
    }

    if (!booking.guest_count || isNaN(booking.guest_count) || booking.guest_count < 1) {
      errors.push('Número de convidados deve ser maior que zero');
    }

    // Validar se a data não é no passado
    if (booking.event_date && new Date(booking.event_date) < new Date()) {
      errors.push('Data do evento não pode ser no passado');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this.sanitizeBooking(booking)
    };
  }

  /**
   * Sanitiza dados de serviço
   * @param {object} service - Dados do serviço
   * @returns {object} Dados sanitizados
   */
  static sanitizeService(service) {
    return {
      id: service.id,
      name: this.sanitizeString(service.name),
      description: this.sanitizeString(service.description),
      price_per_person: parseFloat(service.price_per_person) || 0,
      category: this.sanitizeString(service.category),
      image_url: this.sanitizeUrl(service.image_url),
      active: Boolean(service.active)
    };
  }

  /**
   * Sanitiza dados de pacote
   * @param {object} package - Dados do pacote
   * @returns {object} Dados sanitizados
   */
  static sanitizePackage(package) {
    return {
      id: package.id,
      name: this.sanitizeString(package.name),
      description: this.sanitizeString(package.description),
      price_per_person: parseFloat(package.price_per_person) || 0,
      event_type: this.sanitizeString(package.event_type),
      services: Array.isArray(package.services) ? package.services : [],
      active: Boolean(package.active)
    };
  }

  /**
   * Sanitiza dados de orçamento
   * @param {object} quote - Dados do orçamento
   * @returns {object} Dados sanitizados
   */
  static sanitizeQuote(quote) {
    return {
      client_name: this.sanitizeString(quote.client_name),
      client_email: this.sanitizeEmail(quote.client_email),
      client_phone: this.sanitizePhone(quote.client_phone),
      event_type: this.sanitizeString(quote.event_type),
      guest_count: parseInt(quote.guest_count) || 0,
      selected_services: Array.isArray(quote.selected_services) ? quote.selected_services : [],
      total_amount: parseFloat(quote.total_amount) || 0,
      protocol_number: this.generateProtocolNumber()
    };
  }

  /**
   * Sanitiza dados de agendamento
   * @param {object} booking - Dados do agendamento
   * @returns {object} Dados sanitizados
   */
  static sanitizeBooking(booking) {
    return {
      client_name: this.sanitizeString(booking.client_name),
      client_email: this.sanitizeEmail(booking.client_email),
      client_phone: this.sanitizePhone(booking.client_phone),
      event_date: this.sanitizeDate(booking.event_date),
      event_type: this.sanitizeString(booking.event_type),
      guest_count: parseInt(booking.guest_count) || 0,
      event_details: this.sanitizeString(booking.event_details),
      protocol_number: this.generateProtocolNumber()
    };
  }

  // Utilitários de validação
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isValidDate(date) {
    return !isNaN(Date.parse(date));
  }

  // Utilitários de sanitização
  static sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.trim().substring(0, 255);
  }

  static sanitizeEmail(email) {
    if (typeof email !== 'string') return '';
    return email.trim().toLowerCase();
  }

  static sanitizePhone(phone) {
    if (typeof phone !== 'string') return '';
    return phone.replace(/[^\d\s\-\(\)\+]/g, '');
  }

  static sanitizeUrl(url) {
    if (typeof url !== 'string') return '';
    return url.trim();
  }

  static sanitizeDate(date) {
    return new Date(date).toISOString();
  }

  /**
   * Gera número de protocolo único
   * @returns {string} Número de protocolo
   */
  static generateProtocolNumber() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `BS${timestamp}${random}`.toUpperCase();
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.DataModels = DataModels;
}

console.log('✅ Data Models inicializados');
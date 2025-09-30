// Supabase client configuration aprimorado para frontend
// Versão otimizada para uso no browser

// Configuração de ambiente - para uso no browser
const supabaseUrl = window.SUPABASE_URL || 'YOUR_SUPABASE_PROJECT_URL';
const supabaseKey = window.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Validação de variáveis de ambiente
function validateEnvironment() {
  const errors = [];
  
  if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_PROJECT_URL') {
    errors.push('SUPABASE_URL não configurada');
  }
  
  if (!supabaseKey || supabaseKey === 'YOUR_SUPABASE_ANON_KEY') {
    errors.push('SUPABASE_ANON_KEY não configurada');
  }
  
  if (errors.length > 0) {
    console.error('❌ Erro de configuração Supabase:', errors);
    return false;
  }
  
  console.log('✅ Configuração Supabase validada com sucesso');
  return true;
}

// Função para carregar Supabase dinamicamente
async function loadSupabase() {
  try {
    // Carregar Supabase via CDN
    const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js');
    
    if (validateEnvironment()) {
      return createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
    } else {
      throw new Error('Configuração inválida');
    }
  } catch (error) {
    console.error('Falha ao carregar Supabase:', error);
    // Cliente mock para desenvolvimento
    return {
      from: () => ({ 
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: [], error: null }),
        update: () => Promise.resolve({ data: [], error: null }),
        delete: () => Promise.resolve({ data: [], error: null }),
        eq: function() { return this; },
        order: function() { return this; }
      }),
      storage: { 
        from: () => ({ 
          upload: () => Promise.resolve({ error: null }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
          remove: () => Promise.resolve({ error: null })
        }) 
      }
    };
  }
}

// Cliente Supabase aprimorado com retry e cache
class SupabaseClient {
  constructor() {
    this.client = null;
    this.retryCount = 3;
    this.retryDelay = 1000; // 1 segundo
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      this.client = await loadSupabase();
      this.initialized = true;
    }
    return this.client;
  }

  // Método de retry com backoff exponencial
  async withRetry(operation, context = 'operação') {
    await this.init();
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const result = await operation();
        
        if (result.error) {
          throw new Error(`Supabase error: ${result.error.message}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`Tentativa ${attempt}/${this.retryCount} falhou para ${context}:`, error.message);
        
        if (attempt < this.retryCount) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Falha após ${this.retryCount} tentativas em ${context}: ${lastError.message}`);
  }

  // Cache helpers
  getCacheKey(table, params = {}) {
    return `${table}_${JSON.stringify(params)}`;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  // Métodos para Serviços
  async getServices(category = null, useCache = true) {
    const cacheKey = this.getCacheKey('services', { category });
    
    if (useCache) {
      const cached = this.getCache(cacheKey);
      if (cached) return { data: cached, error: null };
    }

    const result = await this.withRetry(async () => {
      let query = this.client.from('services').select('*').eq('active', true);
      
      if (category) {
        query = query.eq('category', category);
      }
      
      return await query.order('name');
    }, 'buscar serviços');

    if (result.data) {
      this.setCache(cacheKey, result.data);
    }

    return result;
  }

  async createService(serviceData) {
    return await this.withRetry(async () => {
      return await this.client.from('services').insert([serviceData]).select();
    }, 'criar serviço');
  }

  async updateService(id, serviceData) {
    const result = await this.withRetry(async () => {
      return await this.client.from('services')
        .update(serviceData)
        .eq('id', id)
        .select();
    }, 'atualizar serviço');

    // Limpar cache relacionado
    this.clearCacheByPattern('services');
    return result;
  }

  async deleteService(id) {
    const result = await this.withRetry(async () => {
      return await this.client.from('services').delete().eq('id', id);
    }, 'deletar serviço');

    this.clearCacheByPattern('services');
    return result;
  }

  // Métodos para Pacotes
  async getPackages(eventType = null, useCache = true) {
    const cacheKey = this.getCacheKey('packages', { eventType });
    
    if (useCache) {
      const cached = this.getCache(cacheKey);
      if (cached) return { data: cached, error: null };
    }

    const result = await this.withRetry(async () => {
      let query = this.client.from('packages').select('*').eq('active', true);
      
      if (eventType) {
        query = query.eq('event_type', eventType);
      }
      
      return await query.order('price_per_person');
    }, 'buscar pacotes');

    if (result.data) {
      this.setCache(cacheKey, result.data);
    }

    return result;
  }

  async createPackage(packageData) {
    return await this.withRetry(async () => {
      return await this.client.from('packages').insert([packageData]).select();
    }, 'criar pacote');
  }

  async updatePackage(id, packageData) {
    const result = await this.withRetry(async () => {
      return await this.client.from('packages')
        .update(packageData)
        .eq('id', id)
        .select();
    }, 'atualizar pacote');

    this.clearCacheByPattern('packages');
    return result;
  }

  // Métodos para Orçamentos
  async createQuote(quoteData) {
    return await this.withRetry(async () => {
      return await this.client.from('quotes').insert([quoteData]).select();
    }, 'criar orçamento');
  }

  async getQuotes(status = null) {
    return await this.withRetry(async () => {
      let query = this.client.from('quotes').select('*');
      
      if (status) {
        query = query.eq('status', status);
      }
      
      return await query.order('created_at', { ascending: false });
    }, 'buscar orçamentos');
  }

  async updateQuoteStatus(id, status) {
    return await this.withRetry(async () => {
      return await this.client.from('quotes')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select();
    }, 'atualizar status do orçamento');
  }

  // Métodos para Fotos
  async getSpacePhotos(useCache = true) {
    const cacheKey = this.getCacheKey('space_photos');
    
    if (useCache) {
      const cached = this.getCache(cacheKey);
      if (cached) return { data: cached, error: null };
    }

    const result = await this.withRetry(async () => {
      return await this.client.from('space_photos')
        .select('*')
        .eq('active', true)
        .order('upload_date', { ascending: false });
    }, 'buscar fotos do espaço');

    if (result.data) {
      this.setCache(cacheKey, result.data);
    }

    return result;
  }

  // Métodos para Upload de Imagens
  async uploadImage(file, bucket = 'service-images', path = null) {
    if (!path) {
      const timestamp = Date.now();
      const extension = file.name.split('.').pop();
      path = `${timestamp}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
    }

    return await this.withRetry(async () => {
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(path, file);

      if (error) throw error;

      // Obter URL pública
      const { data: urlData } = this.client.storage
        .from(bucket)
        .getPublicUrl(path);

      return { data: { ...data, publicUrl: urlData.publicUrl }, error: null };
    }, 'upload de imagem');
  }

  async deleteImage(path, bucket = 'service-images') {
    return await this.withRetry(async () => {
      return await this.client.storage.from(bucket).remove([path]);
    }, 'deletar imagem');
  }

  // Métodos para Vídeos
  async getFeaturedVideos(useCache = true) {
    const cacheKey = this.getCacheKey('featured_videos');
    
    if (useCache) {
      const cached = this.getCache(cacheKey);
      if (cached) return { data: cached, error: null };
    }

    const result = await this.withRetry(async () => {
      return await this.client.from('featured_videos')
        .select('*')
        .eq('active', true)
        .order('added_date', { ascending: false });
    }, 'buscar vídeos em destaque');

    if (result.data) {
      this.setCache(cacheKey, result.data);
    }

    return result;
  }

  // Utilitários de Cache
  clearCacheByPattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clearAllCache() {
    this.cache.clear();
  }

  // Método para testar conexão
  async testConnection() {
    try {
      await this.init();
      const result = await this.client.from('services').select('count').limit(1);
      return { connected: !result.error, error: result.error };
    } catch (error) {
      return { connected: false, error };
    }
  }
}

// Instância global do cliente
const supabaseClient = new SupabaseClient();

// Disponibilizar globalmente
window.supabaseClient = supabaseClient;

// Inicializar automaticamente
supabaseClient.init().then(() => {
  console.log('✅ Supabase Client inicializado');
}).catch(error => {
  console.error('❌ Erro ao inicializar Supabase Client:', error);
});

// Exportar para compatibilidade
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { supabaseClient };
}
/**
 * 高级API配置管理
 * 支持多种API提供商的统一配置管理
 */
class AdvancedAPIConfig {
    constructor() {
        this.configKey = 'advanced-api-config';
        this.defaultConfig = this.getDefaultConfig();
        this.config = this.loadConfig();
        this.apiManager = null;

        // 初始化API管理器
        this.initializeAPIManager();
    }

    // 获取默认配置
    getDefaultConfig() {
        return {
            // 当前活跃的提供商
            activeProvider: 'openai',

            // API提供商配置
            providers: {
                openai: {
                    name: 'OpenAI',
                    enabled: true,
                    credentials: {
                        apiKey: 'sk-qJv60VOOREcVfbwnCvF49vaNgA4cSF91BEu8BESa7DCPptFq', // 从原配置迁移
                        organization: '',
                        baseUrl: 'https://api.chatanywhere.tech/v1' // 从原配置迁移
                    },
                    defaultModel: 'gpt-5-mini', // 从原配置迁移
                    options: {
                        timeout: 30000,
                        maxTokens: 100000, // 从原配置迁移
                        temperature: 0.7, // 从原配置迁移
                        retries: 3,
                        rateLimit: { requests: 60, window: 60000 },
                        cache: { enabled: true, ttl: 300000 }
                    }
                },

                anthropic: {
                    name: 'Anthropic Claude',
                    enabled: false,
                    credentials: {
                        apiKey: '',
                        baseUrl: 'https://api.anthropic.com/v1'
                    },
                    defaultModel: 'claude-3-sonnet',
                    options: {
                        timeout: 30000,
                        maxTokens: 4000,
                        temperature: 0.7,
                        retries: 3,
                        rateLimit: { requests: 50, window: 60000 },
                        cache: { enabled: true, ttl: 300000 }
                    }
                },

                google: {
                    name: 'Google AI',
                    enabled: false,
                    credentials: {
                        apiKey: '',
                        baseUrl: 'https://generativelanguage.googleapis.com/v1'
                    },
                    defaultModel: 'gemini-pro',
                    options: {
                        timeout: 30000,
                        maxTokens: 2048,
                        temperature: 0.7,
                        retries: 3,
                        rateLimit: { requests: 60, window: 60000 },
                        cache: { enabled: true, ttl: 300000 }
                    }
                },

                local: {
                    name: '本地模型',
                    enabled: false,
                    credentials: {
                        baseUrl: 'http://localhost:11434'
                    },
                    defaultModel: 'llama2',
                    options: {
                        timeout: 60000,
                        maxTokens: 4096,
                        temperature: 0.7,
                        retries: 1,
                        rateLimit: { requests: 100, window: 60000 },
                        cache: { enabled: false }
                    }
                },

                azure: {
                    name: 'Azure OpenAI',
                    enabled: false,
                    credentials: {
                        apiKey: '',
                        endpoint: '',
                        apiVersion: '2024-02-01'
                    },
                    defaultModel: 'gpt-4',
                    options: {
                        timeout: 30000,
                        maxTokens: 4000,
                        temperature: 0.7,
                        retries: 3,
                        rateLimit: { requests: 60, window: 60000 },
                        cache: { enabled: true, ttl: 300000 }
                    }
                }
            },

            // MCP服务配置
            mcpServers: {
                filesystem: {
                    name: '文件系统服务',
                    enabled: false,
                    transport: 'stdio',
                    command: 'npx',
                    args: ['@modelcontextprotocol/server-filesystem', '/tmp']
                },

                git: {
                    name: 'Git服务',
                    enabled: false,
                    transport: 'stdio',
                    command: 'npx',
                    args: ['@modelcontextprotocol/server-git']
                },

                database: {
                    name: '数据库服务',
                    enabled: false,
                    transport: 'stdio',
                    command: 'npx',
                    args: ['@modelcontextprotocol/server-sqlite', 'database.db']
                }
            },

            // IoT设备配置
            iotDevices: {
                mqtt_broker: {
                    name: 'MQTT代理',
                    enabled: false,
                    type: 'mqtt',
                    host: 'localhost',
                    port: 1883,
                    username: '',
                    password: '',
                    topics: ['sensors/+', 'actuators/+']
                },

                home_assistant: {
                    name: 'Home Assistant',
                    enabled: false,
                    type: 'websocket',
                    url: 'ws://localhost:8123/api/websocket',
                    token: ''
                }
            },

            // 服务器集成配置
            servers: {
                webhook: {
                    name: 'Webhook服务器',
                    enabled: false,
                    url: 'http://localhost:3000/webhook',
                    auth: {
                        type: 'bearer',
                        token: ''
                    }
                },

                database: {
                    name: '数据库服务',
                    enabled: false,
                    type: 'postgresql',
                    connection: {
                        host: 'localhost',
                        port: 5432,
                        database: 'agentflow',
                        username: '',
                        password: ''
                    }
                }
            },

            // 插件配置
            plugins: {
                cache: { enabled: true },
                logger: { enabled: true, level: 'info' },
                monitor: { enabled: true, interval: 60000 },
                rateLimit: { enabled: true },
                encryption: { enabled: false }
            },

            // 全局设置
            global: {
                autoExpandResults: false, // 从原配置迁移
                nodeDefaultWidth: 180,
                nodeDefaultHeight: 80,
                debugMode: false,
                offlineMode: false
            }
        };
    }

    // 加载配置
    loadConfig() {
        try {
            const saved = localStorage.getItem(this.configKey);
            if (saved) {
                const loaded = JSON.parse(saved);
                return this.mergeConfigs(this.defaultConfig, loaded);
            }
        } catch (error) {
            console.warn('加载高级API配置失败:', error);
        }
        return { ...this.defaultConfig };
    }

    // 合并配置
    mergeConfigs(defaultConfig, userConfig) {
        const merged = { ...defaultConfig };

        Object.keys(userConfig).forEach(key => {
            if (typeof userConfig[key] === 'object' && userConfig[key] !== null && !Array.isArray(userConfig[key])) {
                merged[key] = { ...defaultConfig[key], ...userConfig[key] };
            } else {
                merged[key] = userConfig[key];
            }
        });

        return merged;
    }

    // 保存配置
    saveConfig(newConfig = null) {
        try {
            const configToSave = newConfig || this.config;
            this.config = configToSave;
            localStorage.setItem(this.configKey, JSON.stringify(this.config));

            // 重新配置API管理器
            this.updateAPIManager();

            return true;
        } catch (error) {
            console.error('保存高级API配置失败:', error);
            return false;
        }
    }

    // 初始化API管理器
    async initializeAPIManager() {
        if (typeof AdvancedAPIManager === 'undefined') {
            console.warn('AdvancedAPIManager未加载，跳过初始化');
            return;
        }

        this.apiManager = new AdvancedAPIManager();

        // 配置所有启用的提供商
        await this.configureAllProviders();

        // 配置MCP服务
        await this.configureMCPServers();

        // 配置IoT设备
        await this.configureIoTDevices();

        // 注册插件
        this.registerPlugins();

        console.log('✅ 高级API管理器初始化完成');
    }

    // 配置所有提供商
    async configureAllProviders() {
        for (const [id, config] of Object.entries(this.config.providers)) {
            if (config.enabled && config.credentials.apiKey) {
                try {
                    await this.apiManager.configureProvider(id, config.credentials, config.options);
                    console.log(`✅ 提供商配置成功: ${config.name}`);
                } catch (error) {
                    console.error(`❌ 提供商配置失败: ${config.name}`, error);
                }
            }
        }
    }

    // 配置MCP服务
    async configureMCPServers() {
        for (const [name, config] of Object.entries(this.config.mcpServers)) {
            if (config.enabled) {
                try {
                    await this.apiManager.registerMCPServer(name, config);
                } catch (error) {
                    console.error(`❌ MCP服务配置失败: ${name}`, error);
                }
            }
        }
    }

    // 配置IoT设备
    async configureIoTDevices() {
        for (const [deviceId, config] of Object.entries(this.config.iotDevices)) {
            if (config.enabled) {
                try {
                    await this.apiManager.connectIoTDevice(deviceId, config);
                } catch (error) {
                    console.error(`❌ IoT设备配置失败: ${deviceId}`, error);
                }
            }
        }
    }

    // 注册插件
    registerPlugins() {
        if (typeof presetPlugins === 'undefined') return;

        Object.entries(this.config.plugins).forEach(([name, config]) => {
            if (config.enabled && presetPlugins[name]) {
                this.apiManager.registerPlugin(name, presetPlugins[name]);
            }
        });
    }

    // 更新API管理器配置
    async updateAPIManager() {
        if (this.apiManager) {
            await this.configureAllProviders();
        }
    }

    // 获取当前活跃的提供商配置
    getActiveProvider() {
        const providerId = this.config.activeProvider;
        return this.config.providers[providerId];
    }

    // 设置活跃的提供商
    setActiveProvider(providerId) {
        if (this.config.providers[providerId]) {
            this.config.activeProvider = providerId;
            this.saveConfig();
            return true;
        }
        return false;
    }

    // 获取特定提供商配置
    getProviderConfig(providerId) {
        return this.config.providers[providerId];
    }

    // 更新提供商配置
    updateProviderConfig(providerId, updates) {
        if (this.config.providers[providerId]) {
            this.config.providers[providerId] = {
                ...this.config.providers[providerId],
                ...updates
            };
            this.saveConfig();
            return true;
        }
        return false;
    }

    // 兼容旧的Config接口
    getConfig() {
        const activeProvider = this.getActiveProvider();
        if (!activeProvider) {
            console.warn('没有活跃的API提供商');
            return this.defaultConfig;
        }

        return {
            url: activeProvider.credentials.baseUrl + '/chat/completions',
            apiKey: activeProvider.credentials.apiKey,
            model: activeProvider.defaultModel,
            maxTokens: activeProvider.options.maxTokens,
            temperature: activeProvider.options.temperature,
            autoExpandResults: this.config.global.autoExpandResults
        };
    }

    // 兼容旧的Config接口
    get(key) {
        const oldConfig = this.getConfig();
        return oldConfig[key];
    }

    // 兼容旧的Config接口
    set(key, value) {
        const activeProvider = this.getActiveProvider();
        if (!activeProvider) return;

        const updates = {};

        switch (key) {
            case 'url':
                updates.credentials = { ...activeProvider.credentials, baseUrl: value.replace('/chat/completions', '') };
                break;
            case 'apiKey':
                updates.credentials = { ...activeProvider.credentials, apiKey: value };
                break;
            case 'model':
                updates.defaultModel = value;
                break;
            case 'maxTokens':
                updates.options = { ...activeProvider.options, maxTokens: value };
                break;
            case 'temperature':
                updates.options = { ...activeProvider.options, temperature: value };
                break;
            case 'autoExpandResults':
                this.config.global.autoExpandResults = value;
                this.saveConfig();
                return;
        }

        if (Object.keys(updates).length > 0) {
            this.updateProviderConfig(this.config.activeProvider, updates);
        }
    }

    // 验证API配置
    async validateConfig(providerId = null) {
        const targetProvider = providerId || this.config.activeProvider;

        if (!this.apiManager) {
            console.warn('API管理器未初始化');
            return false;
        }

        try {
            await this.apiManager.testConnection(targetProvider);
            return true;
        } catch (error) {
            console.error(`API配置验证失败 [${targetProvider}]:`, error);
            return false;
        }
    }

    // 获取所有可用的模型
    getAvailableModels(providerId = null) {
        const targetProvider = providerId || this.config.activeProvider;
        const providerConfig = this.config.providers[targetProvider];

        if (!providerConfig) return [];

        // 从API管理器获取模型列表
        if (this.apiManager) {
            const provider = this.apiManager.providers.get(targetProvider);
            if (provider && provider.models) {
                return Object.keys(provider.models);
            }
        }

        return [];
    }

    // 统一的API调用接口
    async callAPI(endpoint, payload, options = {}) {
        if (!this.apiManager) {
            throw new Error('API管理器未初始化');
        }

        const providerId = options.provider || this.config.activeProvider;
        return await this.apiManager.callAPI(providerId, endpoint, payload, options);
    }

    // 重置为默认配置
    reset() {
        this.config = { ...this.defaultConfig };
        localStorage.removeItem(this.configKey);
        this.updateAPIManager();
    }

    // 导出配置
    exportConfig() {
        const exportData = {
            ...this.config,
            exportedAt: new Date().toISOString(),
            version: '1.0.0'
        };

        // 移除敏感信息
        Object.values(exportData.providers).forEach(provider => {
            if (provider.credentials) {
                provider.credentials = { ...provider.credentials, apiKey: '[REDACTED]' };
            }
        });

        return JSON.stringify(exportData, null, 2);
    }

    // 导入配置
    importConfig(configData) {
        try {
            const imported = JSON.parse(configData);

            // 验证配置格式
            if (!imported.providers) {
                throw new Error('无效的配置格式');
            }

            // 合并配置（保留现有的API密钥）
            Object.keys(imported.providers).forEach(providerId => {
                if (this.config.providers[providerId] && imported.providers[providerId].credentials.apiKey === '[REDACTED]') {
                    imported.providers[providerId].credentials.apiKey = this.config.providers[providerId].credentials.apiKey;
                }
            });

            this.saveConfig(imported);
            console.log('✅ 配置导入成功');
            return true;
        } catch (error) {
            console.error('❌ 配置导入失败:', error);
            return false;
        }
    }

    // 获取统计信息
    getStats() {
        if (!this.apiManager) return {};

        const stats = {};
        Object.keys(this.config.providers).forEach(providerId => {
            stats[providerId] = this.apiManager.getStats(providerId);
        });

        return stats;
    }
}

// 创建全局实例
if (typeof window !== 'undefined') {
    window.advancedAPIConfig = new AdvancedAPIConfig();

    // 为了向后兼容，也暴露为原来的名称
    window.appConfig = window.advancedAPIConfig;
}

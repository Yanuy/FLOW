// 配置管理模块
class Config {
    constructor() {
        this.defaultConfig = {
            url: 'https://api.chatanywhere.tech/v1/chat/completions',
            apiKey: 'sk-qJv60VOOREcVfbwnCvF49vaNgA4cSF91BEu8BESa7DCPptFq',
            model: 'gpt-5-mini',
            maxTokens: 1000000,
            temperature: 0.7,
            autoExpandResults: false // 默认关闭自动展开执行结果
        };

        this.config = this.loadConfig();

        // 预设工作流模板
        this.presetWorkflows = {
            'ai-agent-basic': {
                name: 'AI智能代理 - 基础版',
                description: '一个基础的AI代理工作流，包含用户输入、AI处理和结果输出',
                nodes: [
                    {
                        type: 'text-input',
                        x: 100,
                        y: 100,
                        config: {
                            text: '请输入您的问题',
                            multiline: true
                        }
                    },
                    {
                        type: 'ai-chat',
                        x: 350,
                        y: 100,
                        config: {
                            prompt: '你是一个专业的AI助手，请根据用户输入提供有用的建议和回答。',
                            model: 'gpt-4.1-mini',
                            temperature: 0.7,
                            maxTokens: 1024
                        }
                    },
                    {
                        type: 'file-output',
                        x: 600,
                        y: 100,
                        config: {
                            filename: 'ai_response.txt',
                            format: 'text'
                        }
                    }
                ],
                connections: [
                    { from: 0, fromOutput: 'text', to: 1, toInput: 'prompt' },
                    { from: 1, fromOutput: 'response', to: 2, toInput: 'content' }
                ]
            },
            'text-analysis-pipeline': {
                name: '文本分析流水线',
                description: '分析输入文本的情感、关键词和摘要',
                nodes: [
                    {
                        type: 'text-input',
                        x: 50,
                        y: 150,
                        config: {
                            text: '请输入要分析的文本内容',
                            multiline: true
                        }
                    },
                    {
                        type: 'ai-text-analysis',
                        x: 300,
                        y: 50,
                        config: {
                            prompt: '请分析以下文本的情感倾向（积极/消极/中性）：',
                            analysisType: 'sentiment',
                            temperature: 0.3
                        }
                    },
                    {
                        type: 'ai-text-analysis',
                        x: 300,
                        y: 150,
                        config: {
                            prompt: '请提取以下文本的关键词（最多10个）：',
                            analysisType: 'keywords',
                            temperature: 0.3
                        }
                    },
                    {
                        type: 'ai-text-analysis',
                        x: 300,
                        y: 250,
                        config: {
                            prompt: '请为以下文本生成简洁的摘要：',
                            analysisType: 'summary',
                            temperature: 0.5
                        }
                    },
                    {
                        type: 'file-output',
                        x: 550,
                        y: 150,
                        config: {
                            filename: 'text_analysis_report.txt',
                            format: 'text'
                        }
                    }
                ],
                connections: [
                    { from: 0, fromOutput: 'text', to: 1, toInput: 'text' },
                    { from: 0, fromOutput: 'text', to: 2, toInput: 'text' },
                    { from: 0, fromOutput: 'text', to: 3, toInput: 'text' },
                    { from: 1, fromOutput: 'analysis', to: 4, toInput: 'content' },
                    { from: 2, fromOutput: 'analysis', to: 4, toInput: 'content' },
                    { from: 3, fromOutput: 'analysis', to: 4, toInput: 'content' }
                ]
            },
            'content-generation-studio': {
                name: '内容创作工作室',
                description: '多类型内容生成，包括文章、社交媒体内容和营销文案',
                nodes: [
                    {
                        type: 'text-input',
                        x: 50,
                        y: 100,
                        config: {
                            text: '请输入内容主题或关键词',
                            multiline: false
                        }
                    },
                    {
                        type: 'ai-text-generation',
                        x: 300,
                        y: 50,
                        config: {
                            prompt: '请围绕以下主题写一篇专业的文章（800字左右）：',
                            temperature: 0.8,
                            maxTokens: 1200
                        }
                    },
                    {
                        type: 'ai-text-generation',
                        x: 300,
                        y: 150,
                        config: {
                            prompt: '请为以下主题创作吸引人的社交媒体内容（包含标签）：',
                            temperature: 0.9,
                            maxTokens: 300
                        }
                    },
                    {
                        type: 'ai-text-generation',
                        x: 300,
                        y: 250,
                        config: {
                            prompt: '请为以下主题创作营销推广文案：',
                            temperature: 0.8,
                            maxTokens: 500
                        }
                    }
                ],
                connections: [
                    { from: 0, fromOutput: 'text', to: 1, toInput: 'topic' },
                    { from: 0, fromOutput: 'text', to: 2, toInput: 'topic' },
                    { from: 0, fromOutput: 'text', to: 3, toInput: 'topic' }
                ]
            },
        };
    }

    // 从本地存储加载配置
    loadConfig() {
        try {
            const saved = localStorage.getItem('ai-workflow-config');
            if (saved) {
                return { ...this.defaultConfig, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('加载配置失败:', error);
        }
        return { ...this.defaultConfig };
    }

    // 保存配置到本地存储
    saveConfig(config) {
        try {
            this.config = { ...this.config, ...config };
            localStorage.setItem('ai-workflow-config', JSON.stringify(this.config));
            return true;
        } catch (error) {
            console.error('保存配置失败:', error);
            return false;
        }
    }

    // 获取配置
    getConfig() {
        return { ...this.config };
    }

    // 获取特定配置项
    get(key) {
        return this.config[key];
    }

    // 设置特定配置项
    set(key, value) {
        this.config[key] = value;
        this.saveConfig({});
    }

    // 重置为默认配置
    reset() {
        this.config = { ...this.defaultConfig };
        localStorage.removeItem('ai-workflow-config');
    }

    // 获取预设工作流列表
    getPresetWorkflows() {
        return Object.keys(this.presetWorkflows).map(key => ({
            id: key,
            ...this.presetWorkflows[key]
        }));
    }

    // 获取特定预设工作流
    getPresetWorkflow(id) {
        return this.presetWorkflows[id] || null;
    }

    // 验证API配置
    async validateConfig(config = null) {
        const testConfig = config || this.config;

        try {
            const response = await fetch(testConfig.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${testConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: testConfig.model,
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 1
                })
            });

            return response.ok;
        } catch (error) {
            console.error('验证API配置失败:', error);
            return false;
        }
    }
}

// 创建全局配置实例
window.appConfig = new Config();
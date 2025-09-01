// 智能体管理器 - 核心架构示例
class AgentManager {
    constructor() {
        this.agents = new Map();
        this.conversations = new Map();
        this.messageQueue = [];
        this.isProcessing = false;

        // Agent通信总线
        this.messageBus = new EventTarget();

        this.initializeDefaultAgents();
    }

    // 初始化默认Agent
    initializeDefaultAgents() {
        // 创建默认聊天Agent
        this.createAgent('default-chat', 'chat', {
            name: '默认助手',
            prompt: '你是一个有用的AI助手。',
            model: 'gpt-3.5-turbo',
            streaming: true
        });
    }

    // 创建Agent
    createAgent(agentId, type, config = {}) {
        let agent;

        switch (type) {
            case 'chat':
                agent = new ChatAgent(agentId, config);
                break;
            case 'tool':
                agent = new ToolAgent(agentId, config);
                break;
            case 'workflow':
                agent = new WorkflowAgent(agentId, config);
                break;
            default:
                throw new Error(`未知Agent类型: ${type}`);
        }

        this.agents.set(agentId, agent);

        // 监听Agent消息
        agent.onMessage((message) => {
            this.handleAgentMessage(agentId, message);
        });

        return agent;
    }

    // 处理Agent消息
    handleAgentMessage(agentId, message) {
        this.messageBus.dispatchEvent(new CustomEvent('agentMessage', {
            detail: { agentId, message }
        }));

        // 如果消息指定了目标Agent，转发消息
        if (message.targetAgent) {
            this.sendMessageToAgent(message.targetAgent, {
                ...message,
                sourceAgent: agentId
            });
        }
    }

    // 发送消息给Agent
    async sendMessageToAgent(agentId, message) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent不存在: ${agentId}`);
        }

        return await agent.processMessage(message);
    }

    // 创建对话会话
    createConversation(conversationId, participants = []) {
        const conversation = {
            id: conversationId,
            participants, // Agent IDs
            messages: [],
            startTime: Date.now(),
            status: 'active'
        };

        this.conversations.set(conversationId, conversation);
        return conversation;
    }

    // 监听Agent事件
    onAgentEvent(eventType, handler) {
        this.messageBus.addEventListener(eventType, handler);
    }
}

// 聊天Agent基类
class ChatAgent {
    constructor(id, config = {}) {
        this.id = id;
        this.name = config.name || `Agent-${id}`;
        this.type = 'chat';
        this.config = {
            prompt: config.prompt || '',
            model: config.model || 'gpt-3.5-turbo',
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 1024,
            streaming: config.streaming !== false,
            ...config
        };

        this.conversationHistory = [];
        this.messageHandlers = [];
        this.isProcessing = false;
    }

    // 处理消息
    async processMessage(message) {
        if (this.isProcessing) {
            throw new Error('Agent正在处理其他消息');
        }

        this.isProcessing = true;

        try {
            // 添加到对话历史
            this.conversationHistory.push({
                role: 'user',
                content: message.content,
                timestamp: Date.now(),
                messageId: message.id
            });

            // 调用AI API
            const response = await this.callAI(message);

            // 添加AI回复到历史
            const agentMessage = {
                id: Utils.generateId('msg_'),
                role: 'assistant',
                content: response.content,
                timestamp: Date.now(),
                agentId: this.id,
                sourceMessage: message.id
            };

            this.conversationHistory.push(agentMessage);

            // 触发消息处理器
            this.messageHandlers.forEach(handler => {
                handler(agentMessage);
            });

            return agentMessage;

        } finally {
            this.isProcessing = false;
        }
    }

    // 调用AI API
    async callAI(message) {
        const config = window.appConfig.getConfig();

        const requestBody = {
            model: this.config.model,
            messages: [
                { role: 'system', content: this.config.prompt },
                ...this.conversationHistory.slice(-10), // 保留最近10轮对话
                { role: 'user', content: message.content }
            ],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            stream: this.config.streaming
        };

        if (this.config.streaming) {
            return await this.handleStreamingResponse(config, requestBody);
        } else {
            return await this.handleNormalResponse(config, requestBody);
        }
    }

    // 处理流式响应
    async handleStreamingResponse(config, requestBody) {
        // 实现SSE流式响应处理
        // 这里需要与具体的API提供商集成
        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        // 简化处理，实际需要处理SSE流
        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            usage: data.usage
        };
    }

    // 处理普通响应
    async handleNormalResponse(config, requestBody) {
        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({ ...requestBody, stream: false })
        });

        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            usage: data.usage
        };
    }

    // 注册消息处理器
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }

    // 清空对话历史
    clearHistory() {
        this.conversationHistory = [];
    }

    // 导出对话历史
    exportHistory() {
        return {
            agentId: this.id,
            agentName: this.name,
            messages: this.conversationHistory,
            exportTime: Date.now()
        };
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.AgentManager = AgentManager;
    window.ChatAgent = ChatAgent;
}

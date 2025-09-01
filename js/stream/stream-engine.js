// 流处理引擎 - 核心架构示例
class StreamEngine {
    constructor() {
        this.streams = new Map(); // 活动流管理
        this.streamNodes = new Map(); // 流节点管理
        this.protocols = new Map(); // 流协议注册
        this.isRunning = false;

        // 流事件总线
        this.eventBus = new EventTarget();

        this.initializeProtocols();
    }

    // 初始化流协议
    initializeProtocols() {
        // 注册基础流协议
        this.registerProtocol('audio', {
            mimeType: 'audio/webm',
            sampleRate: 44100,
            channels: 1,
            chunkSize: 4096
        });

        this.registerProtocol('text', {
            encoding: 'utf-8',
            delimiter: '\n',
            bufferSize: 1024
        });

        this.registerProtocol('data', {
            format: 'json',
            compression: false,
            batchSize: 100
        });
    }

    // 创建流
    createStream(streamId, type, config = {}) {
        const protocol = this.protocols.get(type);
        if (!protocol) {
            throw new Error(`未知流类型: ${type}`);
        }

        const stream = {
            id: streamId,
            type,
            config: { ...protocol, ...config },
            state: 'idle',
            source: null,
            destination: [],
            buffer: [],
            startTime: null,
            metadata: {}
        };

        this.streams.set(streamId, stream);
        return stream;
    }

    // 连接流节点
    connectStreamNodes(sourceNodeId, outputName, targetNodeId, inputName) {
        // 实现流节点间的连接逻辑
        // 这里需要与现有的 WorkflowManager 集成
        console.log(`连接流: ${sourceNodeId}.${outputName} -> ${targetNodeId}.${inputName}`);
    }

    // 启动流处理
    async startStream(streamId) {
        const stream = this.streams.get(streamId);
        if (!stream) throw new Error(`流不存在: ${streamId}`);

        stream.state = 'running';
        stream.startTime = Date.now();

        this.eventBus.dispatchEvent(new CustomEvent('streamStarted', {
            detail: { streamId, stream }
        }));
    }

    // 停止流处理
    async stopStream(streamId) {
        const stream = this.streams.get(streamId);
        if (!stream) return;

        stream.state = 'stopped';
        this.eventBus.dispatchEvent(new CustomEvent('streamStopped', {
            detail: { streamId, stream }
        }));
    }

    // 注册流协议
    registerProtocol(type, config) {
        this.protocols.set(type, config);
    }

    // 监听流事件
    onStreamEvent(eventType, handler) {
        this.eventBus.addEventListener(eventType, handler);
    }
}

// 流节点基类
class StreamNode extends WorkflowNode {
    constructor(id, type, config = {}) {
        super(id, type, config);
        this.streamType = config.streamType || 'text';
        this.isStreamNode = true;
        this.streamState = 'idle';
        this.streamConnections = new Map();
    }

    // 处理流数据
    async processStreamData(data, metadata = {}) {
        // 子类需要实现具体的流处理逻辑
        throw new Error('子类必须实现 processStreamData 方法');
    }

    // 发送流数据到下游节点
    async sendStreamData(outputName, data, metadata = {}) {
        const connections = this.streamConnections.get(outputName);
        if (connections) {
            for (const connection of connections) {
                const targetNode = window.workflowManager.nodes.get(connection.targetNodeId);
                if (targetNode && targetNode.isStreamNode) {
                    await targetNode.receiveStreamData(connection.inputName, data, metadata);
                }
            }
        }
    }

    // 接收流数据
    async receiveStreamData(inputName, data, metadata = {}) {
        await this.processStreamData(data, { inputName, ...metadata });
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.StreamEngine = StreamEngine;
    window.StreamNode = StreamNode;
}

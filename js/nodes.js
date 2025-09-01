// 节点系统模块
class WorkflowNode {
    constructor(type, data = {}) {
        this.type = type;
        this.id = this.generateNodeId(type, data.id);
        this.x = data.x || 100;
        this.y = data.y || 100;

        // 使用配置中的默认大小，如果没有配置则使用默认值
        const config = window.appConfig ? window.appConfig.getConfig() : {};
        this.width = data.width || config.nodeDefaultWidth || 180;
        this.height = data.height || config.nodeDefaultHeight || 80;

        this.selected = false;
        this.status = 'idle'; // idle, running, success, error
        this.inputs = {};
        this.outputs = {};
        this.config = { ...this.getDefaultConfig(), ...data.config };
        this.element = null;
        this.connections = {
            inputs: new Map(),  // input_name -> { from_node, from_output }
            outputs: new Map()  // output_name -> [{ to_node, to_input }]
        };

        this.createNodeElement();
    }

    // 生成节点ID
    generateNodeId(type, existingId = null) {
        if (existingId) {
            return existingId; // 如果已有ID（导入时），保持不变
        }

        // 获取工作区ID（默认为1）
        const workspaceId = window.workflowManager?.currentWorkspaceId || 1;

        // 获取节点类型的英文名称
        const typeMapping = {
            'ai-chat': 'AIChat',
            'ai-text-generation': 'AITextGen',
            'ai-text-analysis': 'AITextAnalysis',
            'ai-image-generation': 'AIImageGen',
            'ai-image-edit': 'AIImageEdit',
            'ai-image-variation': 'AIImageVar',
            'ai-audio-transcription': 'AIAudioTranscribe',
            'ai-text-to-speech': 'AITextToSpeech',
            'file-input': 'FileInput',
            'file-output': 'FileOutput',
            'text-input': 'TextInput',
            'optional-input': 'OptionalInput',
            'condition': 'Condition',
            'loop': 'Loop',
            'delay': 'Delay',
            'http-request': 'HttpRequest',
            'json-parser': 'JsonParser',
            'text-transform': 'TextTransform',
            'text-splitter': 'TextSplitter',
            'javascript-code': 'JS',
            'python-code': 'PY',
            'ai-chat-window': 'AIChat',
            'code-editor': 'CodeEditor',
            'url-loader': 'URLLoader',
            'file-upload': 'FileUpload',
            'storage-reader': 'StorageReader',
            // MCP服务节点
            'mcp-client': 'MCPClient',
            'mcp-tool': 'MCPTool',
            'mcp-resource': 'MCPResource',
            // API服务节点
            'rest-api': 'RestAPI',
            'graphql-api': 'GraphQL',
            'webhook': 'Webhook',
            'websocket': 'WebSocket',
            // IoT设备节点
            'mqtt-client': 'MQTT',
            'modbus-client': 'Modbus',
            'opcua-client': 'OPCUA',
            'serial-device': 'Serial',
            'tcp-device': 'TCP',
            // 工业协议节点
            'plc-siemens': 'PLCSiemens',
            'plc-mitsubishi': 'PLCMitsubishi',
            'scada-interface': 'SCADA',
            // 浏览器节点
            'web-browser': 'Browser'
        };

        const typeName = typeMapping[type] || 'Node';

        // 计算同类型节点的数量
        let sameTypeCount = 1;
        if (window.workflowManager && window.workflowManager.nodes) {
            const sameTypeNodes = Array.from(window.workflowManager.nodes.values())
                .filter(n => n.type === type);
            sameTypeCount = sameTypeNodes.length + 1;
        }

        return `WS${workspaceId}_${typeName}${sameTypeCount}`;
    }

    // 获取节点默认配置
    getDefaultConfig() {
        const configs = {
            'ai-chat': {
                prompt: '你是一个有用的AI助手。',
                model: '',
                temperature: 0.7,
                maxTokens: 2048
            },
            'ai-text-generation': {
                prompt: '请生成关于以下主题的文本：',
                topic: '',
                model: '',
                temperature: 0.8,
                maxTokens: 1024
            },
            'ai-text-analysis': {
                prompt: '请分析以下文本：',
                text: '',
                analysisType: 'sentiment',
                model: '',
                temperature: 0.3
            },
            'ai-image-generation': {
                prompt: '一只可爱的猫咪坐在花园里',
                model: 'dall-e-3',
                size: '1024x1024',
                quality: 'standard',
                count: 1
            },
            'ai-image-edit': {
                prompt: '将背景改为夕阳海滩',
                model: 'dall-e-2',
                size: '1024x1024'
            },
            'ai-image-variation': {
                model: 'dall-e-2',
                size: '1024x1024',
                count: 2
            },
            'ai-audio-transcription': {
                model: 'whisper-1',
                language: 'auto',
                prompt: ''
            },
            'ai-text-to-speech': {
                model: 'tts-1',
                voice: 'alloy',
                speed: 1.0
            },
            'file-input': {
                fileType: 'text',
                encoding: 'utf-8'
            },
            'file-output': {
                filename: 'output.txt',
                format: 'text'
            },
            'text-input': {
                text: '',
                multiline: false
            },
            'optional-input': {
                text: '默认输入内容',
                timeout: 20,
                multiline: false
            },
            'condition': {
                condition: '',
                operator: 'equals'
            },
            'loop': {
                maxIterations: 10,
                condition: ''
            },
            'delay': {
                duration: 1000
            },
            'http-request': {
                url: '',
                method: 'GET',
                headers: {},
                body: ''
            },
            'json-parser': {
                path: '',
                operation: 'extract'
            },
            'text-transform': {
                operation: 'lowercase',
                pattern: '',
                replacement: ''
            },
            'text-splitter': {
                chunkSize: 1000,
                chunkOverlap: 200,
                separator: '\n\n'
            },
            'javascript-code': {
                code: `// JavaScript 代码节点
function processInput(input) {
    // 在这里编写你的JavaScript代码
    console.log('输入数据:', input);

    // 处理输入数据
    const result = input ? input.toString().toUpperCase() : 'Hello World';

    return result;
}

// 如果有输入数据，处理它；否则返回默认值
if (typeof input !== 'undefined') {
    return processInput(input);
} else {
    return processInput('默认输入');
}`,
                autoRun: true,
                timeout: 5000
            },
            'python-code': {
                code: `# Python 代码节点
def process_input(input_data):
    """处理输入数据的函数"""
    print(f'输入数据: {input_data}')

    # 在这里编写你的Python代码
    if input_data:
        result = str(input_data).upper()
    else:
        result = 'Hello World'

    return result

# 如果有输入数据，处理它；否则返回默认值
if 'input' in globals():
    output = process_input(input)
else:
    output = process_input('默认输入')

print(f'输出结果: {output}')`,
                autoRun: true,
                timeout: 5000
            }
        };

        return configs[this.type] || {};
    }

    // 获取节点信息
    getNodeInfo() {
        const nodeInfo = {
            'ai-chat': {
                title: 'AI对话',
                icon: 'fas fa-comments',
                description: '与AI进行对话交互',
                inputs: ['prompt'],
                outputs: ['response']
            },
            'ai-text-generation': {
                title: '文本生成',
                icon: 'fas fa-pen-fancy',
                description: '使用AI生成文本内容',
                inputs: ['topic'],
                outputs: ['text']
            },
            'ai-text-analysis': {
                title: '文本分析',
                icon: 'fas fa-search',
                description: '使用AI分析文本内容',
                inputs: ['text'],
                outputs: ['analysis']
            },
            'ai-image-generation': {
                title: 'AI图像生成',
                icon: 'fas fa-image',
                description: '使用AI生成图像',
                inputs: ['prompt'],
                outputs: ['images', 'prompt']
            },
            'ai-image-edit': {
                title: 'AI图像编辑',
                icon: 'fas fa-paint-brush',
                description: '使用AI编辑图像',
                inputs: ['image', 'mask', 'prompt'],
                outputs: ['images', 'prompt']
            },
            'ai-image-variation': {
                title: 'AI图像变体',
                icon: 'fas fa-clone',
                description: '生成图像的AI变体',
                inputs: ['image'],
                outputs: ['images']
            },
            'ai-audio-transcription': {
                title: 'AI音频转录',
                icon: 'fas fa-microphone',
                description: '将音频转换为文本',
                inputs: ['audio', 'prompt'],
                outputs: ['text', 'language']
            },
            'ai-text-to-speech': {
                title: 'AI文本转语音',
                icon: 'fas fa-volume-up',
                description: '将文本转换为语音',
                inputs: ['text'],
                outputs: ['audio', 'text']
            },
            'file-input': {
                title: '文件输入',
                icon: 'fas fa-file-import',
                description: '读取文件内容',
                inputs: [],
                outputs: ['content', 'filename']
            },
            'file-output': {
                title: '文件输出',
                icon: 'fas fa-file-export',
                description: '保存内容到文件',
                inputs: ['content'],
                outputs: []
            },
            'text-input': {
                title: '文本输入',
                icon: 'fas fa-keyboard',
                description: '手动输入文本',
                inputs: ['input'],
                outputs: ['text']
            },
            'optional-input': {
                title: '可选输入',
                icon: 'fas fa-edit',
                description: '可选的即时输入，支持超时跳过',
                inputs: [],
                outputs: ['text']
            },
            'condition': {
                title: '条件判断',
                icon: 'fas fa-question-circle',
                description: '根据条件分支执行',
                inputs: ['input'],
                outputs: ['true', 'false']
            },
            'loop': {
                title: '循环',
                icon: 'fas fa-redo',
                description: '重复执行操作',
                inputs: ['input'],
                outputs: ['output']
            },
            'delay': {
                title: '延时',
                icon: 'fas fa-clock',
                description: '延时等待',
                inputs: ['input'],
                outputs: ['output']
            },
            'http-request': {
                title: 'HTTP请求',
                icon: 'fas fa-globe',
                description: '发送HTTP请求',
                inputs: ['url', 'data'],
                outputs: ['response']
            },
            'json-parser': {
                title: 'JSON解析',
                icon: 'fas fa-code',
                description: '解析JSON数据',
                inputs: ['json'],
                outputs: ['data']
            },
            'text-transform': {
                title: '文本转换',
                icon: 'fas fa-magic',
                description: '转换文本格式',
                inputs: ['text'],
                outputs: ['transformed']
            },
            'text-splitter': {
                title: '文本分割',
                icon: 'fas fa-cut',
                description: '将长文本分割为小块',
                inputs: ['text'],
                outputs: ['chunks']
            },
            'javascript-code': {
                title: 'JavaScript代码',
                icon: 'fab fa-js-square',
                description: '执行JavaScript代码',
                inputs: ['input'],
                outputs: ['output']
            },
            'python-code': {
                title: 'Python代码',
                icon: 'fab fa-python',
                description: '执行Python代码',
                inputs: ['input'],
                outputs: ['output']
            }
        };

        return nodeInfo[this.type] || {
            title: this.type,
            icon: 'fas fa-cog',
            description: '未知节点类型',
            inputs: ['input'],
            outputs: ['output']
        };
    }

    // 创建节点DOM元素
    createNodeElement() {
        const info = this.getNodeInfo();

        this.element = document.createElement('div');
        this.element.className = 'workflow-node';
        this.element.setAttribute('data-node-id', this.id);
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';

        this.element.innerHTML = `
            <div class="node-header">
                <i class="node-icon ${info.icon}"></i>
                <span class="node-title">${this.config.displayName || info.title}</span>
                <div class="node-status"></div>
            </div>
            <div class="node-content">
                ${this.getNodeContentHTML()}
            </div>
            <div class="node-execution-result" id="executionResult-${this.id}" style="display: none;">
                <div class="result-header">
                    <span class="result-title">执行结果</span>
                    <button class="result-toggle" onclick="this.parentElement.parentElement.classList.toggle('collapsed')">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                </div>
                <div class="result-content">
                    <div class="result-section">
                        <h6>输入:</h6>
                        <div class="result-inputs" id="resultInputs-${this.id}"></div>
                    </div>
                    <div class="result-section">
                        <h6>输出:</h6>
                        <div class="result-outputs" id="resultOutputs-${this.id}"></div>
                    </div>
                </div>
            </div>
        `;

        // 添加连接点
        this.addConnectionPoints(info);

        // 绑定事件
        this.bindEvents();

        return this.element;
    }

    // 获取节点内容HTML
    getNodeContentHTML() {
        switch (this.type) {
            case 'ai-chat':
                return `<div>对话模型: ${this.config.model || '默认'}</div>`;
            case 'ai-text-generation':
                return `<div>主题: ${this.config.topic ? this.config.topic.substring(0, 15) + (this.config.topic.length > 15 ? '...' : '') : '未设置'}</div>`;
            case 'ai-text-analysis':
                return `<div>分析类型: ${this.config.analysisType}</div>`;
            case 'ai-image-generation':
                // 如果有图像输出，则不显示配置信息，只显示图像
                if (this.outputs.images && Array.isArray(this.outputs.images) && this.outputs.images.length > 0) {
                    return '';
                }
                return `<div>图像模型: ${this.config.model || 'DALL-E 3'}</div><div>图像尺寸: ${(this.config.size || '1024x1024').replace('x', '×')}</div>`;
            case 'ai-image-edit':
                if (this.outputs.images && Array.isArray(this.outputs.images) && this.outputs.images.length > 0) {
                    return '';
                }
                return `<div>编辑模型: ${this.config.model || 'DALL-E 2'}</div><div>尺寸: ${(this.config.size || '1024x1024').replace('x', '×')}</div>`;
            case 'ai-image-variation':
                if (this.outputs.images && Array.isArray(this.outputs.images) && this.outputs.images.length > 0) {
                    return '';
                }
                return `<div>变体模型: ${this.config.model || 'DALL-E 2'}</div><div>数量: ${this.config.count || 2}</div>`;
            case 'ai-audio-transcription':
                return `<div>转录模型: ${this.config.model || 'whisper-1'}</div><div>语言: ${this.config.language || 'auto'}</div>`;
            case 'ai-text-to-speech':
                return `<div>语音模型: ${this.config.model || 'tts-1'}</div><div>声音: ${this.config.voice || 'alloy'}</div>`;
            case 'file-input':
                return `文件类型: ${this.config.fileType}`;
            case 'file-output':
                return `输出文件: ${this.config.filename}`;
            case 'text-input':
                return this.config.text ? `文本: ${this.config.text.substring(0, 20)}...` : '空文本';
            case 'optional-input':
                return `可选输入 (${this.config.timeout}s): ${this.config.text.substring(0, 15)}...`;
            case 'condition':
                return `条件: ${this.config.operator}`;
            case 'loop':
                return `最大循环: ${this.config.maxIterations}`;
            case 'delay':
                return `延时: ${this.config.duration}ms`;
            case 'http-request':
                return `${this.config.method}: ${this.config.url}`;
            case 'json-parser':
                return `路径: ${this.config.path}`;
            case 'text-transform':
                return `操作: ${this.config.operation}`;
            case 'text-splitter':
                return `块大小: ${this.config.chunkSize}`;
            default:
                return '配置节点属性';
        }
    }

    // 更新AI节点的输出显示
    updateAIDisplay(outputKey, content) {
        if (!this.element) return;

        const outputDiv = this.element.querySelector('.ai-output');
        if (outputDiv) {
            outputDiv.textContent = content || '';
            outputDiv.style.display = content ? 'block' : 'none';

            // 如果文本过长，显示前100个字符
            if (content && content.length > 100) {
                outputDiv.textContent = content.substring(0, 100) + '...';
                outputDiv.title = content; // 完整内容显示在tooltip中
            }
        }

        // 同时输出到控制台用于调试
        if (content) {
            console.log(`[${this.getNodeInfo().title}] 输出:`, content);
        }
    }

    // 更新图像显示
    updateImageDisplay(outputKey, images) {
        if (!this.element || !images || !Array.isArray(images)) return;

        // 更新节点内容以隐藏配置信息
        this.updateContent();

        let outputDiv = this.element.querySelector('.ai-output');
        if (!outputDiv) {
            outputDiv = document.createElement('div');
            outputDiv.className = 'ai-output';
            this.element.querySelector('.node-content').appendChild(outputDiv);
        }

        outputDiv.innerHTML = '';
        outputDiv.style.display = 'block';

        // 创建图像容器
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-output-container';
        imageContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            max-width: 200px;
            margin: 5px 0;
        `;

        images.forEach((imageData, index) => {
            const imgWrapper = document.createElement('div');
            imgWrapper.style.cssText = `
                position: relative;
                width: 60px;
                height: 60px;
                border: 1px solid #ddd;
                border-radius: 4px;
                overflow: hidden;
                cursor: pointer;
                flex-shrink: 0;
            `;

            const img = document.createElement('img');

            // 处理不同的图像数据格式
            let imageSrc = '';
            if (imageData.localUrl) {
                // 已下载的图像使用本地URL
                imageSrc = imageData.localUrl;
            } else if (imageData.url) {
                // 使用原始URL
                imageSrc = imageData.url;
            } else if (imageData.sourceUrl) {
                // 使用源URL（兼容引用格式）
                imageSrc = imageData.sourceUrl;
            } else if (imageData.b64_json) {
                // Base64格式
                imageSrc = `data:image/png;base64,${imageData.b64_json}`;
            } else if (imageData.originalData && imageData.originalData.url) {
                // 从原始数据获取URL
                imageSrc = imageData.originalData.url;
            }

            img.src = imageSrc;
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            `;
            img.title = `图像 ${index + 1} - ${imageData.status || 'loaded'} - 点击查看大图`;

            // 添加加载错误处理
            img.onerror = () => {
                img.style.backgroundColor = '#f8f9fa';
                img.alt = '图像加载失败';
                console.warn(`[节点显示] 图像加载失败:`, imageData);
            };

            // 点击查看大图
            img.onclick = () => this.showImageModal(imageSrc);

            imgWrapper.appendChild(img);
            imageContainer.appendChild(imgWrapper);
        });

        outputDiv.appendChild(imageContainer);

        // 自动调整节点高度
        this.adjustNodeHeight();
    }

    // 更新音频显示
    updateAudioDisplay(outputKey, audioData) {
        if (!this.element || !audioData) return;

        let outputDiv = this.element.querySelector('.ai-output');
        if (!outputDiv) {
            outputDiv = document.createElement('div');
            outputDiv.className = 'ai-output';
            this.element.querySelector('.node-content').appendChild(outputDiv);
        }

        outputDiv.innerHTML = '';
        outputDiv.style.display = 'block';

        // 创建音频控件
        const audioContainer = document.createElement('div');
        audioContainer.className = 'audio-output-container';
        audioContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 5px;
            max-width: 180px;
        `;

        const audio = document.createElement('audio');
        audio.controls = true;
        audio.style.cssText = `
            width: 100%;
            height: 30px;
        `;

        // 设置音频源
        if (audioData instanceof Blob) {
            audio.src = URL.createObjectURL(audioData);
        } else if (typeof audioData === 'string') {
            audio.src = audioData;
        }

        audioContainer.appendChild(audio);

        // 添加下载按钮
        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = '下载';
        downloadBtn.style.cssText = `
            padding: 2px 8px;
            font-size: 10px;
            border: 1px solid #ddd;
            background: #f9f9f9;
            cursor: pointer;
            border-radius: 3px;
        `;
        downloadBtn.onclick = () => this.downloadAudio(audioData);

        audioContainer.appendChild(downloadBtn);
        outputDiv.appendChild(audioContainer);

        console.log(`[${this.getNodeInfo().title}] 生成音频`);
    }

    // 显示图像模态框
    showImageModal(imageSrc) {
        // 创建模态框
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            cursor: pointer;
        `;

        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
        `;

        modal.appendChild(img);
        document.body.appendChild(modal);

        // 点击关闭
        modal.onclick = () => document.body.removeChild(modal);

        // ESC键关闭
        const closeHandler = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', closeHandler);
            }
        };
        document.addEventListener('keydown', closeHandler);
    }

    // 下载音频
    downloadAudio(audioData) {
        try {
            let url;
            let filename = `audio_${Date.now()}.mp3`;

            if (audioData instanceof Blob) {
                url = URL.createObjectURL(audioData);
            } else if (typeof audioData === 'string') {
                url = audioData;
            } else {
                console.error('不支持的音频数据格式');
                return;
            }

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (audioData instanceof Blob) {
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('下载音频失败:', error);
        }
    }

    // 添加连接点
    addConnectionPoints(info) {
        // 兼容 info.inputs/outputs 为对象或数组
        let inputNames = Array.isArray(info.inputs) ? info.inputs : Object.keys(info.inputs || {});
        let outputNames = Array.isArray(info.outputs) ? info.outputs : Object.keys(info.outputs || {});

        // 输入连接点
        inputNames.forEach((inputName, index) => {
            const inputPoint = document.createElement('div');
            inputPoint.className = 'connection-point input';
            inputPoint.setAttribute('data-input', inputName);
            inputPoint.title = inputName;
            inputPoint.style.top = `${30 + index * 25}px`;
            this.element.appendChild(inputPoint);
        });

        // 输出连接点
        outputNames.forEach((outputName, index) => {
            const outputPoint = document.createElement('div');
            outputPoint.className = 'connection-point output';
            outputPoint.setAttribute('data-output', outputName);
            outputPoint.title = outputName;
            outputPoint.style.top = `${30 + index * 25}px`;
            this.element.appendChild(outputPoint);
        });
    }

    // 绑定事件
    bindEvents() {
        // 节点拖拽
        this.element.addEventListener('mousedown', this.onMouseDown.bind(this));

        // 节点选择
        this.element.addEventListener('click', this.onClick.bind(this));

        // 双击事件
        this.element.addEventListener('dblclick', this.onDoubleClick.bind(this));

        // 连接点事件
        this.element.querySelectorAll('.connection-point').forEach(point => {
            point.addEventListener('mousedown', this.onConnectionMouseDown.bind(this));
        });
    }

    // 鼠标按下事件
    onMouseDown(e) {
        if (e.target.classList.contains('connection-point')) {
            return; // 连接点事件单独处理
        }

        e.preventDefault();
        e.stopPropagation();

        // 选中节点
        window.workflowManager.selectNode(this.id);

        // 开始拖拽
        this.isDragging = true;
        this.dragStartX = e.clientX - this.x;
        this.dragStartY = e.clientY - this.y;

        // 记录开始位置
        this.lastX = this.x;
        this.lastY = this.y;

        // 启动位置监控器
        this.startPositionTracking();

        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
    }

    // 启动位置追踪
    startPositionTracking() {
        if (this.positionTracker) {
            clearInterval(this.positionTracker);
        }

        console.log(`[节点 ${this.id}] 开始位置追踪`);

        // 每16ms检查一次位置变化（约60fps）
        this.positionTracker = setInterval(() => {
            if (this.isDragging || this.hasRecentlyMoved()) {
                // 检查位置是否发生变化
                if (this.lastX !== this.x || this.lastY !== this.y) {
                    this.lastX = this.x;
                    this.lastY = this.y;
                    // 立即更新连接线
                    window.workflowManager.updateNodeConnections(this.id);
                    this.lastMoveTime = Date.now();
                }
            } else if (this.positionTracker && !this.isDragging) {
                // 如果不在拖动且没有最近移动，停止追踪
                console.log(`[节点 ${this.id}] 停止位置追踪 - 无活动`);
                this.stopPositionTracking();
            }
        }, 16);
    }

    // 检查是否最近有移动（考虑惯性）
    hasRecentlyMoved() {
        return this.lastMoveTime && (Date.now() - this.lastMoveTime) < 500; // 500ms内的移动
    }

    // 停止位置追踪
    stopPositionTracking() {
        if (this.positionTracker) {
            console.log(`[节点 ${this.id}] 停止位置追踪`);
            clearInterval(this.positionTracker);
            this.positionTracker = null;
        }
    }

    // 鼠标移动事件
    onMouseMove(e) {
        if (!this.isDragging) return;

        this.x = e.clientX - this.dragStartX;
        this.y = e.clientY - this.dragStartY;

        this.updatePosition();
        // 位置追踪器会自动检测并更新连接线，这里不需要手动调用
    }

    // 鼠标抬起事件
    onMouseUp(e) {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.onMouseMove.bind(this));
        document.removeEventListener('mouseup', this.onMouseUp.bind(this));

        // 记录最后移动时间，以便位置追踪器能处理惯性移动
        this.lastMoveTime = Date.now();

        // 立即更新一次连接线
        window.workflowManager.updateNodeConnections(this.id);

        // 位置追踪器会继续监控一段时间以处理可能的惯性移动
    }

    // 点击事件
    onClick(e) {
        e.stopPropagation();
        window.workflowManager.selectNode(this.id);
    }

    // 双击事件（子类可重写）
    onDoubleClick(e) {
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
        console.log('节点双击:', this.type, this.id);

        // 默认行为：显示节点配置
        if (window.workflowManager && window.workflowManager.showNodeConfig) {
            window.workflowManager.showNodeConfig(this.id);
        }
    }

    // 连接点鼠标按下事件
    onConnectionMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();

        const point = e.target;
        const isOutput = point.classList.contains('output');

        if (isOutput) {
            // 开始创建连接
            const outputName = point.getAttribute('data-output');
            window.workflowManager.startConnection(this.id, outputName, point);
        }
    }

    // 更新位置
    updatePosition() {
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
    }

    // 更新状态
    updateStatus(status) {
        this.status = status;
        const statusEl = this.element.querySelector('.node-status');
        statusEl.className = `node-status ${status}`;

        this.element.className = `workflow-node ${status}`;
        if (this.selected) {
            this.element.classList.add('selected');
        }
    }

    // 更新配置
    updateConfig(config) {
        console.log(`[节点 ${this.id}] 更新配置:`, config);
        console.log(`[节点 ${this.id}] 更新前配置:`, this.config);

        this.config = { ...this.config, ...config };

        console.log(`[节点 ${this.id}] 更新后配置:`, this.config);

        this.updateContent();
    }

    // 更新内容显示
    updateContent() {
        const contentEl = this.element.querySelector('.node-content');
        contentEl.innerHTML = this.getNodeContentHTML();

        // 更新节点标题
        const titleEl = this.element.querySelector('.node-title');
        if (titleEl) {
            const info = this.getNodeInfo();
            titleEl.textContent = this.config.displayName || info.title;
        }
    }

    // 选中节点
    select() {
        this.selected = true;
        this.element.classList.add('selected');
    }

    // 取消选中
    deselect() {
        this.selected = false;
        this.element.classList.remove('selected');
    }

    // 添加输入连接
    addInputConnection(inputName, fromNode, fromOutput) {
        this.connections.inputs.set(inputName, { fromNode, fromOutput });
    }

    // 移除输入连接
    removeInputConnection(inputName) {
        this.connections.inputs.delete(inputName);
    }

    // 添加输出连接
    addOutputConnection(outputName, toNode, toInput) {
        if (!this.connections.outputs.has(outputName)) {
            this.connections.outputs.set(outputName, []);
        }
        this.connections.outputs.get(outputName).push({ toNode, toInput });
    }

    // 移除输出连接
    removeOutputConnection(outputName, toNode, toInput) {
        if (this.connections.outputs.has(outputName)) {
            const connections = this.connections.outputs.get(outputName);
            const index = connections.findIndex(conn =>
                conn.toNode === toNode && conn.toInput === toInput
            );
            if (index !== -1) {
                connections.splice(index, 1);
            }
            if (connections.length === 0) {
                this.connections.outputs.delete(outputName);
            }
        }
    }

    // 获取输入值
    getInputValue(inputName) {
        // 检查变量映射配置
        const config = window.variableManager.getNodeVariableConfig(this.id);
        const mappedVariable = config.inputMappings[inputName];

        // 如果映射为"无输入"，返回undefined
        if (mappedVariable === '__NO_INPUT__') {
            return undefined;
        }

        // 优先使用已经解析的输入（来自弹窗或变量映射）
        if (this.inputs[inputName] !== undefined) {
            return this.inputs[inputName];
        }

        // 如果没有解析的输入，则从连接获取
        const connection = this.connections.inputs.get(inputName);
        if (connection) {
            const fromNode = window.workflowManager.getNode(connection.fromNode);
            return fromNode ? fromNode.outputs[connection.fromOutput] : undefined;
        }

        // 最后使用默认值
        return this.inputs[inputName];
    }

    // 获取解析后的所有输入
    getResolvedInputs() {
        const inputs = {};
        const inputDefs = this.getInputs ? this.getInputs() : {};

        Object.keys(inputDefs).forEach(inputName => {
            inputs[inputName] = this.getInputValue(inputName);
        });

        return inputs;
    }

    // 设置输出值
    setOutputValue(outputName, value) {
        this.outputs[outputName] = value;
    }

    // 执行节点
    async execute() {
        if (this.status === 'executing') {
            throw new Error('节点正在执行中');
        }

        this.updateStatus('executing');

        try {
            // 输入已经在execution.js中解析过了，这里直接使用
            // const resolvedInputs = await window.variableManager.resolveNodeInputs(this.id, this);
            // console.log(`[节点 ${this.id}] 解析后的输入:`, resolvedInputs);

            // 更新节点输入（使用execution.js中解析的结果）
            // Object.keys(resolvedInputs).forEach(inputName => {
            //     this.inputs[inputName] = resolvedInputs[inputName];
            // });

            // 执行节点逻辑
            const result = await this.processNode();

            // 保存输出到全局变量（这里会等待弹窗处理完成）
            const savedVariables = await window.variableManager.saveNodeOutputs(this.id, result);
            console.log(`[节点 ${this.id}] 保存到全局变量:`, savedVariables);

            // 构建显示用的输出数据（使用处理后的变量值）
            const displayOutputs = {};
            savedVariables.forEach(variable => {
                const globalVar = window.variableManager.getGlobalVariable(variable.name);
                if (globalVar) {
                    displayOutputs[variable.outputName] = globalVar.value;
                } else {
                    // 如果全局变量不存在，使用原始值
                    displayOutputs[variable.outputName] = variable.value;
                }
            });

            // 显示执行结果（使用处理后的数据）
            this.showExecutionResult(this.inputs, displayOutputs);

            this.updateStatus('success');
            return result;
        } catch (error) {
            console.error(`节点 ${this.id} 执行错误:`, error);
            this.updateStatus('error');

            // 显示错误结果
            this.showExecutionResult({}, {}, error);
            throw error;
        }
    }

    // 处理节点逻辑
    async processNode() {
        switch (this.type) {
            case 'ai-chat':
                return await this.processAIChat();
            case 'ai-text-generation':
                return await this.processAITextGeneration();
            case 'ai-text-analysis':
                return await this.processAITextAnalysis();
            case 'ai-image-generation':
                return await this.processAIImageGeneration();
            case 'ai-image-edit':
                return await this.processAIImageEdit();
            case 'ai-image-variation':
                return await this.processAIImageVariation();
            case 'ai-audio-transcription':
                return await this.processAIAudioTranscription();
            case 'ai-text-to-speech':
                return await this.processAITextToSpeech();
            case 'file-input':
                return await this.processFileInput();
            case 'file-output':
                return await this.processFileOutput();
            case 'text-input':
                return await this.processTextInput();
            case 'optional-input':
                return await this.processOptionalInput();
            case 'condition':
                return await this.processCondition();
            case 'loop':
                return await this.processLoop();
            case 'delay':
                return await this.processDelay();
            case 'http-request':
                return await this.processHttpRequest();
            case 'json-parser':
                return await this.processJsonParser();
            case 'text-transform':
                return await this.processTextTransform();
            case 'text-splitter':
                return await this.processTextSplitter();
            default:
                throw new Error(`不支持的节点类型: ${this.type}`);
        }
    }

    // AI对话处理
    async processAIChat() {
        let prompt = this.getInputValue('prompt') || this.config.prompt || '';
        prompt = this.processTemplateString(prompt);

        console.log(`[AI对话节点 ${this.id}] 输入提示词:`, prompt);

        try {
            // 使用新的简化API客户端
            const apiClient = window.simpleAPIClient || window.apiClient;
            if (!apiClient) {
                throw new Error('API客户端未初始化');
            }

            const result = await apiClient.chatCompletion(prompt, {
                model: this.config.model,
                temperature: this.config.temperature,
                maxTokens: this.config.maxTokens
            });

            this.setOutputValue('response', result.content);
            this.updateAIDisplay('response', result.content);
            return { response: result.content };
        } catch (error) {
            console.error(`[AI对话节点 ${this.id}] 调用失败:`, error);
            throw new Error(`AI对话失败: ${error.message}`);
        }
    }

    // AI文本生成处理
    async processAITextGeneration() {
        const topic = this.getInputValue('topic') || this.config.topic || '';
        let prompt = `${this.config.prompt || ''} ${topic}`.trim();
        prompt = this.processTemplateString(prompt);

        console.log(`[AI文本生成节点 ${this.id}] 输入主题:`, topic);
        console.log(`[AI文本生成节点 ${this.id}] 完整提示词:`, prompt);

        try {
            const apiClient = window.simpleAPIClient || window.apiClient;
            if (!apiClient) {
                throw new Error('API客户端未初始化');
            }

            const result = await apiClient.chatCompletion(prompt, {
                model: this.config.model,
                temperature: this.config.temperature,
                maxTokens: this.config.maxTokens
            });

            this.setOutputValue('text', result.content);
            this.updateAIDisplay('text', result.content);
            return { text: result.content };
        } catch (error) {
            console.error(`[AI文本生成节点 ${this.id}] 调用失败:`, error);
            throw new Error(`文本生成失败: ${error.message}`);
        }
    }

    // AI文本分析处理
    async processAITextAnalysis() {
        const text = this.getInputValue('text') || this.config.text || '';
        let prompt = `${this.config.prompt || ''} ${text}`.trim();
        prompt = this.processTemplateString(prompt);

        console.log(`[AI文本分析节点 ${this.id}] 输入文本:`, text);
        console.log(`[AI文本分析节点 ${this.id}] 完整提示词:`, prompt);

        try {
            const apiClient = window.simpleAPIClient || window.apiClient;
            if (!apiClient) {
                throw new Error('API客户端未初始化');
            }

            const result = await apiClient.chatCompletion(prompt, {
                model: this.config.model,
                temperature: this.config.temperature,
                maxTokens: this.config.maxTokens
            });

            this.setOutputValue('analysis', result.content);
            this.updateAIDisplay('analysis', result.content);
            return { analysis: result.content };
        } catch (error) {
            console.error(`[AI文本分析节点 ${this.id}] 调用失败:`, error);
            throw new Error(`文本分析失败: ${error.message}`);
        }
    }

    // AI图像生成处理
    async processAIImageGeneration() {
        // 优先使用输入的prompt，如果没有则使用配置的prompt
        let prompt = this.getInputValue('prompt');
        if (!prompt || prompt.trim() === '') {
            prompt = this.config.prompt || '一只可爱的猫咪坐在花园里';
        }
        prompt = this.processTemplateString(prompt);

        console.log(`[AI图像生成节点 ${this.id}] 使用提示词:`, prompt);
        console.log(`[AI图像生成节点 ${this.id}] 提示词来源:`, this.getInputValue('prompt') ? '输入连接' : '节点配置');

        try {
            const apiClient = window.simpleAPIClient || window.apiClient;
            if (!apiClient) {
                throw new Error('API客户端未初始化');
            }

            const result = await apiClient.generateImage({
                prompt: prompt,
                model: this.config.model || 'dall-e-3',
                size: this.config.size || '1024x1024',
                quality: this.config.quality || 'standard',
                n: this.config.count || 1
            });

            // 处理输出数据
            const images = result.data || [];

            this.setOutputValue('images', images);
            this.setOutputValue('prompt', prompt);

            // 更新节点显示，支持图像显示
            this.updateImageDisplay('images', images);

            console.log(`[AI图像生成节点 ${this.id}] 成功生成 ${images.length} 张图像`);
            return { images: images, prompt: prompt };
        } catch (error) {
            console.error(`[AI图像生成节点 ${this.id}] 调用失败:`, error);
            throw new Error(`图像生成失败: ${error.message}`);
        }
    }

    // AI图像编辑处理
    async processAIImageEdit() {
        let prompt = this.getInputValue('prompt') || this.config.prompt || '';
        let imageInput = this.getInputValue('image') || null;
        let maskInput = this.getInputValue('mask') || null;

        prompt = this.processTemplateString(prompt);

        console.log(`[AI图像编辑节点 ${this.id}] 输入提示词:`, prompt);

        if (!imageInput) {
            throw new Error('图像编辑需要提供原始图像');
        }

        try {
            const apiClient = window.simpleAPIClient || window.apiClient;
            if (!apiClient) {
                throw new Error('API客户端未初始化');
            }

            const result = await apiClient.editImage({
                image: imageInput,
                mask: maskInput,
                prompt: prompt,
                model: this.config.model || 'dall-e-2',
                size: this.config.size || '1024x1024',
                n: this.config.count || 1
            });

            this.setOutputValue('images', result.data);
            this.setOutputValue('prompt', prompt);

            this.updateImageDisplay('images', result.data);
            return { images: result.data, prompt: prompt };
        } catch (error) {
            console.error(`[AI图像编辑节点 ${this.id}] 调用失败:`, error);
            throw new Error(`图像编辑失败: ${error.message}`);
        }
    }

    // AI图像变体处理
    async processAIImageVariation() {
        let imageInput = this.getInputValue('image') || null;

        console.log(`[AI图像变体节点 ${this.id}] 输入图像:`, imageInput ? '已提供' : '未提供');

        if (!imageInput) {
            throw new Error('图像变体需要提供原始图像');
        }

        try {
            const apiClient = window.simpleAPIClient || window.apiClient;
            if (!apiClient) {
                throw new Error('API客户端未初始化');
            }

            const result = await apiClient.createImageVariation({
                image: imageInput,
                model: this.config.model || 'dall-e-2',
                size: this.config.size || '1024x1024',
                n: this.config.count || 2
            });

            this.setOutputValue('images', result.data);

            this.updateImageDisplay('images', result.data);
            return { images: result.data };
        } catch (error) {
            console.error(`[AI图像变体节点 ${this.id}] 调用失败:`, error);
            throw new Error(`图像变体失败: ${error.message}`);
        }
    }

    // AI音频转录处理
    async processAIAudioTranscription() {
        let audioInput = this.getInputValue('audio') || null;
        let prompt = this.getInputValue('prompt') || this.config.prompt || '';

        console.log(`[AI音频转录节点 ${this.id}] 输入音频:`, audioInput ? '已提供' : '未提供');

        if (!audioInput) {
            throw new Error('音频转录需要提供音频文件');
        }

        try {
            const apiClient = window.simpleAPIClient || window.apiClient;
            if (!apiClient) {
                throw new Error('API客户端未初始化');
            }

            const result = await apiClient.transcribeAudio({
                file: audioInput,
                model: this.config.model || 'whisper-1',
                language: this.config.language !== 'auto' ? this.config.language : undefined,
                prompt: prompt || undefined
            });

            this.setOutputValue('text', result.text);
            this.setOutputValue('language', result.language);

            this.updateAIDisplay('text', result.text);
            return { text: result.text, language: result.language };
        } catch (error) {
            console.error(`[AI音频转录节点 ${this.id}] 调用失败:`, error);
            throw new Error(`音频转录失败: ${error.message}`);
        }
    }

    // AI文本转语音处理
    async processAITextToSpeech() {
        let text = this.getInputValue('text') || this.config.text || '';
        text = this.processTemplateString(text);

        console.log(`[AI文本转语音节点 ${this.id}] 输入文本:`, text);

        if (!text.trim()) {
            throw new Error('文本转语音需要提供文本内容');
        }

        try {
            const apiClient = window.simpleAPIClient || window.apiClient;
            if (!apiClient) {
                throw new Error('API客户端未初始化');
            }

            const result = await apiClient.textToSpeech({
                input: text,
                model: this.config.model || 'tts-1',
                voice: this.config.voice || 'alloy',
                speed: this.config.speed || 1.0
            });

            this.setOutputValue('audio', result);
            this.setOutputValue('text', text);

            this.updateAudioDisplay('audio', result);
            return { audio: result, text: text };
        } catch (error) {
            console.error(`[AI文本转语音节点 ${this.id}] 调用失败:`, error);
            throw new Error(`文本转语音失败: ${error.message}`);
        }
    }

    // 文件输入处理
    async processFileInput() {
        // 这里应该处理文件选择和读取
        // 由于是纯前端，需要用户手动选择文件
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = this.config.fileType === 'text' ? '.txt,.json,.csv' : '*/*';

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const content = await Utils.readFile(file);
                        this.setOutputValue('content', content);
                        this.setOutputValue('filename', file.name);
                        resolve({ content, filename: file.name });
                    } catch (error) {
                        throw new Error(`读取文件失败: ${error.message}`);
                    }
                }
            };

            input.click();
        });
    }

    // 文件输出处理
    async processFileOutput() {
        const content = this.getInputValue('content') || '';
        const filename = this.config.filename;

        Utils.downloadFile(content, filename, 'text/plain');

        return { filename };
    }

    // 文本输入处理
    async processTextInput() {
        // 从配置获取文本，如果有连接输入则优先使用连接输入
        const inputText = this.getInputValue('input');
        const text = inputText !== undefined ? inputText : (this.config.text || '');

        console.log(`[文本输入节点 ${this.id}] 输出文本:`, text);
        this.setOutputValue('text', text);
        return { text };
    }

    // 可选输入处理
    async processOptionalInput() {
        const defaultText = this.config.text || '默认输入内容';
        const timeout = (this.config.timeout || 20) * 1000; // 转换为毫秒

        console.log(`[可选输入节点 ${this.id}] 弹出输入窗口，默认值: ${defaultText}, 超时: ${timeout}ms`);

        try {
            // 使用弹窗管理器显示即时输入弹窗
            const result = await window.popupManager.showImmediateInputPopup(
                this.id,
                '用户输入',
                defaultText,
                true, // 标记为可选输入
                timeout
            );

            const finalText = result.value || defaultText;
            console.log(`[可选输入节点 ${this.id}] 用户输入结果:`, result.action, finalText);

            this.setOutputValue('text', finalText);
            return { text: finalText };

        } catch (error) {
            // 用户取消或其他错误，使用默认值
            console.log(`[可选输入节点 ${this.id}] 输入被取消，使用默认值:`, defaultText);
            this.setOutputValue('text', defaultText);
            return { text: defaultText };
        }
    }

    // 条件判断处理
    async processCondition() {
        const input = this.getInputValue('input');
        const condition = this.config.condition;
        const operator = this.config.operator;

        let result = false;

        switch (operator) {
            case 'equals':
                result = input === condition;
                break;
            case 'contains':
                result = String(input).includes(condition);
                break;
            case 'empty':
                result = !input || input.length === 0;
                break;
            case 'not_empty':
                result = input && input.length > 0;
                break;
        }

        if (result) {
            this.setOutputValue('true', input);
            return { true: input };
        } else {
            this.setOutputValue('false', input);
            return { false: input };
        }
    }

    // 循环处理
    async processLoop() {
        const input = this.getInputValue('input');
        const maxIterations = this.config.maxIterations || 10;
        let result = input;

        for (let i = 0; i < maxIterations; i++) {
            // 这里可以添加循环逻辑
            // 暂时只是简单返回输入
            break;
        }

        this.setOutputValue('output', result);
        return { output: result };
    }

    // 延时处理
    async processDelay() {
        const input = this.getInputValue('input');
        const duration = this.config.duration || 1000;

        await new Promise(resolve => setTimeout(resolve, duration));

        this.setOutputValue('output', input);
        return { output: input };
    }

    // HTTP请求处理
    async processHttpRequest() {
        const url = this.config.url || this.getInputValue('url');
        const data = this.getInputValue('data');
        const method = this.config.method || 'GET';
        const headers = this.config.headers || {};

        const requestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (method !== 'GET' && data) {
            requestInit.body = typeof data === 'string' ? data : JSON.stringify(data);
        }

        const response = await fetch(url, requestInit);
        const result = await response.text();

        this.setOutputValue('response', result);
        return { response: result };
    }

    // JSON解析处理
    async processJsonParser() {
        const json = this.getInputValue('json');
        const path = this.config.path;
        const operation = this.config.operation;

        let data;
        try {
            data = typeof json === 'string' ? JSON.parse(json) : json;
        } catch (error) {
            throw new Error('无效的JSON格式');
        }

        let result = data;
        if (path) {
            const pathParts = path.split('.');
            for (const part of pathParts) {
                if (result && typeof result === 'object') {
                    result = result[part];
                } else {
                    result = undefined;
                    break;
                }
            }
        }

        this.setOutputValue('data', result);
        return { data: result };
    }

    // 文本转换处理
    async processTextTransform() {
        const text = this.getInputValue('text') || '';
        const operation = this.config.operation;
        const pattern = this.config.pattern;
        const replacement = this.config.replacement;

        let result = text;

        switch (operation) {
            case 'lowercase':
                result = text.toLowerCase();
                break;
            case 'uppercase':
                result = text.toUpperCase();
                break;
            case 'trim':
                result = text.trim();
                break;
            case 'replace':
                if (pattern) {
                    result = text.replace(new RegExp(pattern, 'g'), replacement || '');
                }
                break;
        }

        this.setOutputValue('transformed', result);
        return { transformed: result };
    }

    // 显示执行结果
    showExecutionResult(inputs, outputs, error = null) {
        const resultElement = this.element.querySelector(`#executionResult-${this.id}`);
        const inputsElement = this.element.querySelector(`#resultInputs-${this.id}`);
        const outputsElement = this.element.querySelector(`#resultOutputs-${this.id}`);

        if (!resultElement || !inputsElement || !outputsElement) {
            return;
        }

        // 显示结果区域
        resultElement.style.display = 'block';

        // 根据设置决定是否自动展开
        const autoExpand = window.appConfig?.get('autoExpandResults') === true; // 默认关闭
        if (!error && autoExpand) {
            resultElement.classList.remove('collapsed');
        } else {
            resultElement.classList.add('collapsed');
        }

        // 显示输入
        inputsElement.innerHTML = '';
        Object.entries(inputs).forEach(([key, value]) => {
            const inputDiv = document.createElement('div');
            inputDiv.className = 'result-item';
            inputDiv.title = '点击复制内容';
            inputDiv.innerHTML = `
                <div class="result-key">${key}:</div>
                <div class="result-value">${this.formatResultValue(value, key)}</div>
            `;
            // 添加点击复制功能
            inputDiv.addEventListener('click', () => {
                this.copyToClipboard(key, value);
            });
            inputsElement.appendChild(inputDiv);
        });

        // 显示输出
        outputsElement.innerHTML = '';
        if (error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'result-item error';
            errorDiv.title = '点击复制错误信息';
            errorDiv.innerHTML = `
                <div class="result-key">错误:</div>
                <div class="result-value">${error.message}</div>
            `;
            // 添加点击复制功能
            errorDiv.addEventListener('click', () => {
                this.copyToClipboard('错误', error.message);
            });
            outputsElement.appendChild(errorDiv);
        } else {
            Object.entries(outputs).forEach(([key, value]) => {
                const outputDiv = document.createElement('div');
                outputDiv.className = 'result-item';
                outputDiv.title = '点击复制内容';
                outputDiv.innerHTML = `
                    <div class="result-key">${key}:</div>
                    <div class="result-value">${this.formatResultValue(value, key)}</div>
                `;
                // 添加点击复制功能
                outputDiv.addEventListener('click', () => {
                    this.copyToClipboard(key, value);
                });
                outputsElement.appendChild(outputDiv);
            });
        }
    }

    // 隐藏执行结果
    hideExecutionResult() {
        const resultElement = this.element.querySelector(`#executionResult-${this.id}`);
        if (resultElement) {
            resultElement.style.display = 'none';
            this.adjustNodeHeight();
        }
    }

    // 格式化结果值显示
    formatResultValue(value, key = '') {
        if (value === null || value === undefined) {
            return '<em>空</em>';
        }

        // 特殊处理图像数据
        if (key === 'images' && Array.isArray(value)) {
            return this.formatImageResultValue(value);
        }

        // 特殊处理音频数据
        if (key === 'audio' && value instanceof Blob) {
            return this.formatAudioResultValue(value);
        }

        if (typeof value === 'object') {
            const str = JSON.stringify(value); // 移除缩进格式化
            return str.length > 200 ?
                `<details><summary>查看对象 (${Object.keys(value).length} 属性)</summary><pre>${str}</pre></details>` :
                `<span>${str}</span>`; // 短对象使用span而不是pre
        }

        const str = String(value);
        return str.length > 100 ?
            `<details><summary>查看内容 (${str.length} 字符)</summary><pre>${str}</pre></details>` :
            `<span>${str}</span>`;
    }

    // 格式化图像结果显示
    formatImageResultValue(images) {
        if (!Array.isArray(images) || images.length === 0) {
            return '<em>无图像</em>';
        }

        let html = `<div class="image-results" style="margin: 5px 0;">`;

        images.forEach((imageData, index) => {
            // 处理不同的图像数据格式，同步之前的修改
            let imageSrc = '';
            if (imageData.localUrl) {
                // 已下载的图像使用本地URL
                imageSrc = imageData.localUrl;
            } else if (imageData.url) {
                // 使用原始URL
                imageSrc = imageData.url;
            } else if (imageData.sourceUrl) {
                // 使用源URL（兼容引用格式）
                imageSrc = imageData.sourceUrl;
            } else if (imageData.b64_json) {
                // Base64格式
                imageSrc = `data:image/png;base64,${imageData.b64_json}`;
            } else if (imageData.originalData && imageData.originalData.url) {
                // 从原始数据获取URL
                imageSrc = imageData.originalData.url;
            }

            if (imageSrc) {
                html += `
                    <div class="image-result-item" style="margin: 2px 0; padding: 4px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa;">
                        <div class="image-preview" style="text-align: center;">
                            <img src="${imageSrc}" 
                                 alt="生成的图像 ${index + 1}" 
                                 style="width: 100%; max-width: 150px; height: auto; max-height: 100px; border-radius: 4px; cursor: pointer; object-fit: cover;"
                                 onclick="if(this.style.maxWidth === '150px' || !this.style.maxWidth) { this.style.maxWidth = '100%'; this.style.maxHeight = 'auto'; } else { this.style.maxWidth = '150px'; this.style.maxHeight = '100px'; }"
                                 title="点击切换大小显示"
                                 onerror="this.style.backgroundColor = '#f8f9fa'; this.alt = '图像加载失败';">
                        </div>
                        <div class="image-details" style="font-size: 11px; color: #666; margin-top: 3px; text-align: center;">
                            ${imageData.revised_prompt ? `
                                <div style="margin: 2px 0; font-style: italic; display: none;" class="prompt-detail">
                                    <strong>优化提示词:</strong> ${imageData.revised_prompt.length > 50 ? imageData.revised_prompt.substring(0, 50) + '...' : imageData.revised_prompt}
                                </div>
                            ` : ''}
                            <div style="margin: 2px 0;">
                                <button onclick="navigator.clipboard.writeText('${imageSrc}')" 
                                        style="padding: 1px 4px; font-size: 10px; border: 1px solid #ccc; background: #f8f9fa; cursor: pointer; border-radius: 3px; margin: 0 2px;">
                                    复制
                                </button>
                                <button onclick="window.open('${imageSrc}', '_blank')" 
                                        style="padding: 1px 4px; font-size: 10px; border: 1px solid #ccc; background: #f8f9fa; cursor: pointer; border-radius: 3px; margin: 0 2px;">
                                    浏览
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        html += `</div>`;
        return html;
    }

    // 获取连接点HTML
    getConnectionPointsHTML() {
        const info = this.getNodeInfo();
        let html = '<div class="connection-points">';

        // 输入连接点
        if (info.inputs && info.inputs.length > 0) {
            html += '<div class="input-points">';
            info.inputs.forEach(input => {
                html += `<div class="connection-point input" data-input="${input}" title="输入: ${input}"></div>`;
            });
            html += '</div>';
        }

        // 输出连接点
        if (info.outputs && info.outputs.length > 0) {
            html += '<div class="output-points">';
            info.outputs.forEach(output => {
                html += `<div class="connection-point output" data-output="${output}" title="输出: ${output}"></div>`;
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    // 格式化音频结果显示
    formatAudioResultValue(audioBlob) {
        const audioUrl = URL.createObjectURL(audioBlob);
        return `
            <div class="audio-result" style="margin: 5px 0; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <div style="margin-bottom: 5px;">🎵 音频文件 (${(audioBlob.size / 1024).toFixed(1)} KB)</div>
                <audio controls style="width: 100%; max-width: 300px;">
                    <source src="${audioUrl}" type="${audioBlob.type}">
                    您的浏览器不支持音频播放。
                </audio>
                <div style="margin-top: 5px;">
                    <a href="${audioUrl}" download="generated_audio.mp3" 
                       style="color: #007bff; text-decoration: none; font-size: 12px;">
                        📥 下载音频
                    </a>
                </div>
            </div>
        `;
    }

    // 复制内容到剪贴板
    copyToClipboard(key, value) {
        try {
            // 获取纯文本内容
            let textToCopy;
            if (typeof value === 'object') {
                textToCopy = `${key}: ${JSON.stringify(value, null, 2)}`;
            } else {
                textToCopy = `${key}: ${String(value)}`;
            }

            // 使用 Navigator Clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    this.showCopySuccess(key);
                }).catch(err => {
                    this.fallbackCopy(textToCopy, key);
                });
            } else {
                this.fallbackCopy(textToCopy, key);
            }
        } catch (error) {
            console.error('复制失败:', error);
            Utils.showNotification('复制失败', 'error');
        }
    }

    // 降级复制方法
    fallbackCopy(text, key) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showCopySuccess(key);
        } catch (error) {
            console.error('降级复制也失败:', error);
            Utils.showNotification('复制失败', 'error');
        }
    }

    // 显示复制成功提示
    showCopySuccess(key) {
        Utils.showNotification(`已复制"${key}"的内容`, 'success');
    }

    // 调整节点高度
    adjustNodeHeight() {
        // 让浏览器自动调整高度
        this.element.style.height = 'auto';

        // 更新连接线
        if (window.workflowManager) {
            window.workflowManager.updateConnections();
        }
    }

    // 支持模板字符串解析的方法增强
    processTemplateString(template, additionalContext = {}) {
        if (typeof template !== 'string') {
            return template;
        }

        // 使用变量管理器解析模板
        return window.variableManager.resolveTemplate(template, {
            ...this.inputs,
            ...this.outputs,
            nodeId: this.id,
            nodeType: this.type,
            ...additionalContext
        });
    }

    // 获取节点数据
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            config: this.config,
            connections: {
                inputs: Object.fromEntries(this.connections.inputs),
                outputs: Object.fromEntries(
                    Array.from(this.connections.outputs.entries()).map(([key, value]) => [key, value])
                )
            }
        };
    }

    // 从数据创建节点
    static fromJSON(data) {
        const node = new WorkflowNode(data.type, {
            x: data.x,
            y: data.y,
            config: data.config
        });
        node.id = data.id;
        return node;
    }

    // 清理节点资源
    cleanup() {
        // 停止位置追踪器
        this.stopPositionTracking();

        // 清理其他定时器
        if (this.updateConnectionsDebounced) {
            clearTimeout(this.updateConnectionsDebounced);
            this.updateConnectionsDebounced = null;
        }
    }
}


// AI对话窗口节点 - 连接对话窗口与工作流
class AIChatWindowNode extends WorkflowNode {
    constructor(data = {}) {
        super('ai-chat-window', data);
        this.windowId = data.config?.windowId || null;
        this.conversationWindow = null;
    }

    getDefaultConfig() {
        return {
            windowId: null,
            title: 'AI对话窗口',
            model: 'gpt-3.5-turbo',
            prompt: '你是一个有用的AI助手。',
            temperature: 0.7,
            autoResponse: true,
            inputMode: 'stream', // manual, stream
            outputMode: 'auto', // manual, auto, latest
            manualOutput: '' // 手动模式下的输出内容
        };
    }

    getInputs() {
        return {
            prompt: { type: 'string', label: '输入提示', required: false },
            context: { type: 'string', label: '上下文', required: false }
        };
    }

    getOutputs() {
        return {
            response: { type: 'string', label: 'AI回复' },
            conversation: { type: 'array', label: '完整对话' }
        };
    }

    getNodeInfo() {
        return {
            title: this.config.title || 'AI对话窗口',
            category: 'AI',
            description: '连接到对话窗口的AI节点',
            color: '#28a745',
            inputs: Object.keys(this.getInputs()),
            outputs: Object.keys(this.getOutputs())
        };
    }

    getPropertyConfig() {
        return [
            {
                key: 'description',
                type: 'info',
                label: '模式说明',
                value: '流处理模式：工作流输入直接发送给AI；手动模式：输入放到输入框等待用户操作'
            },
            {
                key: 'title',
                type: 'text',
                label: '窗口标题',
                value: this.config.title || 'AI对话窗口'
            },
            {
                key: 'model',
                type: 'select',
                label: '模型',
                value: this.config.model || 'gpt-3.5-turbo',
                options: [
                    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
                    { value: 'gpt-4', label: 'GPT-4' },
                    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
                    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
                    { value: 'local-model', label: '本地模型' }
                ]
            },
            {
                key: 'prompt',
                type: 'textarea',
                label: '系统提示',
                value: this.config.prompt || '你是一个有用的AI助手。',
                rows: 3
            },
            {
                key: 'temperature',
                type: 'range',
                label: 'Temperature',
                value: this.config.temperature || 0.7,
                min: 0,
                max: 2,
                step: 0.1
            },
            {
                key: 'inputMode',
                type: 'select',
                label: '输入模式',
                value: this.config.inputMode || 'stream',
                options: [
                    { value: 'manual', label: '手动模式（放入输入框，等待用户操作）' },
                    { value: 'stream', label: '流处理模式（直接发送给AI）' }
                ]
            },
            {
                key: 'outputMode',
                type: 'select',
                label: '输出模式',
                value: this.config.outputMode || 'auto',
                options: [
                    { value: 'auto', label: '自动模式（输出最新AI回复）' },
                    { value: 'manual', label: '手动模式（指定输出内容）' }
                ]
            },
            {
                key: 'autoResponse',
                type: 'checkbox',
                label: '自动响应输入',
                value: this.config.autoResponse !== false
            },
            {
                key: 'manualOutput',
                type: 'textarea',
                label: '手动输出内容',
                value: this.config.manualOutput || '',
                rows: 2,
                show: this.config.outputMode === 'manual'
            }
        ];
    }

    // 连接到对话窗口
    connectToWindow() {
        if (this.windowId && window.conversationWindowManager) {
            const windows = window.conversationWindowManager.getAllWindows();
            this.conversationWindow = windows.find(w => w.id === this.windowId);

            if (this.conversationWindow) {
                // 更新窗口配置
                if (this.conversationWindow.modelSelect) {
                    this.conversationWindow.modelSelect.value = this.config.model;
                }
                if (this.conversationWindow.temperatureSlider) {
                    const tempValue = parseFloat(this.config.temperature);
                    this.conversationWindow.temperatureSlider.value = tempValue;
                    this.conversationWindow.tempValueDisplay.textContent = tempValue.toFixed(1);
                }

                return true;
            }
        }
        return false;
    }

    // 处理节点逻辑
    async processNode() {
        const inputs = this.getResolvedInputs();
        console.log(`[AI对话窗口节点 ${this.id}] 接收到输入:`, inputs);

        // 如果没有连接到窗口，尝试连接
        if (!this.conversationWindow) {
            this.connectToWindow();
        }

        // 获取输入模式
        const inputMode = this.config.inputMode || 'stream'; // manual, stream
        const outputMode = this.config.outputMode || 'auto'; // manual, auto

        console.log(`[AI对话窗口节点 ${this.id}] 当前配置:`, this.config);
        console.log(`[AI对话窗口节点 ${this.id}] 输入模式: ${inputMode}, 输出模式: ${outputMode}`);

        // 处理输入
        if (inputs.prompt && this.conversationWindow) {
            try {
                if (inputMode === 'stream') {
                    // 流处理模式：直接添加到对话历史并自动发送给AI
                    console.log(`[AI对话窗口节点 ${this.id}] 流处理模式，自动处理输入:`, inputs.prompt);

                    // 添加用户消息到对话历史
                    this.conversationWindow.addMessage({
                        role: 'user',
                        content: inputs.prompt,
                        timestamp: Date.now()
                    });

                    // 确保输入框为空（流处理模式不显示在输入框）
                    if (this.conversationWindow.inputElement) {
                        this.conversationWindow.inputElement.value = '';
                        if (this.conversationWindow.adjustInputHeight) {
                            this.conversationWindow.adjustInputHeight();
                        }
                    }

                    // 如果启用自动响应，调用AI
                    if (this.config.autoResponse !== false) {
                        this.conversationWindow.isWaitingResponse = true;
                        this.conversationWindow.updateStatus('AI思考中...');

                        try {
                            // 调用AI API
                            const response = await this.conversationWindow.callAI(inputs.prompt);

                            // 添加AI回复
                            this.conversationWindow.addMessage({
                                role: 'assistant',
                                content: response.content,
                                timestamp: Date.now()
                            });

                        } catch (aiError) {
                            // 添加错误消息
                            this.conversationWindow.addMessage({
                                role: 'assistant',
                                content: `发送失败: ${aiError.message}`,
                                timestamp: Date.now(),
                                isError: true
                            });
                        } finally {
                            this.conversationWindow.isWaitingResponse = false;
                            this.conversationWindow.updateStatus('就绪');
                        }
                    }
                } else if (inputMode === 'manual') {
                    // 手动模式：只显示在输入框，不自动发送，不添加到对话历史
                    console.log(`[AI对话窗口节点 ${this.id}] 手动模式，输入放到输入框等待用户操作:`, inputs.prompt);
                    if (this.conversationWindow.inputElement) {
                        this.conversationWindow.inputElement.value = inputs.prompt;
                        // 调整输入框高度
                        if (this.conversationWindow.adjustInputHeight) {
                            this.conversationWindow.adjustInputHeight();
                        }
                        // 聚焦到输入框
                        this.conversationWindow.inputElement.focus();
                    }

                    // 手动模式：返回等待状态，不执行后续节点
                    return this.generateOutput(outputMode, true); // 传入等待标志
                }

                // 等待处理完成
                await new Promise(resolve => setTimeout(resolve, 200));

                // 根据输出模式返回结果
                return this.generateOutput(outputMode);

            } catch (error) {
                console.error(`[AI对话窗口节点 ${this.id}] 处理失败:`, error);
                throw new Error(`AI对话窗口处理失败: ${error.message}`);
            }
        } else {
            // 没有输入，返回当前状态
            console.log(`[AI对话窗口节点 ${this.id}] 没有输入，返回当前状态`);
            return this.generateOutput(outputMode);
        }
    }

    // 生成输出
    generateOutput(outputMode, isWaiting = false) {
        if (!this.conversationWindow) {
            return { response: '', conversation: [] };
        }

        // 如果是等待状态（手动模式），返回空输出但不执行后续节点
        if (isWaiting) {
            console.log(`[AI对话窗口节点 ${this.id}] 手动模式等待用户操作，暂不输出`);
            return {
                response: '',
                conversation: [],
                _waiting: true  // 特殊标志，表示等待状态
            };
        }

        const messages = this.conversationWindow.messages || [];
        let response = '';

        if (outputMode === 'auto' || outputMode === 'latest') {
            // 自动输出最新的AI回复
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'assistant') {
                    response = messages[i].content;
                    break;
                }
            }
        } else if (outputMode === 'manual') {
            // 手动模式：需要用户在UI中指定输出
            // 这里可以从节点配置中获取用户选择的输出
            response = this.config.manualOutput || '';
        }

        // 导出完整对话 - 修复对象序列化问题
        const conversation = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp
        }));

        // 将 conversation 转换为 JSON 字符串以避免 [object Object] 问题
        const conversationString = JSON.stringify(conversation, null, 2);

        console.log(`[AI对话窗口节点 ${this.id}] 输出模式 ${outputMode}，返回:`, { response, conversationLength: conversation.length });

        return {
            response: response,
            conversation: conversationString  // 返回字符串而不是对象数组
        };
    }

    // 更新配置
    updateConfig(newConfig) {
        super.updateConfig(newConfig);

        // 如果有连接的窗口，同步配置
        if (this.conversationWindow) {
            if (newConfig.model && this.conversationWindow.modelSelect) {
                this.conversationWindow.modelSelect.value = newConfig.model;
            }
            if (newConfig.temperature !== undefined && this.conversationWindow.temperatureSlider) {
                const tempValue = parseFloat(newConfig.temperature);
                this.conversationWindow.temperatureSlider.value = tempValue;
                this.conversationWindow.tempValueDisplay.textContent = tempValue.toFixed(1);
            }
        }
    }

    // 双击事件处理
    onDoubleClick(e) {
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
        console.log('AI对话窗口节点双击:', this.id);

        // 打开或聚焦对话窗口
        this.openConversationWindow();
    }

    // 打开对话窗口
    async openConversationWindow() {
        try {
            // 如果已有对话窗口，聚焦它
            if (this.conversationWindow) {
                this.conversationWindow.show();
                // ConversationWindow没有focus方法，使用show即可
                return;
            }

            // 尝试连接到现有窗口
            if (this.connectToWindow()) {
                this.conversationWindow.show();
                return;
            }

            // 创建新的对话窗口
            this.conversationWindow = await this.createConversationWindow();
            Utils.showNotification('AI对话窗口已打开', 'success');

        } catch (error) {
            console.error('打开对话窗口失败:', error);
            Utils.showNotification('打开对话窗口失败: ' + error.message, 'error');
        }
    }

    // 创建对话窗口
    async createConversationWindow() {
        console.log('创建对话窗口，检查ConversationWindow类:', typeof window.ConversationWindow);

        if (!window.ConversationWindow) {
            throw new Error('ConversationWindow 类未加载');
        }

        const conversationWindow = new window.ConversationWindow({
            id: Utils.generateId('chat_'),
            title: this.config.title || 'AI对话',
            agentId: 'workflow-node-' + this.id,
            position: { x: 150, y: 150 },
            size: { width: 400, height: 600 }
        });

        // 设置节点引用
        conversationWindow.linkedNode = this;
        this.windowId = conversationWindow.id;

        // 显示窗口
        conversationWindow.show();

        console.log(`[AI对话窗口节点 ${this.id}] 创建了新的对话窗口:`, conversationWindow.id);

        return conversationWindow;
    }
}

// URL载入工具节点 - 从URL载入各种文件到全局存储
class UrlLoaderNode extends WorkflowNode {
    constructor(data = {}) {
        super('url-loader', data);
    }

    getDefaultConfig() {
        return {
            url: '',
            storageName: '',
            description: '',
            autoDetectType: true,
            forceType: ''
        };
    }

    getNodeInfo() {
        return {
            title: 'URL载入器',
            icon: 'fas fa-link',
            description: '从URL载入文件到全局存储',
            inputs: ['url', 'storageName'],
            outputs: ['storageName', 'type', 'size']
        };
    }

    getNodeContentHTML() {
        const url = this.config.url || '未设置';
        const displayUrl = url.length > 30 ? url.substring(0, 30) + '...' : url;
        return `<div>URL: ${displayUrl}</div>`;
    }

    async processNode() {
        let url = this.getInputValue('url') || this.config.url || '';
        let storageName = this.getInputValue('storageName') || this.config.storageName || '';
        const description = this.config.description || '';

        url = this.processTemplateString(url);
        storageName = this.processTemplateString(storageName);

        console.log(`[URL载入节点 ${this.id}] 载入URL: ${url}`);

        if (!url.trim()) {
            throw new Error('请提供要载入的URL');
        }

        try {
            // 使用存储管理器的URL载入功能
            const storageItem = await window.variableManager.loadFromUrl(
                url.trim(),
                storageName.trim() || null,
                description || null
            );

            console.log(`[URL载入节点 ${this.id}] 载入成功: ${storageItem.name} (${storageItem.type})`);

            this.setOutputValue('storageName', storageItem.name);
            this.setOutputValue('type', storageItem.type);
            this.setOutputValue('size', storageItem.size);

            return {
                storageName: storageItem.name,
                type: storageItem.type,
                size: storageItem.size
            };

        } catch (error) {
            console.error(`[URL载入节点 ${this.id}] 载入失败:`, error);
            throw new Error(`URL载入失败: ${error.message}`);
        }
    }
}

// 文件上传工具节点 - 从本地上传文件到全局存储
class FileUploadNode extends WorkflowNode {
    constructor(data = {}) {
        super('file-upload', data);
    }

    getDefaultConfig() {
        return {
            storageName: '',
            description: '',
            acceptTypes: '*/*'
        };
    }

    getNodeInfo() {
        return {
            title: '文件上传',
            icon: 'fas fa-upload',
            description: '上传本地文件到全局存储',
            inputs: ['storageName'],
            outputs: ['storageName', 'type', 'size']
        };
    }

    getNodeContentHTML() {
        return `<div>点击执行选择文件</div>`;
    }

    async processNode() {
        let storageName = this.getInputValue('storageName') || this.config.storageName || '';
        const description = this.config.description || '';
        const acceptTypes = this.config.acceptTypes || '*/*';

        storageName = this.processTemplateString(storageName);

        console.log(`[文件上传节点 ${this.id}] 开始文件选择`);

        try {
            // 创建文件选择器
            const file = await this.selectFile(acceptTypes);

            if (!file) {
                throw new Error('未选择文件');
            }

            // 使用存储管理器的文件上传功能
            const storageItem = await window.variableManager.handleFileUpload(
                file,
                storageName.trim() || null
            );

            // 如果有描述，更新存储项
            if (description) {
                const item = window.variableManager.getGlobalVariable(storageItem.name);
                if (item) {
                    item.description = description;
                    window.variableManager.globalVariables.set(storageItem.name, item);
                    window.variableManager.saveToStorage();
                }
            }

            console.log(`[文件上传节点 ${this.id}] 上传成功: ${storageItem.name} (${storageItem.type})`);

            this.setOutputValue('storageName', storageItem.name);
            this.setOutputValue('type', storageItem.type);
            this.setOutputValue('size', storageItem.size);

            return {
                storageName: storageItem.name,
                type: storageItem.type,
                size: storageItem.size
            };

        } catch (error) {
            console.error(`[文件上传节点 ${this.id}] 上传失败:`, error);
            throw new Error(`文件上传失败: ${error.message}`);
        }
    }

    // 文件选择器
    selectFile(acceptTypes) {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = acceptTypes;

            input.onchange = (e) => {
                const file = e.target.files[0];
                resolve(file);
            };

            input.oncancel = () => {
                resolve(null);
            };

            input.click();
        });
    }
}

// 存储读取节点 - 从全局存储读取内容
class StorageReaderNode extends WorkflowNode {
    constructor(data = {}) {
        super('storage-reader', data);
    }

    getDefaultConfig() {
        return {
            storageName: '',
            outputFormat: 'auto' // auto, text, json, blob
        };
    }

    getNodeInfo() {
        return {
            title: '存储读取器',
            icon: 'fas fa-database',
            description: '从全局存储读取内容',
            inputs: ['storageName'],
            outputs: ['content', 'type', 'size']
        };
    }

    getNodeContentHTML() {
        const storageName = this.config.storageName || '未设置';
        return `<div>读取: ${storageName}</div>`;
    }

    async processNode() {
        let storageName = this.getInputValue('storageName') || this.config.storageName || '';
        const outputFormat = this.config.outputFormat || 'auto';

        storageName = this.processTemplateString(storageName);

        console.log(`[存储读取节点 ${this.id}] 读取存储: ${storageName}`);

        if (!storageName.trim()) {
            throw new Error('请提供存储名称');
        }

        try {
            const item = window.variableManager.getGlobalVariable(storageName.trim());

            if (!item) {
                throw new Error(`存储项"${storageName}"不存在`);
            }

            let content = item.value;

            // 根据输出格式转换内容
            switch (outputFormat) {
                case 'text':
                    if (content instanceof Blob) {
                        content = await this.blobToText(content);
                    } else if (typeof content === 'object') {
                        content = JSON.stringify(content, null, 2);
                    } else {
                        content = String(content);
                    }
                    break;
                case 'json':
                    if (typeof content === 'object') {
                        content = JSON.stringify(content, null, 2);
                    } else {
                        content = String(content);
                    }
                    break;
                case 'blob':
                    if (!(content instanceof Blob)) {
                        const text = typeof content === 'object' ?
                            JSON.stringify(content) : String(content);
                        content = new Blob([text], { type: 'text/plain' });
                    }
                    break;
                // 'auto': 保持原始格式
            }

            const size = content instanceof Blob ? content.size :
                (typeof content === 'string' ? content.length :
                    JSON.stringify(content).length);

            console.log(`[存储读取节点 ${this.id}] 读取成功: ${item.type}, 大小: ${size}`);

            this.setOutputValue('content', content);
            this.setOutputValue('type', item.type);
            this.setOutputValue('size', size);

            return {
                content: content,
                type: item.type,
                size: size
            };

        } catch (error) {
            console.error(`[存储读取节点 ${this.id}] 读取失败:`, error);
            throw new Error(`存储读取失败: ${error.message}`);
        }
    }

    // Blob转文本
    async blobToText(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(blob);
        });
    }
}

// JavaScript代码节点类
class JavaScriptCode extends WorkflowNode {
    constructor(type, data = {}) {
        super(type, data);
        this.codeEditor = null;
        this.executionEngine = null;
    }

    getDefaultConfig() {
        return {
            code: `// JavaScript 代码节点
function processInput(input) {
    // 在这里编写你的JavaScript代码
    console.log('输入数据:', input);

    // 处理输入数据
    const result = input ? input.toString().toUpperCase() : 'Hello World';

    return result;
}

// 如果有输入数据，处理它；否则返回默认值
if (typeof input !== 'undefined') {
    return processInput(input);
} else {
    return processInput('默认输入');
}`,
            autoRun: true,
            timeout: 5000
        };
    }

    getNodeInfo() {
        return {
            title: 'JavaScript代码',
            icon: 'fab fa-js-square',
            description: '执行JavaScript代码',
            inputs: ['input'],
            outputs: ['output']
        };
    }

    async execute(inputs) {
        try {
            const code = this.config.code || this.getDefaultConfig()['javascript-code'].code;

            // 创建执行环境
            if (!this.executionEngine) {
                this.executionEngine = new CodeExecutionEngine('javascript');
                await this.executionEngine.initialize();
            }

            // 准备输入数据
            const inputData = inputs.input || null;
            const codeWithInput = `
                const input = ${JSON.stringify(inputData)};
                ${code}
            `;

            // 执行代码
            const result = await this.executionEngine.execute(codeWithInput);

            return { output: result };
        } catch (error) {
            console.error('JavaScript代码执行失败:', error);
            throw error;
        }
    }

    // 重写节点内容HTML，添加代码预览
    getNodeContentHTML() {
        try {
            const codeLines = this.getCodeLineCount();
            const codePreview = this.getCodePreview();

            return `
                <div class="code-preview-mini">
                    <div class="code-info">
                        <i class="fab fa-js-square"></i>
                        <span>${codeLines} 行代码</span>
                    </div>
                    <div class="code-snippet">
                        ${codePreview.split('\n')[0] || '// JavaScript代码'}
                    </div>
                </div>
            `;
        } catch (error) {
            console.warn('生成代码预览失败:', error);
            return '<div class="code-preview-mini"><i class="fab fa-js-square"></i> JavaScript代码</div>';
        }
    }

    // 获取代码行数
    getCodeLineCount() {
        try {
            const defaultConfig = this.getDefaultConfig();
            const code = (this.config && this.config.code) || defaultConfig.code;
            return code ? code.split('\n').length : 1;
        } catch (error) {
            console.warn('获取代码行数失败:', error);
            return 1;
        }
    }

    // 获取代码预览
    getCodePreview() {
        try {
            const defaultConfig = this.getDefaultConfig();
            const code = (this.config && this.config.code) || defaultConfig.code;
            if (!code) return '// 暂无代码';

            const lines = code.split('\n');
            const preview = lines.slice(0, 3).join('\n');
            return lines.length > 3 ? preview + '\n...' : preview;
        } catch (error) {
            console.warn('获取代码预览失败:', error);
            return '// 代码加载中...';
        }
    }

    // 绑定代码节点特有的事件
    bindEvents() {
        super.bindEvents();

        // 编辑按钮事件
        const editBtn = this.element.querySelector('.code-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openCodeEditor();
            });
        }
    }

    // 双击打开代码编辑器
    onDoubleClick(e) {
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
        console.log('JavaScript代码节点双击，打开编辑器');
        this.openCodeEditor();
    }

    openCodeEditor() {
        console.log('JavaScript代码节点：开始打开代码编辑器');
        console.log('当前节点状态:', { id: this.id, type: this.type, config: this.config });
        console.log('CodeEditorWindow是否可用:', typeof window.CodeEditorWindow);

        if (this.codeEditor) {
            console.log('编辑器已存在，聚焦窗口');
            if (this.codeEditor.show) {
                this.codeEditor.show();
            }
            return;
        }

        try {
            console.log('创建新的代码编辑器窗口');

            // 检查CodeEditorWindow是否可用
            if (typeof window.CodeEditorWindow === 'undefined') {
                throw new Error('CodeEditorWindow 类未加载');
            }

            // 创建代码编辑器窗口
            this.codeEditor = new window.CodeEditorWindow({
                id: `js-editor-${this.id}`,
                title: `JavaScript代码节点 - ${this.id}`,
                language: 'javascript',
                position: { x: 100, y: 100 },
                size: { width: 800, height: 600 }
            });

            console.log('代码编辑器窗口已创建:', this.codeEditor);

            // 显示窗口
            this.codeEditor.show();

            // 设置代码内容
            setTimeout(() => {
                if (this.codeEditor.editor) {
                    const defaultConfig = this.getDefaultConfig();
                    const defaultCode = this.config.code || defaultConfig.code;
                    this.codeEditor.editor.setValue(defaultCode);
                    console.log('代码内容已设置到编辑器');
                }
            }, 1000);

            // 监听代码保存
            this.codeEditor.onSave = (code) => {
                console.log('保存代码到节点:', code.substring(0, 50) + '...');
                this.config.code = code;
                this.saveNodeData();
                this.updateCodePreview();
            };

            // 监听窗口关闭
            this.codeEditor.onClose = () => {
                console.log('代码编辑器窗口已关闭');
                this.codeEditor = null;
            };

            Utils.showNotification('JavaScript代码编辑器已打开', 'success');

        } catch (error) {
            console.error('创建代码编辑器失败:', error);
            console.error('错误详情:', error.stack);
            Utils.showNotification('打开代码编辑器失败: ' + error.message, 'error');
        }
    }

    // 更新代码预览
    updateCodePreview() {
        if (this.element) {
            const previewContent = this.element.querySelector('.code-preview-content');
            const linesCount = this.element.querySelector('.code-lines');

            if (previewContent) {
                previewContent.textContent = this.getCodePreview();
            }
            if (linesCount) {
                linesCount.textContent = this.getCodeLineCount() + ' 行';
            }
        }
    }

    saveNodeData() {
        // 保存节点数据到工作流
        if (window.workflowManager && window.workflowManager.saveWorkflow) {
            window.workflowManager.saveWorkflow();
        }
    }
}

// Python代码节点类
class PythonCode extends WorkflowNode {
    constructor(type, data = {}) {
        super(type, data);
        this.codeEditor = null;
        this.executionEngine = null;
    }

    getDefaultConfig() {
        return {
            code: `# Python 代码节点
def process_input(input_data):
    """处理输入数据的函数"""
    print(f'输入数据: {input_data}')

    # 在这里编写你的Python代码
    if input_data:
        result = str(input_data).upper()
    else:
        result = 'Hello World'

    return result

# 如果有输入数据，处理它；否则返回默认值
if 'input' in globals():
    output = process_input(input)
else:
    output = process_input('默认输入')

print(f'输出结果: {output}')`,
            autoRun: true,
            timeout: 5000
        };
    }

    getNodeInfo() {
        return {
            title: 'Python代码',
            icon: 'fab fa-python',
            description: '执行Python代码',
            inputs: ['input'],
            outputs: ['output']
        };
    }

    async execute(inputs) {
        try {
            const code = this.config.code || this.getDefaultConfig()['python-code'].code;

            // 创建执行环境
            if (!this.executionEngine) {
                this.executionEngine = new CodeExecutionEngine('python');
                await this.executionEngine.initialize();
            }

            // 准备输入数据
            const inputData = inputs.input || null;
            const codeWithInput = `
input = ${JSON.stringify(inputData)}
${code}
            `;

            // 执行代码
            const result = await this.executionEngine.execute(codeWithInput);

            return { output: result };
        } catch (error) {
            console.error('Python代码执行失败:', error);
            throw error;
        }
    }

    // 重写节点内容HTML，添加代码预览
    getNodeContentHTML() {
        try {
            const codeLines = this.getCodeLineCount();
            const codePreview = this.getCodePreview();

            return `
                <div class="code-preview-mini">
                    <div class="code-info">
                        <i class="fab fa-python"></i>
                        <span>${codeLines} 行代码</span>
                    </div>
                    <div class="code-snippet">
                        ${codePreview.split('\n')[0] || '# Python代码'}
                    </div>
                </div>
            `;
        } catch (error) {
            console.warn('生成Python代码预览失败:', error);
            return '<div class="code-preview-mini"><i class="fab fa-python"></i> Python代码</div>';
        }
    }

    // 获取代码行数
    getCodeLineCount() {
        try {
            const defaultConfig = this.getDefaultConfig();
            const code = (this.config && this.config.code) || defaultConfig.code;
            return code ? code.split('\n').length : 1;
        } catch (error) {
            console.warn('获取Python代码行数失败:', error);
            return 1;
        }
    }

    // 获取代码预览
    getCodePreview() {
        try {
            const defaultConfig = this.getDefaultConfig();
            const code = (this.config && this.config.code) || defaultConfig.code;
            if (!code) return '# 暂无代码';

            const lines = code.split('\n');
            const preview = lines.slice(0, 3).join('\n');
            return lines.length > 3 ? preview + '\n...' : preview;
        } catch (error) {
            console.warn('获取Python代码预览失败:', error);
            return '# 代码加载中...';
        }
    }

    // 绑定代码节点特有的事件
    bindEvents() {
        super.bindEvents();

        // 编辑按钮事件
        const editBtn = this.element.querySelector('.code-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openCodeEditor();
            });
        }
    }

    // 双击打开代码编辑器
    onDoubleClick(e) {
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
        console.log('Python代码节点双击，打开编辑器');
        this.openCodeEditor();
    }

    openCodeEditor() {
        console.log('Python代码节点：开始打开代码编辑器');
        console.log('当前节点状态:', { id: this.id, type: this.type, config: this.config });
        console.log('CodeEditorWindow是否可用:', typeof window.CodeEditorWindow);

        if (this.codeEditor) {
            console.log('编辑器已存在，聚焦窗口');
            if (this.codeEditor.show) {
                this.codeEditor.show();
            }
            return;
        }

        try {
            console.log('创建新的Python代码编辑器窗口');

            // 检查CodeEditorWindow是否可用
            if (typeof window.CodeEditorWindow === 'undefined') {
                throw new Error('CodeEditorWindow 类未加载');
            }

            // 创建代码编辑器窗口
            this.codeEditor = new window.CodeEditorWindow({
                id: `py-editor-${this.id}`,
                title: `Python代码节点 - ${this.id}`,
                language: 'python',
                position: { x: 120, y: 120 },
                size: { width: 800, height: 600 }
            });

            console.log('Python代码编辑器窗口已创建:', this.codeEditor);

            // 显示窗口
            this.codeEditor.show();

            // 设置代码内容
            setTimeout(() => {
                if (this.codeEditor.editor) {
                    const defaultConfig = this.getDefaultConfig();
                    const defaultCode = this.config.code || defaultConfig.code;
                    this.codeEditor.editor.setValue(defaultCode);
                    console.log('Python代码内容已设置到编辑器');
                }
            }, 1000);

            // 监听代码保存
            this.codeEditor.onSave = (code) => {
                console.log('保存Python代码到节点:', code.substring(0, 50) + '...');
                this.config.code = code;
                this.saveNodeData();
                this.updateCodePreview();
            };

            // 监听窗口关闭
            this.codeEditor.onClose = () => {
                console.log('Python代码编辑器窗口已关闭');
                this.codeEditor = null;
            };

            Utils.showNotification('Python代码编辑器已打开', 'success');

        } catch (error) {
            console.error('创建Python代码编辑器失败:', error);
            console.error('错误详情:', error.stack);
            Utils.showNotification('打开Python代码编辑器失败: ' + error.message, 'error');
        }
    }

    // 更新代码预览
    updateCodePreview() {
        if (this.element) {
            const previewContent = this.element.querySelector('.code-preview-content');
            const linesCount = this.element.querySelector('.code-lines');

            if (previewContent) {
                previewContent.textContent = this.getCodePreview();
            }
            if (linesCount) {
                linesCount.textContent = this.getCodeLineCount() + ' 行';
            }
        }
    }

    saveNodeData() {
        // 保存节点数据到工作流
        if (window.workflowManager && window.workflowManager.saveWorkflow) {
            window.workflowManager.saveWorkflow();
        }
    }
}

/*
=== 节点类型规划 ===

1. 代码节点 (已实现)
   - JavaScriptCode: JavaScript代码执行
   - PythonCode: Python代码执行

2. API服务节点 (规划中)
   - RestAPINode: REST API调用节点
   - GraphQLNode: GraphQL查询节点
   - WebhookNode: Webhook接收节点

3. MCP服务节点 (规划中)
   - MCPClientNode: MCP客户端连接节点
   - MCPToolNode: MCP工具调用节点
   - MCPResourceNode: MCP资源访问节点

4. IoT设备节点 (规划中)
   - MQTTNode: MQTT消息节点
   - SerialNode: 串口通信节点
   - HTTPIoTNode: HTTP IoT设备节点

5. Agent节点 (规划中)
   - LLMAgentNode: 大语言模型Agent节点
   - WorkflowBuilderNode: 工作流构建Agent节点
   - CodeGeneratorNode: 代码生成Agent节点

每个节点类型都应该包含：
- 配置UI界面
- 执行逻辑
- 输入/输出定义
- 错误处理
- 状态管理
*/

// 基础配置节点类（为未来的复杂节点提供基础）
class ConfigurableNode extends WorkflowNode {
    constructor(type, data = {}) {
        super(type, data);
        this.configDialog = null;
    }

    // 打开配置对话框
    openConfigDialog() {
        if (this.configDialog) {
            this.configDialog.focus();
            return;
        }

        this.createConfigDialog();
    }

    // 创建配置对话框（子类重写）
    createConfigDialog() {
        console.log('配置对话框需要在子类中实现');
    }

    // 双击打开配置
    onDoubleClick() {
        this.openConfigDialog();
    }
}

// 注册节点类型的函数
function registerAllNodeTypes() {
    if (window.workflowManager && window.workflowManager.registerNodeType) {
        console.log('开始注册所有节点类型...');

        window.workflowManager.registerNodeType('ai-chat-window', AIChatWindowNode);
        window.workflowManager.registerNodeType('url-loader', UrlLoaderNode);
        window.workflowManager.registerNodeType('file-upload', FileUploadNode);
        window.workflowManager.registerNodeType('storage-reader', StorageReaderNode);

        // 注册代码编辑器节点（需要确保相关文件已加载）
        if (window.CodeEditorNode) {
            window.workflowManager.registerNodeType('code-editor', CodeEditorNode);
        }

        // 注册代码节点
        window.workflowManager.registerNodeType('javascript-code', JavaScriptCode);
        window.workflowManager.registerNodeType('python-code', PythonCode);

        // 注册MCP服务节点
        window.workflowManager.registerNodeType('mcp-client', MCPClientNode);
        window.workflowManager.registerNodeType('mcp-tool', MCPToolNode);

        // 注册API服务节点
        window.workflowManager.registerNodeType('rest-api', RestAPINode);
        window.workflowManager.registerNodeType('webhook', WebhookNode);

        // 注册IoT设备节点
        window.workflowManager.registerNodeType('mqtt-client', MQTTClientNode);
        window.workflowManager.registerNodeType('modbus-client', ModbusClientNode);

        // 注册浏览器节点
        window.workflowManager.registerNodeType('web-browser', BrowserNode);

        console.log('所有节点类型已注册到工作流管理器');
        console.log('已注册的节点类型:', Array.from(window.workflowManager.customNodeTypes.keys()));
    } else {
        console.log('工作流管理器未就绪，稍后重试注册...');
        setTimeout(registerAllNodeTypes, 100);
    }
}

// 立即尝试注册，如果失败则等待
registerAllNodeTypes();

/*
=== MCP服务节点类 ===
Model Context Protocol 服务集成节点
*/

// MCP客户端连接节点
class MCPClientNode extends WorkflowNode {
    constructor(type, data = {}) {
        super(type, data);
        this.mcpClient = null;
        this.connectionStatus = 'disconnected';
    }

    getDefaultConfig() {
        return {
            serverUrl: 'ws://localhost:8080/mcp',
            serverType: 'websocket', // websocket, stdio, sse
            authentication: {
                type: 'none', // none, bearer, apikey, oauth
                token: '',
                apiKey: '',
                clientId: '',
                clientSecret: ''
            },
            capabilities: ['tools', 'resources', 'prompts'],
            autoConnect: true,
            reconnectInterval: 5000,
            timeout: 30000
        };
    }

    getNodeInfo() {
        return {
            title: 'MCP客户端',
            icon: 'fas fa-plug',
            description: '连接到MCP服务器',
            inputs: ['trigger'],
            outputs: ['connection', 'error']
        };
    }

    async execute(inputs) {
        try {
            if (!this.mcpClient || this.connectionStatus !== 'connected') {
                await this.connectToMCPServer();
            }

            return {
                connection: {
                    status: this.connectionStatus,
                    capabilities: this.config.capabilities,
                    serverInfo: this.mcpClient?.serverInfo || null
                }
            };
        } catch (error) {
            console.error('MCP客户端执行失败:', error);
            return { error: error.message };
        }
    }

    async connectToMCPServer() {
        // MCP连接逻辑实现
        this.connectionStatus = 'connecting';

        // 模拟连接过程
        await new Promise(resolve => setTimeout(resolve, 1000));

        this.connectionStatus = 'connected';
        this.mcpClient = {
            serverInfo: {
                name: 'MCP Server',
                version: '1.0.0'
            }
        };
    }

    onDoubleClick() {
        this.openConfigEditor();
    }

    openConfigEditor() {
        if (this.configEditor) {
            this.configEditor.show();
            return;
        }

        this.configEditor = new CodeEditorWindow({
            id: `mcp-config-${this.id}`,
            title: `MCP客户端配置 - ${this.id}`,
            language: 'json',
            position: { x: 150, y: 150 },
            size: { width: 600, height: 500 }
        });

        this.configEditor.show();

        setTimeout(() => {
            if (this.configEditor.editor) {
                this.configEditor.editor.setValue(JSON.stringify(this.config, null, 2));
            }
        }, 1000);

        this.configEditor.onSave = (configText) => {
            try {
                this.config = JSON.parse(configText);
                this.saveNodeData();
                Utils.showNotification('MCP配置已保存', 'success');
            } catch (error) {
                Utils.showNotification('配置格式错误: ' + error.message, 'error');
            }
        };

        this.configEditor.onClose = () => {
            this.configEditor = null;
        };
    }
}

// MCP工具调用节点
class MCPToolNode extends WorkflowNode {
    constructor(type, data = {}) {
        super(type, data);
    }

    getDefaultConfig() {
        return {
            toolName: '',
            parameters: {},
            mcpClientId: '', // 关联的MCP客户端节点ID
            timeout: 30000,
            retryCount: 3
        };
    }

    getNodeInfo() {
        return {
            title: 'MCP工具调用',
            icon: 'fas fa-tools',
            description: '调用MCP服务器提供的工具',
            inputs: ['input', 'mcpConnection'],
            outputs: ['result', 'error']
        };
    }

    async execute(inputs) {
        try {
            const mcpConnection = inputs.mcpConnection;
            if (!mcpConnection || mcpConnection.status !== 'connected') {
                throw new Error('MCP连接不可用');
            }

            // 调用MCP工具
            const result = await this.callMCPTool(inputs.input);

            return { result };
        } catch (error) {
            console.error('MCP工具调用失败:', error);
            return { error: error.message };
        }
    }

    async callMCPTool(input) {
        // MCP工具调用逻辑
        return {
            toolName: this.config.toolName,
            input: input,
            output: `工具 ${this.config.toolName} 执行结果`,
            timestamp: new Date().toISOString()
        };
    }

    onDoubleClick() {
        this.openConfigEditor();
    }

    openConfigEditor() {
        // 复用MCP客户端的配置编辑器逻辑
        if (this.configEditor) {
            this.configEditor.show();
            return;
        }

        this.configEditor = new CodeEditorWindow({
            id: `mcp-tool-config-${this.id}`,
            title: `MCP工具配置 - ${this.id}`,
            language: 'json',
            position: { x: 170, y: 170 },
            size: { width: 600, height: 500 }
        });

        this.configEditor.show();

        setTimeout(() => {
            if (this.configEditor.editor) {
                this.configEditor.editor.setValue(JSON.stringify(this.config, null, 2));
            }
        }, 1000);

        this.configEditor.onSave = (configText) => {
            try {
                this.config = JSON.parse(configText);
                this.saveNodeData();
                Utils.showNotification('MCP工具配置已保存', 'success');
            } catch (error) {
                Utils.showNotification('配置格式错误: ' + error.message, 'error');
            }
        };

        this.configEditor.onClose = () => {
            this.configEditor = null;
        };
    }
}

/*
=== API服务节点类 ===
RESTful API和Web服务集成节点
*/

// REST API调用节点
class RestAPINode extends WorkflowNode {
    constructor(type, data = {}) {
        super(type, data);
    }

    getDefaultConfig() {
        return {
            url: '',
            method: 'GET', // GET, POST, PUT, DELETE, PATCH
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'AI-Workflow-Agent/1.0'
            },
            authentication: {
                type: 'none', // none, bearer, basic, apikey
                token: '',
                username: '',
                password: '',
                apiKey: '',
                apiKeyHeader: 'X-API-Key'
            },
            timeout: 30000,
            retryCount: 3,
            retryDelay: 1000,
            validateSSL: true,
            followRedirects: true,
            maxRedirects: 5
        };
    }

    getNodeInfo() {
        return {
            title: 'REST API',
            icon: 'fas fa-cloud',
            description: 'REST API调用',
            inputs: ['data', 'trigger'],
            outputs: ['response', 'error']
        };
    }

    async execute(inputs) {
        try {
            const requestData = inputs.data || {};
            const response = await this.makeAPIRequest(requestData);

            return { response };
        } catch (error) {
            console.error('REST API调用失败:', error);
            return { error: error.message };
        }
    }

    async makeAPIRequest(data) {
        const config = this.config;
        const requestOptions = {
            method: config.method,
            headers: { ...config.headers }
        };

        // 添加认证
        if (config.authentication.type === 'bearer') {
            requestOptions.headers['Authorization'] = `Bearer ${config.authentication.token}`;
        } else if (config.authentication.type === 'basic') {
            const credentials = btoa(`${config.authentication.username}:${config.authentication.password}`);
            requestOptions.headers['Authorization'] = `Basic ${credentials}`;
        } else if (config.authentication.type === 'apikey') {
            requestOptions.headers[config.authentication.apiKeyHeader] = config.authentication.apiKey;
        }

        // 添加请求体
        if (['POST', 'PUT', 'PATCH'].includes(config.method) && data) {
            requestOptions.body = JSON.stringify(data);
        }

        const response = await fetch(config.url, requestOptions);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return await response.text();
        }
    }

    onDoubleClick() {
        this.openConfigEditor();
    }

    openConfigEditor() {
        if (this.configEditor) {
            this.configEditor.show();
            return;
        }

        this.configEditor = new CodeEditorWindow({
            id: `rest-api-config-${this.id}`,
            title: `REST API配置 - ${this.id}`,
            language: 'json',
            position: { x: 200, y: 200 },
            size: { width: 700, height: 600 }
        });

        this.configEditor.show();

        setTimeout(() => {
            if (this.configEditor.editor) {
                this.configEditor.editor.setValue(JSON.stringify(this.config, null, 2));
            }
        }, 1000);

        this.configEditor.onSave = (configText) => {
            try {
                this.config = JSON.parse(configText);
                this.saveNodeData();
                Utils.showNotification('REST API配置已保存', 'success');
            } catch (error) {
                Utils.showNotification('配置格式错误: ' + error.message, 'error');
            }
        };

        this.configEditor.onClose = () => {
            this.configEditor = null;
        };
    }
}

// Webhook接收节点
class WebhookNode extends WorkflowNode {
    constructor(type, data = {}) {
        super(type, data);
        this.webhookServer = null;
        this.isListening = false;
    }

    getDefaultConfig() {
        return {
            port: 3000,
            path: '/webhook',
            method: 'POST', // GET, POST, PUT, DELETE
            authentication: {
                type: 'none', // none, secret, signature
                secret: '',
                signatureHeader: 'X-Hub-Signature-256'
            },
            responseMessage: 'OK',
            responseStatus: 200,
            autoStart: true,
            cors: {
                enabled: true,
                origins: ['*']
            }
        };
    }

    getNodeInfo() {
        return {
            title: 'Webhook接收器',
            icon: 'fas fa-satellite-dish',
            description: '接收Webhook请求',
            inputs: ['trigger'],
            outputs: ['payload', 'headers', 'error']
        };
    }

    async execute(inputs) {
        try {
            if (!this.isListening && this.config.autoStart) {
                await this.startWebhookServer();
            }

            return {
                status: this.isListening ? 'listening' : 'stopped',
                endpoint: `http://localhost:${this.config.port}${this.config.path}`
            };
        } catch (error) {
            console.error('Webhook服务器启动失败:', error);
            return { error: error.message };
        }
    }

    async startWebhookServer() {
        // Webhook服务器启动逻辑（模拟）
        this.isListening = true;
        console.log(`Webhook服务器已启动: http://localhost:${this.config.port}${this.config.path}`);
    }

    stopWebhookServer() {
        this.isListening = false;
        console.log('Webhook服务器已停止');
    }

    onDoubleClick() {
        this.openConfigEditor();
    }

    openConfigEditor() {
        if (this.configEditor) {
            this.configEditor.show();
            return;
        }

        this.configEditor = new CodeEditorWindow({
            id: `webhook-config-${this.id}`,
            title: `Webhook配置 - ${this.id}`,
            language: 'json',
            position: { x: 220, y: 220 },
            size: { width: 600, height: 500 }
        });

        this.configEditor.show();

        setTimeout(() => {
            if (this.configEditor.editor) {
                this.configEditor.editor.setValue(JSON.stringify(this.config, null, 2));
            }
        }, 1000);

        this.configEditor.onSave = (configText) => {
            try {
                this.config = JSON.parse(configText);
                this.saveNodeData();
                Utils.showNotification('Webhook配置已保存', 'success');
            } catch (error) {
                Utils.showNotification('配置格式错误: ' + error.message, 'error');
            }
        };

        this.configEditor.onClose = () => {
            this.configEditor = null;
        };
    }
}

/*
=== IoT设备节点类 ===
物联网设备通信和控制节点
*/

// MQTT客户端节点
class MQTTClientNode extends WorkflowNode {
    constructor(type, data = {}) {
        super(type, data);
        this.mqttClient = null;
        this.connectionStatus = 'disconnected';
    }

    getDefaultConfig() {
        return {
            broker: {
                host: 'localhost',
                port: 1883,
                protocol: 'mqtt', // mqtt, mqtts, ws, wss
                clientId: `mqtt_client_${Date.now()}`
            },
            authentication: {
                username: '',
                password: ''
            },
            topics: {
                subscribe: ['sensors/+/data', 'devices/+/status'],
                publish: 'commands/device'
            },
            qos: 1, // 0, 1, 2
            retain: false,
            keepAlive: 60,
            cleanSession: true,
            autoReconnect: true,
            reconnectPeriod: 1000,
            connectTimeout: 30000
        };
    }

    getNodeInfo() {
        return {
            title: 'MQTT客户端',
            icon: 'fas fa-broadcast-tower',
            description: 'MQTT消息发布/订阅',
            inputs: ['message', 'topic', 'trigger'],
            outputs: ['received', 'published', 'status', 'error']
        };
    }

    async execute(inputs) {
        try {
            if (!this.mqttClient || this.connectionStatus !== 'connected') {
                await this.connectToMQTTBroker();
            }

            if (inputs.message && inputs.topic) {
                // 发布消息
                await this.publishMessage(inputs.topic, inputs.message);
                return { published: { topic: inputs.topic, message: inputs.message } };
            }

            return {
                status: this.connectionStatus,
                subscribedTopics: this.config.topics.subscribe
            };
        } catch (error) {
            console.error('MQTT操作失败:', error);
            return { error: error.message };
        }
    }

    async connectToMQTTBroker() {
        this.connectionStatus = 'connecting';

        // 模拟MQTT连接
        await new Promise(resolve => setTimeout(resolve, 1000));

        this.connectionStatus = 'connected';
        this.mqttClient = {
            connected: true,
            subscriptions: this.config.topics.subscribe
        };

        console.log(`MQTT客户端已连接到 ${this.config.broker.host}:${this.config.broker.port}`);
    }

    async publishMessage(topic, message) {
        if (!this.mqttClient || this.connectionStatus !== 'connected') {
            throw new Error('MQTT客户端未连接');
        }

        console.log(`发布MQTT消息到主题 ${topic}:`, message);
        // 实际的MQTT发布逻辑
    }

    onDoubleClick() {
        this.openConfigEditor();
    }

    openConfigEditor() {
        if (this.configEditor) {
            this.configEditor.show();
            return;
        }

        this.configEditor = new CodeEditorWindow({
            id: `mqtt-config-${this.id}`,
            title: `MQTT配置 - ${this.id}`,
            language: 'json',
            position: { x: 250, y: 250 },
            size: { width: 700, height: 600 }
        });

        this.configEditor.show();

        setTimeout(() => {
            if (this.configEditor.editor) {
                this.configEditor.editor.setValue(JSON.stringify(this.config, null, 2));
            }
        }, 1000);

        this.configEditor.onSave = (configText) => {
            try {
                this.config = JSON.parse(configText);
                this.saveNodeData();
                Utils.showNotification('MQTT配置已保存', 'success');
            } catch (error) {
                Utils.showNotification('配置格式错误: ' + error.message, 'error');
            }
        };

        this.configEditor.onClose = () => {
            this.configEditor = null;
        };
    }
}

// Modbus客户端节点
class ModbusClientNode extends WorkflowNode {
    constructor(type, data = {}) {
        super(type, data);
        this.modbusClient = null;
        this.connectionStatus = 'disconnected';
    }

    getDefaultConfig() {
        return {
            connection: {
                type: 'tcp', // tcp, rtu, ascii
                host: '192.168.1.100',
                port: 502,
                serialPort: '/dev/ttyUSB0',
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: 'none'
            },
            device: {
                unitId: 1,
                timeout: 5000,
                retryCount: 3
            },
            registers: {
                coils: { start: 0, count: 10 },
                discreteInputs: { start: 0, count: 10 },
                holdingRegisters: { start: 0, count: 10 },
                inputRegisters: { start: 0, count: 10 }
            },
            polling: {
                enabled: false,
                interval: 1000
            }
        };
    }

    getNodeInfo() {
        return {
            title: 'Modbus客户端',
            icon: 'fas fa-industry',
            description: 'Modbus设备通信',
            inputs: ['command', 'address', 'value', 'trigger'],
            outputs: ['data', 'status', 'error']
        };
    }

    async execute(inputs) {
        try {
            if (!this.modbusClient || this.connectionStatus !== 'connected') {
                await this.connectToModbusDevice();
            }

            if (inputs.command) {
                const result = await this.executeModbusCommand(inputs.command, inputs.address, inputs.value);
                return { data: result };
            }

            return {
                status: this.connectionStatus,
                deviceInfo: {
                    unitId: this.config.device.unitId,
                    connection: this.config.connection.type
                }
            };
        } catch (error) {
            console.error('Modbus操作失败:', error);
            return { error: error.message };
        }
    }

    async connectToModbusDevice() {
        this.connectionStatus = 'connecting';

        // 模拟Modbus连接
        await new Promise(resolve => setTimeout(resolve, 1000));

        this.connectionStatus = 'connected';
        this.modbusClient = {
            connected: true,
            unitId: this.config.device.unitId
        };

        console.log(`Modbus客户端已连接到设备 ${this.config.connection.host}:${this.config.connection.port}`);
    }

    async executeModbusCommand(command, address, value) {
        if (!this.modbusClient || this.connectionStatus !== 'connected') {
            throw new Error('Modbus客户端未连接');
        }

        console.log(`执行Modbus命令: ${command}, 地址: ${address}, 值: ${value}`);

        // 模拟Modbus操作结果
        return {
            command,
            address,
            value: command.includes('read') ? Math.random() * 100 : value,
            timestamp: new Date().toISOString()
        };
    }

    onDoubleClick() {
        this.openConfigEditor();
    }

    openConfigEditor() {
        if (this.configEditor) {
            this.configEditor.show();
            return;
        }

        this.configEditor = new CodeEditorWindow({
            id: `modbus-config-${this.id}`,
            title: `Modbus配置 - ${this.id}`,
            language: 'json',
            position: { x: 270, y: 270 },
            size: { width: 700, height: 600 }
        });

        this.configEditor.show();

        setTimeout(() => {
            if (this.configEditor.editor) {
                this.configEditor.editor.setValue(JSON.stringify(this.config, null, 2));
            }
        }, 1000);

        this.configEditor.onSave = (configText) => {
            try {
                this.config = JSON.parse(configText);
                this.saveNodeData();
                Utils.showNotification('Modbus配置已保存', 'success');
            } catch (error) {
                Utils.showNotification('配置格式错误: ' + error.message, 'error');
            }
        };

        this.configEditor.onClose = () => {
            this.configEditor = null;
        };
    }
}

// 导出所有节点类到全局作用域
if (typeof window !== 'undefined') {
    window.WorkflowNode = WorkflowNode;
    window.JavaScriptCode = JavaScriptCode;
    window.PythonCode = PythonCode;
    window.ConfigurableNode = ConfigurableNode;
    window.MCPClientNode = MCPClientNode;
    window.MCPToolNode = MCPToolNode;
    window.RestAPINode = RestAPINode;
    window.WebhookNode = WebhookNode;
    window.MQTTClientNode = MQTTClientNode;
    window.ModbusClientNode = ModbusClientNode;
    window.BrowserNode = BrowserNode;
    console.log('所有节点类已导出到全局作用域');
}
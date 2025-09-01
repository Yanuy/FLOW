// 增强型全局存储管理系统（原变量管理系统升级版）
class StorageManager {
    constructor() {
        this.globalVariables = new Map(); // 全局共享存储
        this.nodeVariables = new Map();   // 节点级存储配置
        this.executionContext = new Map(); // 执行上下文存储
        this.variableHistory = new Map();  // 存储历史记录
        this.subscribers = new Map();      // 存储订阅者

        // 新增：增强存储功能
        this.memoryCache = new Map();      // 内存缓存
        this.cacheConfig = {
            maxMemorySize: 100 * 1024 * 1024, // 100MB内存缓存
            currentMemoryUsage: 0,
            evictionPolicy: 'lru'
        };
        this.accessQueue = new Set();      // LRU访问队列
        this.db = null;                    // IndexedDB实例

        this.initializeVariableTypes();
        this.initializeEnhancedStorage();
    }

    // 初始化存储类型定义（支持多媒体）
    initializeVariableTypes() {
        this.variableTypes = {
            string: {
                name: '字符串',
                defaultValue: '',
                validator: (value) => typeof value === 'string',
                parser: (value) => String(value || ''),
                storage: 'auto'
            },
            number: {
                name: '数字',
                defaultValue: 0,
                validator: (value) => !isNaN(parseFloat(value)),
                parser: (value) => parseFloat(value) || 0,
                storage: 'auto'
            },
            boolean: {
                name: '布尔值',
                defaultValue: false,
                validator: (value) => typeof value === 'boolean' || ['true', 'false', '1', '0'].includes(String(value).toLowerCase()),
                parser: (value) => {
                    if (typeof value === 'boolean') return value;
                    const str = String(value).toLowerCase();
                    return str === 'true' || str === '1';
                },
                storage: 'auto'
            },
            object: {
                name: '对象',
                defaultValue: {},
                validator: (value) => {
                    try {
                        if (typeof value === 'object') return true;
                        JSON.parse(value);
                        return true;
                    } catch {
                        return false;
                    }
                },
                parser: (value) => {
                    if (typeof value === 'object') return value;
                    try {
                        return JSON.parse(value);
                    } catch {
                        return {};
                    }
                },
                storage: 'auto'
            },
            array: {
                name: '数组',
                defaultValue: [],
                validator: (value) => {
                    try {
                        if (Array.isArray(value)) return true;
                        const parsed = JSON.parse(value);
                        return Array.isArray(parsed);
                    } catch {
                        return false;
                    }
                },
                parser: (value) => {
                    if (Array.isArray(value)) return value;
                    try {
                        const parsed = JSON.parse(value);
                        return Array.isArray(parsed) ? parsed : [];
                    } catch {
                        return [];
                    }
                },
                storage: 'auto'
            },
            // 新增多媒体类型
            image: {
                name: '图片',
                defaultValue: null,
                maxSize: 50 * 1024 * 1024, // 50MB
                supportedMimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'],
                supportedFormats: ['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg', 'bmp'],
                validator: (value) => value instanceof Blob || value instanceof File || typeof value === 'string',
                parser: (value) => value, // 直接返回，不转换
                storage: 'indexeddb'
            },
            audio: {
                name: '音频',
                defaultValue: null,
                maxSize: 100 * 1024 * 1024, // 100MB
                supportedMimes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac'],
                supportedFormats: ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'aac'],
                validator: (value) => value instanceof Blob || value instanceof File || typeof value === 'string',
                parser: (value) => value, // 直接返回，不转换
                storage: 'indexeddb'
            },
            video: {
                name: '视频',
                defaultValue: null,
                maxSize: 500 * 1024 * 1024, // 500MB
                supportedMimes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'],
                supportedFormats: ['mp4', 'webm', 'ogg', 'mov', 'avi'],
                validator: (value) => value instanceof Blob || value instanceof File || typeof value === 'string',
                parser: (value) => value, // 直接返回，不转换
                storage: 'indexeddb'
            },
            document: {
                name: '文档',
                defaultValue: null,
                maxSize: 20 * 1024 * 1024, // 20MB
                supportedMimes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
                supportedFormats: ['pdf', 'doc', 'docx', 'txt'],
                validator: (value) => value instanceof Blob || value instanceof File || typeof value === 'string',
                parser: (value) => value, // 直接返回，不转换
                storage: 'indexeddb'
            },
            largeText: {
                name: '大文本',
                defaultValue: '',
                maxSize: 50 * 1024 * 1024, // 50MB
                validator: (value) => typeof value === 'string',
                parser: (value) => String(value || ''),
                storage: 'indexeddb'
            }
        };
    }

    // 初始化增强存储系统
    async initializeEnhancedStorage() {
        try {
            // 检查浏览器支持
            if ('indexedDB' in window) {
                this.db = await this.openIndexedDB();
                console.log('[存储管理] IndexedDB 初始化成功');
            } else {
                console.warn('[存储管理] 浏览器不支持 IndexedDB，回退到基础模式');
            }
        } catch (error) {
            console.error('[存储管理] IndexedDB 初始化失败:', error);
        }
    }

    // 开启IndexedDB
    async openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AI_Workflow_Storage', 3);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建存储数据表
                if (!db.objectStoreNames.contains('storage_items')) {
                    const store = db.createObjectStore('storage_items', { keyPath: 'name' });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('size', 'size', { unique: false });
                    store.createIndex('created', 'created', { unique: false });
                }

                // 创建媒体文件表
                if (!db.objectStoreNames.contains('media_files')) {
                    const mediaStore = db.createObjectStore('media_files', { keyPath: 'id' });
                    mediaStore.createIndex('itemName', 'itemName', { unique: false });
                    mediaStore.createIndex('type', 'type', { unique: false });
                    mediaStore.createIndex('mimeType', 'mimeType', { unique: false });
                }
            };
        });
    }

    // 智能存储策略决策
    getStorageStrategy(type, size = 0) {
        const typeConfig = this.variableTypes[type];

        // 多媒体类型强制使用IndexedDB
        if (typeConfig && typeConfig.storage === 'indexeddb') {
            return 'indexeddb';
        }

        // 根据大小自动选择
        if (size > 1024 * 1024) { // > 1MB
            return 'indexeddb';
        } else if (size > 1024) { // > 1KB
            return 'sessionStorage';
        } else {
            return 'localStorage';
        }
    }

    // 计算数据大小
    calculateDataSize(value, type) {
        if (value instanceof Blob || value instanceof File) {
            return value.size;
        }

        if (typeof value === 'string') {
            return new Blob([value]).size;
        }

        try {
            return new Blob([JSON.stringify(value)]).size;
        } catch {
            return 0;
        }
    }

    // 格式化文件大小显示
    formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 创建增强存储项（支持多媒体）
    async createStorageItem(name, type, value, options = {}) {
        const {
            description = '',
            popupConfig = null,
            metadata = {},
            compression = true
        } = options;

        // 验证名称
        name = this.validateVariableName(name);

        // 计算数据大小
        const size = this.calculateDataSize(value, type);
        const strategy = this.getStorageStrategy(type, size);

        // 验证大小限制
        const typeConfig = this.variableTypes[type];
        if (typeConfig && typeConfig.maxSize && size > typeConfig.maxSize) {
            throw new Error(`${typeConfig.name}数据超过大小限制: ${this.formatSize(size)} > ${this.formatSize(typeConfig.maxSize)}`);
        }

        const storageItem = {
            name,
            type,
            size,
            storage: strategy,
            description,
            metadata,
            compression,
            created: new Date(),
            updated: new Date(),
            readonly: false,
            scope: 'global',
            popupConfig: popupConfig || {
                inputPopup: false,
                outputPopup: false,
                timeout: 20000
            }
        };

        // 根据策略存储数据
        await this.storeItemData(storageItem, value);

        // 为了兼容性，也在存储项中保存值的引用
        // 注意：对于大文件，这里存储的是引用信息，实际数据在IndexedDB中
        if (strategy === 'indexeddb' && (value instanceof Blob || value instanceof File)) {
            // 对于文件类型，存储文件信息而不是直接值
            storageItem.value = {
                type: 'file',
                name: value.name || name,
                size: value.size,
                mimeType: value.type || 'application/octet-stream'
            };
        } else if (strategy === 'localStorage' || strategy === 'sessionStorage') {
            // 对于小数据，直接存储值
            storageItem.value = value;
        } else {
            // 对于IndexedDB的其他数据，存储引用信息
            storageItem.value = `[IndexedDB:${name}]`;
        }

        // 在内存中保存元数据
        this.globalVariables.set(name, storageItem);

        console.log(`[存储管理] 创建存储项: ${name} (${type}, ${this.formatSize(size)}, ${strategy})`);

        // 保存到本地存储
        this.saveToStorage();

        this.notifySubscribers(name, 'created', storageItem);
        return storageItem;
    }

    // 存储数据到不同存储后端
    async storeItemData(storageItem, value) {
        const { name, type, storage, compression } = storageItem;

        switch (storage) {
            case 'localStorage':
                localStorage.setItem(`storage_${name}`, JSON.stringify(value));
                break;

            case 'sessionStorage':
                sessionStorage.setItem(`storage_${name}`, JSON.stringify(value));
                break;

            case 'indexeddb':
                if (this.db) {
                    await this.storeInIndexedDB(name, value, type, compression);
                } else {
                    // 回退到localStorage
                    localStorage.setItem(`storage_${name}`, JSON.stringify(value));
                    storageItem.storage = 'localStorage';
                }
                break;
        }
    }

    // IndexedDB存储
    async storeInIndexedDB(name, value, type, compression = true) {
        if (!this.db) {
            throw new Error('IndexedDB未初始化');
        }

        try {
            let processedValue = value;
            let mediaId = null;

            // 媒体文件特殊处理
            if (this.variableTypes[type] && this.variableTypes[type].storage === 'indexeddb') {
                if (value instanceof Blob || value instanceof File) {
                    // 先存储媒体文件到独立事务
                    mediaId = `${name}_${Date.now()}`;
                    await this.storeMediaFile(mediaId, name, value, type);

                    // 创建媒体引用对象
                    processedValue = {
                        mediaId,
                        type: 'mediaReference',
                        originalName: value.name || name,
                        mimeType: value.type || 'application/octet-stream',
                        size: value.size
                    };
                }
            }

            // 大文本压缩
            if (compression && typeof processedValue === 'string' && processedValue.length > 1024) {
                processedValue = await this.compressText(processedValue);
            }

            // 创建独立事务存储数据项元数据
            const transaction = this.db.transaction(['storage_items'], 'readwrite');
            const store = transaction.objectStore('storage_items');

            const dataItem = {
                name,
                value: processedValue,
                type,
                compression,
                stored: new Date()
            };

            await store.put(dataItem);

            // 等待事务完成
            await this.waitForTransaction(transaction);

            console.log(`[存储管理] IndexedDB存储成功: ${name} (${type})`);

        } catch (error) {
            console.error('[存储管理] IndexedDB存储失败:', error);
            throw error;
        }
    }

    // 等待IndexedDB事务完成的辅助方法
    async waitForTransaction(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                console.log('[存储管理] 事务成功完成');
                resolve();
            };
            transaction.onerror = (event) => {
                console.error('[存储管理] 事务错误:', event);
                reject(transaction.error);
            };
            transaction.onabort = (event) => {
                console.error('[存储管理] 事务中止:', event);
                reject(new Error('Transaction aborted'));
            };
        });
    }

    // 存储媒体文件
    async storeMediaFile(mediaId, itemName, blob, type) {
        if (!this.db) {
            throw new Error('IndexedDB未初始化');
        }

        try {
            // 可选择压缩媒体文件
            let processedBlob = blob;
            if (type === 'image' && blob.size > 1024 * 1024) {
                try {
                    processedBlob = await this.compressImage(blob);
                    console.log(`[存储管理] 图片压缩: ${blob.size} -> ${processedBlob.size} bytes`);
                } catch (error) {
                    console.warn('[存储管理] 图片压缩失败，使用原始文件:', error);
                }
            }

            // 创建独立的媒体文件存储事务
            const transaction = this.db.transaction(['media_files'], 'readwrite');
            const store = transaction.objectStore('media_files');

            const mediaItem = {
                id: mediaId,
                itemName,
                type,
                data: processedBlob,
                mimeType: blob.type || 'application/octet-stream',
                originalSize: blob.size,
                compressedSize: processedBlob.size,
                stored: new Date()
            };

            await store.put(mediaItem);

            // 等待事务完成
            await this.waitForTransaction(transaction);

            console.log(`[存储管理] 媒体文件存储完成: ${mediaId} (${type}, ${this.formatSize(processedBlob.size)})`);
            return mediaId;

        } catch (error) {
            console.error('[存储管理] 媒体文件存储失败:', error);
            throw error;
        }
    }

    // 文本压缩
    async compressText(text) {
        // 使用浏览器原生CompressionStream API（如果支持）
        if ('CompressionStream' in window) {
            try {
                const stream = new CompressionStream('gzip');
                const writer = stream.writable.getWriter();
                const reader = stream.readable.getReader();

                writer.write(new TextEncoder().encode(text));
                writer.close();

                const chunks = [];
                let done = false;

                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) chunks.push(value);
                }

                return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
            } catch (error) {
                console.warn('[存储管理] 文本压缩失败:', error);
                return text;
            }
        }

        // 降级处理：返回原文本
        return text;
    }

    // 图像压缩
    async compressImage(blob) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // 计算压缩尺寸
                const maxWidth = 1920;
                const maxHeight = 1080;
                let { width, height } = img;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(resolve, 'image/jpeg', 0.8);
            };

            img.onerror = () => resolve(blob); // 压缩失败时返回原图
            img.src = URL.createObjectURL(blob);
        });
    }

    // 创建全局变量（向后兼容方法）
    createGlobalVariable(name, type = 'string', value = null, description = '', popupConfig = null) {
        if (!name || !name.trim()) {
            throw new Error('变量名不能为空');
        }

        if (!this.variableTypes[type]) {
            throw new Error(`不支持的变量类型: ${type}`);
        }

        const variable = {
            name: name.trim(),
            type,
            value: value !== null ? this.variableTypes[type].parser(value) : this.variableTypes[type].defaultValue,
            description: description || '',
            created: new Date(),
            updated: new Date(),
            readonly: false,
            scope: 'global',
            // 新增弹窗配置
            popupConfig: popupConfig || {
                inputPopup: false,      // 输入时是否弹窗
                outputPopup: false,     // 输出时是否弹窗（审核）
                timeout: 20000          // 弹窗超时时间（毫秒）
            }
        };

        this.globalVariables.set(variable.name, variable);
        this.notifySubscribers(variable.name, 'created', variable);

        console.log(`[变量管理] 创建全局变量: ${variable.name} = ${JSON.stringify(variable.value)}`);
        return variable;
    }

    // 更新全局变量
    updateGlobalVariable(name, value, updateDescription = false, description = '', isFromPopup = false) {
        const variable = this.globalVariables.get(name);
        if (!variable) {
            throw new Error(`全局变量 ${name} 不存在`);
        }

        if (variable.readonly) {
            throw new Error(`全局变量 ${name} 为只读变量`);
        }

        // 保存历史记录
        this.saveVariableHistory(name, variable.value);

        // 更新变量
        const oldValue = variable.value;
        variable.value = this.variableTypes[variable.type].parser(value);
        variable.updated = new Date();

        // 标记是否来自弹窗修改
        if (isFromPopup) {
            variable.lastModifiedByPopup = true;
            // 设置一个定时器，在下次节点执行时清除这个标记
            setTimeout(() => {
                if (variable.lastModifiedByPopup === true) {
                    variable.lastModifiedByPopup = false;
                    console.log(`[变量管理] 清除弹窗修改标记: ${name}`);
                }
            }, 1000);
        }

        if (updateDescription) {
            variable.description = description;
        }

        this.notifySubscribers(name, 'updated', variable, oldValue);

        console.log(`[变量管理] 更新全局变量: ${name} = ${JSON.stringify(variable.value)}${isFromPopup ? ' (来自弹窗)' : ''}`);
        return variable;
    }

    // 删除全局变量
    deleteGlobalVariable(name) {
        const variable = this.globalVariables.get(name);
        if (!variable) {
            throw new Error(`全局变量 ${name} 不存在`);
        }

        this.globalVariables.delete(name);
        this.variableHistory.delete(name);
        this.notifySubscribers(name, 'deleted', variable);

        console.log(`[变量管理] 删除全局变量: ${name}`);
        return true;
    }

    // 获取全局变量
    getGlobalVariable(name) {
        return this.globalVariables.get(name);
    }

    // 获取全局变量值
    getGlobalVariableValue(name) {
        const variable = this.globalVariables.get(name);
        return variable ? variable.value : undefined;
    }

    // 获取所有全局变量
    getAllGlobalVariables() {
        return Array.from(this.globalVariables.values());
    }

    // 获取存储项的完整信息（包括实际数据）
    async getStorageItemWithData(name) {
        const storageItem = this.globalVariables.get(name);
        if (!storageItem) return null;

        // 创建副本以免修改原对象
        const itemWithData = { ...storageItem };

        // 如果是IndexedDB存储且没有直接值，需要从IndexedDB获取
        if (storageItem.storage === 'indexeddb' && (!storageItem.value || typeof storageItem.value === 'string')) {
            try {
                const actualValue = await this.getFromIndexedDB(name);
                if (actualValue !== null) {
                    itemWithData.value = actualValue;

                    // 更新大小信息
                    if (actualValue instanceof Blob) {
                        itemWithData.size = actualValue.size;
                        itemWithData.metadata = {
                            ...itemWithData.metadata,
                            mimeType: actualValue.type,
                            actualSize: actualValue.size
                        };
                    }
                }
            } catch (error) {
                console.warn(`[存储管理] 获取存储项 ${name} 的数据失败:`, error);
            }
        }

        return itemWithData;
    }

    // 获取所有存储项（新方法，支持多媒体类型）
    getAllStorageItems() {
        return Array.from(this.globalVariables.values());
    }

    // 配置节点变量映射
    configureNodeVariables(nodeId, inputMappings = {}, outputMappings = {}) {
        // 获取现有配置，保留自定义输入输出等信息
        const existingConfig = this.getNodeVariableConfig(nodeId);

        const nodeVars = {
            ...existingConfig,  // 保留现有配置
            nodeId,
            inputMappings,    // { 节点输入名: 全局变量名 }
            outputMappings,   // { 节点输出名: 全局变量名 }
            configured: new Date()
        };

        this.nodeVariables.set(nodeId, nodeVars);
        console.log(`[变量管理] 配置节点 ${nodeId} 变量映射:`, nodeVars);
        return nodeVars;
    }

    // 获取节点变量配置
    getNodeVariableConfig(nodeId) {
        return this.nodeVariables.get(nodeId) || {
            nodeId,
            inputMappings: {},
            outputMappings: {}
        };
    }

    // 为节点设置输入变量
    setNodeInputVariable(nodeId, inputName, variableName) {
        const config = this.getNodeVariableConfig(nodeId);
        config.inputMappings[inputName] = variableName;
        this.nodeVariables.set(nodeId, config);

        console.log(`[变量管理] 节点 ${nodeId} 输入 ${inputName} 映射到变量 ${variableName}`);
    }

    // 为节点设置输出变量
    setNodeOutputVariable(nodeId, outputName, variableName) {
        const config = this.getNodeVariableConfig(nodeId);
        config.outputMappings[outputName] = variableName;
        this.nodeVariables.set(nodeId, config);

        console.log(`[变量管理] 节点 ${nodeId} 输出 ${outputName} 映射到变量 ${variableName}`);
    }

    // 解析节点输入（支持弹窗编辑）
    async resolveNodeInputs(nodeId, node) {
        const config = this.getNodeVariableConfig(nodeId);
        const resolvedInputs = {};

        console.log(`[变量管理] 开始解析节点 ${nodeId} 的输入，配置:`, config);

        // 首先获取连接传递的值和变量映射值
        const nodeInfo = node.getNodeInfo();

        // 使用for...of循环支持异步操作
        for (const inputName of nodeInfo.inputs) {
            console.log(`[变量管理] 处理输入 ${inputName}`);

            // 优先使用变量映射（从全局变量获取，可能需要弹窗）
            if (config.inputMappings[inputName]) {
                const variableName = config.inputMappings[inputName];
                let inputValue = this.getGlobalVariableValue(variableName);

                console.log(`[变量管理] 节点 ${nodeId} 输入 ${inputName} 映射到变量 ${variableName}，当前值:`, inputValue);

                // 检查是否需要弹窗编辑输入
                if (this.shouldShowInputPopup(variableName)) {
                    console.log(`[变量管理] 变量 ${variableName} 需要显示输入弹窗`);

                    try {
                        const timeout = this.getVariablePopupTimeout(variableName);
                        const result = await window.popupManager.showVariableInputPopup(
                            nodeId,
                            variableName,
                            inputValue,
                            timeout
                        );

                        if (result.action === 'confirm') {
                            inputValue = result.value;
                            // 更新全局变量值
                            this.updateGlobalVariable(variableName, inputValue);
                            console.log(`[变量管理] 用户更新了输入变量: ${variableName} = ${inputValue}`);
                        } else if (result.action === 'timeout') {
                            console.log(`[变量管理] 输入弹窗超时，使用原值: ${variableName} = ${inputValue}`);
                        }

                        // 等待一小段时间确保变量更新完成
                        await new Promise(resolve => setTimeout(resolve, 100));

                    } catch (error) {
                        console.warn(`[变量管理] 输入被取消，使用原值: ${variableName}`, error);
                    }
                } else {
                    console.log(`[变量管理] 变量 ${variableName} 不需要显示输入弹窗`);
                }

                resolvedInputs[inputName] = inputValue;
                console.log(`[变量管理] 节点 ${nodeId} 输入 ${inputName} 从全局变量 ${variableName} 获取值:`, inputValue);
            } else {
                // 如果没有变量映射，尝试使用连接输入
                const connectionValue = node.getInputValue(inputName);
                if (connectionValue !== undefined) {
                    resolvedInputs[inputName] = connectionValue;
                    console.log(`[变量管理] 节点 ${nodeId} 输入 ${inputName} 从连接获取值:`, connectionValue);
                } else {
                    // 如果都没有，使用默认值
                    resolvedInputs[inputName] = node.inputs[inputName];
                    console.log(`[变量管理] 节点 ${nodeId} 输入 ${inputName} 使用默认值:`, node.inputs[inputName]);
                }
            }
        }

        console.log(`[变量管理] 节点 ${nodeId} 输入解析完成:`, resolvedInputs);
        return resolvedInputs;
    }

    // 保存节点输出到全局变量（支持弹窗审核）
    async saveNodeOutputs(nodeId, outputs) {
        const config = this.getNodeVariableConfig(nodeId);
        const savedVariables = [];

        for (const outputName of Object.keys(config.outputMappings)) {
            const variableName = config.outputMappings[outputName];
            let outputValue = outputs[outputName];

            // 如果映射为"无输出"，跳过处理
            if (variableName === '__NO_OUTPUT__') {
                console.log(`[变量管理] 节点 ${nodeId} 输出 ${outputName} 设置为无输出，跳过保存`);
                continue;
            }

            if (outputValue !== undefined && variableName) {
                try {
                    // 应用输出解析配置
                    const parseConfig = config.outputParseConfig?.[outputName];
                    if (parseConfig && parseConfig.mode !== 'default') {
                        outputValue = this.parseOutputValue(outputValue, parseConfig);
                    }

                    // 检查是否需要弹窗审核输出
                    if (this.shouldShowOutputPopup(variableName)) {
                        try {
                            const timeout = this.getVariablePopupTimeout(variableName);
                            const result = await window.popupManager.showVariableOutputPopup(
                                nodeId,
                                variableName,
                                outputValue,
                                timeout
                            );

                            if (result.action === 'confirm') {
                                // 用户确认了弹窗中的值，使用弹窗中的值
                                outputValue = result.value;
                                console.log(`[变量管理] 用户确认了弹窗中的值: ${variableName} = ${outputValue}`);
                            } else if (result.action === 'clear') {
                                // 用户清空了值
                                outputValue = '';
                                console.log(`[变量管理] 用户清空了变量值: ${variableName}`);
                            } else if (result.action === 'skip' || result.action === 'timeout') {
                                // 用户跳过或超时，保持原值
                                console.log(`[变量管理] 输出值通过审核（跳过/超时）: ${variableName} = ${outputValue}`);
                            }
                        } catch (error) {
                            console.warn(`[变量管理] 输出审核被拒绝: ${variableName}`, error);
                            continue; // 跳过这个变量的保存
                        }
                    }

                    // 特殊处理图像数组 - 分离图像和提示词到不同变量
                    if (outputName === 'images' && Array.isArray(outputValue) && outputValue.length > 0) {
                        // 处理图像数组
                        const processedImages = await this.processImageArrayOutput(outputValue, variableName);
                        outputValue = processedImages;

                        // 提取并保存优化后的提示词到单独的变量（避免重复创建）
                        await this.extractAndSavePrompts(nodeId, outputValue, variableName);
                    }

                    // 如果变量不存在，自动创建（排除已经处理的优化提示词变量）
                    if (!this.globalVariables.has(variableName)) {
                        const type = this.inferVariableType(outputValue);
                        this.createGlobalVariable(variableName, type, outputValue, `节点 ${nodeId} 输出 ${outputName}`);
                    } else {
                        // 只有在弹窗中没有确认修改的情况下才更新变量
                        const currentVar = this.globalVariables.get(variableName);
                        if (currentVar && currentVar.lastModifiedByPopup !== true) {
                            this.updateGlobalVariable(variableName, outputValue);
                        } else {
                            console.log(`[变量管理] 跳过更新变量 ${variableName}，因为弹窗已修改`);
                        }
                    }

                    savedVariables.push({
                        name: variableName,
                        value: outputValue,
                        outputName
                    });

                    console.log(`[变量管理] 节点 ${nodeId} 输出 ${outputName} 保存到全局变量 ${variableName}:`, outputValue);
                } catch (error) {
                    console.error(`[变量管理] 保存节点输出到变量失败:`, error);
                }
            }
        }

        return savedVariables;
    }

    // 处理图像数组输出 - 创建图像引用而不下载（避免CORS问题）
    async processImageArrayOutput(imageArray, variableName) {
        console.log(`[变量管理] 开始处理图像数组，共 ${imageArray.length} 张图像`);

        const processedImages = [];

        for (let i = 0; i < imageArray.length; i++) {
            const imageData = imageArray[i];

            if (!imageData.url) {
                console.warn(`[变量管理] 图像 ${i} 缺少URL，跳过处理`);
                processedImages.push(imageData);
                continue;
            }

            try {
                // 不直接下载，而是创建图像引用信息
                const timestamp = Date.now();
                const imageIndex = imageArray.length > 1 ? `_${i + 1}` : '';
                const fileName = `${variableName}_${timestamp}${imageIndex}.png`;

                // 创建图像引用对象
                const imageReference = {
                    ...imageData,
                    fileName: fileName,
                    referenceId: `img_${timestamp}_${i}`,
                    sourceUrl: imageData.url,
                    type: 'image',
                    format: 'png',
                    downloadTime: new Date().toISOString(),
                    status: 'referenced', // 标记为引用状态
                    // 保留原始数据
                    originalData: imageData
                };

                // 如果是本地环境或者有代理，可以尝试下载
                // 否则只保存引用信息
                if (this.canDownloadImage(imageData.url)) {
                    try {
                        const response = await fetch(imageData.url, {
                            mode: 'cors',
                            headers: {
                                'Accept': 'image/*'
                            }
                        });

                        if (response.ok) {
                            const blob = await response.blob();
                            const mediaId = await this.storeMediaFile(`img_${timestamp}_${i}`, fileName, blob, 'image');

                            imageReference.mediaId = mediaId;
                            imageReference.blob = blob;
                            imageReference.localUrl = URL.createObjectURL(blob);
                            imageReference.status = 'downloaded';

                            console.log(`[变量管理] 图像 ${i} 下载成功: ${fileName} (媒体ID: ${mediaId})`);
                        } else {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                    } catch (downloadError) {
                        console.warn(`[变量管理] 图像 ${i} 下载失败，保留引用:`, downloadError.message);
                        imageReference.downloadError = downloadError.message;
                    }
                } else {
                    console.log(`[变量管理] 图像 ${i} 仅保存引用信息（避免CORS）: ${fileName}`);
                }

                processedImages.push(imageReference);

            } catch (error) {
                console.error(`[变量管理] 处理图像 ${i} 失败:`, error);
                // 保留原始数据但添加错误信息
                processedImages.push({
                    ...imageData,
                    processError: error.message,
                    processTime: new Date().toISOString(),
                    status: 'error'
                });
            }
        }

        const downloadedCount = processedImages.filter(img => img.status === 'downloaded').length;
        const referencedCount = processedImages.filter(img => img.status === 'referenced').length;
        console.log(`[变量管理] 图像数组处理完成，下载 ${downloadedCount} 张，引用 ${referencedCount} 张，共 ${imageArray.length} 张`);

        return processedImages;
    }

    // 提取并保存优化后的提示词
    async extractAndSavePrompts(nodeId, imageArray, baseVariableName) {
        const prompts = [];

        // 从图像数组中提取revised_prompt
        imageArray.forEach((imageData, index) => {
            if (imageData.revised_prompt) {
                prompts.push(imageData.revised_prompt);
            } else if (imageData.originalData && imageData.originalData.revised_prompt) {
                prompts.push(imageData.originalData.revised_prompt);
            }
        });

        if (prompts.length > 0) {
            // 生成提示词变量名 - 确保不与原始prompt输出冲突
            let promptVariableName;
            if (baseVariableName.includes('_images')) {
                // 对于图像变量，创建独立的优化提示词变量
                promptVariableName = baseVariableName.replace('_images', '_优化提示词');
            } else {
                // 其他情况，直接添加后缀
                promptVariableName = baseVariableName + '_优化提示词';
            }

            // 如果只有一个提示词，保存为字符串；多个提示词保存为数组
            const promptValue = prompts.length === 1 ? prompts[0] : prompts;

            // 检查变量是否已存在
            if (!this.globalVariables.has(promptVariableName)) {
                this.createGlobalVariable(
                    promptVariableName,
                    'string',
                    promptValue,
                    `节点 ${nodeId} 的优化提示词`
                );
            } else {
                this.updateGlobalVariable(promptVariableName, promptValue);
            }

            console.log(`[变量管理] 提取并保存优化提示词到变量 ${promptVariableName}:`, promptValue);

            return {
                name: promptVariableName,
                value: promptValue,
                count: prompts.length
            };
        }

        return null;
    }

    // 检查是否可以下载图像（避免CORS问题）
    canDownloadImage(url) {
        // 如果是同域或者已知支持CORS的域，返回true
        try {
            const urlObj = new URL(url);
            const currentOrigin = window.location.origin;

            // 同域可以下载
            if (urlObj.origin === currentOrigin) {
                return true;
            }

            // 已知支持CORS的域（可以根据需要添加）
            const corsEnabledDomains = [
                'localhost',
                '127.0.0.1',
                // 可以添加其他已知支持CORS的域
            ];

            return corsEnabledDomains.some(domain => urlObj.hostname.includes(domain));
        } catch (error) {
            return false;
        }
    }    // 解析输出值
    parseOutputValue(value, parseConfig) {
        const { mode, config } = parseConfig;
        const text = typeof value === 'string' ? value : String(value);

        try {
            switch (mode) {
                case 'delimiter':
                    // 分隔符解析 - 配置格式: "开始符号|结束符号"
                    const delimiters = config.split('|');
                    if (delimiters.length === 2) {
                        const startDelim = delimiters[0];
                        const endDelim = delimiters[1];
                        const startIndex = text.indexOf(startDelim);
                        const endIndex = text.lastIndexOf(endDelim);

                        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                            return text.substring(startIndex + startDelim.length, endIndex);
                        }
                    }
                    break;

                case 'field':
                    // 字段名匹配 - 配置格式: 字段名
                    const fieldPattern = new RegExp(`"${config}"\\s*:\\s*"([^"]*)"`, 'i');
                    const fieldMatch = text.match(fieldPattern);
                    if (fieldMatch) {
                        return fieldMatch[1];
                    }

                    // 尝试JSON解析
                    try {
                        const jsonData = JSON.parse(text);
                        if (jsonData[config] !== undefined) {
                            return jsonData[config];
                        }
                    } catch (e) {
                        // 忽略JSON解析错误
                    }
                    break;

                case 'regex':
                    // 正则表达式 - 配置格式: 正则表达式
                    const regex = new RegExp(config, 'g');
                    const matches = [];
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        matches.push(match[1] || match[0]);
                    }
                    return matches.length === 1 ? matches[0] : matches;

                case 'sequence':
                    // 序列提取 - 配置格式: 数字（第n个匹配）
                    const sequenceIndex = parseInt(config) - 1;
                    const lines = text.split('\n').filter(line => line.trim());
                    if (sequenceIndex >= 0 && sequenceIndex < lines.length) {
                        return lines[sequenceIndex];
                    }
                    break;

                default:
                    return value;
            }
        } catch (error) {
            console.warn(`[变量管理] 输出解析失败 (${mode}):`, error);
        }

        return value; // 解析失败时返回原值
    }

    // 推断变量类型
    inferVariableType(value) {
        if (typeof value === 'string') return 'string';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        if (Array.isArray(value)) {
            // 检查是否为图像数组
            if (value.length > 0 && value[0] && typeof value[0] === 'object' && value[0].url) {
                return 'image';
            }
            return 'array';
        }
        if (typeof value === 'object' && value !== null) return 'object';
        return 'string'; // 默认为字符串
    }

    // 保存变量历史记录
    saveVariableHistory(name, value) {
        if (!this.variableHistory.has(name)) {
            this.variableHistory.set(name, []);
        }

        const history = this.variableHistory.get(name);
        history.unshift({
            value,
            timestamp: new Date()
        });

        // 限制历史记录数量
        if (history.length > 10) {
            history.splice(10);
        }
    }

    // 获取变量历史记录
    getVariableHistory(name) {
        return this.variableHistory.get(name) || [];
    }

    // 订阅变量变化
    subscribe(variableName, callback) {
        if (!this.subscribers.has(variableName)) {
            this.subscribers.set(variableName, []);
        }

        this.subscribers.get(variableName).push(callback);

        return () => {
            const callbacks = this.subscribers.get(variableName);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index !== -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    // 通知订阅者
    notifySubscribers(variableName, action, variable, oldValue = null) {
        const callbacks = this.subscribers.get(variableName);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(action, variable, oldValue);
                } catch (error) {
                    console.error('[变量管理] 通知订阅者时出错:', error);
                }
            });
        }
    }

    // 解析变量模板字符串（支持 {{变量名}} 语法）
    resolveTemplate(template, additionalContext = {}) {
        if (typeof template !== 'string') {
            return template;
        }

        const context = { ...additionalContext };

        // 添加全局变量到上下文
        this.globalVariables.forEach((variable, name) => {
            context[name] = variable.value;
        });

        // 解析模板
        return template.replace(/\{\{([^}]+)\}\}/g, (match, varPath) => {
            const path = varPath.trim();
            const value = this.getValueByPath(context, path);
            return value !== undefined ? String(value) : match;
        });
    }

    // 根据路径获取值（支持 a.b.c 和 a[0].b 语法）
    getValueByPath(obj, path) {
        try {
            return path.split(/[\.\[\]]/).filter(Boolean).reduce((current, key) => {
                return current && current[key];
            }, obj);
        } catch {
            return undefined;
        }
    }

    // 创建执行上下文
    createExecutionContext(executionId) {
        const context = {
            executionId,
            variables: new Map(),
            startTime: new Date(),
            nodeResults: new Map()
        };

        this.executionContext.set(executionId, context);
        return context;
    }

    // 设置执行上下文变量
    setExecutionVariable(executionId, name, value) {
        const context = this.executionContext.get(executionId);
        if (context) {
            context.variables.set(name, {
                value,
                timestamp: new Date()
            });
        }
    }

    // 获取执行上下文变量
    getExecutionVariable(executionId, name) {
        const context = this.executionContext.get(executionId);
        if (context) {
            const variable = context.variables.get(name);
            return variable ? variable.value : undefined;
        }
        return undefined;
    }

    // 保存节点执行结果到上下文
    saveNodeResult(executionId, nodeId, inputs, outputs, status = 'success', error = null) {
        const context = this.executionContext.get(executionId);
        if (context) {
            context.nodeResults.set(nodeId, {
                inputs: { ...inputs },
                outputs: { ...outputs },
                status,
                error,
                timestamp: new Date()
            });
        }
    }

    // 获取节点执行结果
    getNodeResult(executionId, nodeId) {
        const context = this.executionContext.get(executionId);
        if (context) {
            return context.nodeResults.get(nodeId);
        }
        return null;
    }

    // 清理执行上下文
    cleanupExecutionContext(executionId) {
        this.executionContext.delete(executionId);
        console.log(`[变量管理] 清理执行上下文: ${executionId}`);
    }

    // 导出变量配置
    exportVariables() {
        return {
            globalVariables: Object.fromEntries(this.globalVariables),
            nodeVariables: Object.fromEntries(this.nodeVariables),
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    // 导入变量配置
    importVariables(data) {
        try {
            if (data.globalVariables) {
                this.globalVariables.clear();
                Object.entries(data.globalVariables).forEach(([name, variable]) => {
                    this.globalVariables.set(name, variable);
                });
            }

            if (data.nodeVariables) {
                this.nodeVariables.clear();
                Object.entries(data.nodeVariables).forEach(([nodeId, config]) => {
                    this.nodeVariables.set(nodeId, config);
                });
            }

            console.log('[变量管理] 变量配置导入成功');
            return true;
        } catch (error) {
            console.error('[变量管理] 导入变量配置失败:', error);
            return false;
        }
    }

    // 保存到本地存储
    saveToStorage() {
        try {
            const data = this.exportVariables();
            localStorage.setItem('ai-workflow-variables', JSON.stringify(data));
            console.log('[变量管理] 变量配置已保存到本地存储');
        } catch (error) {
            console.error('[变量管理] 保存变量配置失败:', error);
        }
    }

    // 从本地存储加载
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('ai-workflow-variables');
            if (saved) {
                const data = JSON.parse(saved);
                this.importVariables(data);
                console.log('[变量管理] 从本地存储加载变量配置成功');
                return true;
            }
        } catch (error) {
            console.error('[变量管理] 从本地存储加载变量配置失败:', error);
        }
        return false;
    }

    // 清空所有变量
    clearAll() {
        this.globalVariables.clear();
        this.nodeVariables.clear();
        this.executionContext.clear();
        this.variableHistory.clear();
        console.log('[变量管理] 已清空所有变量');
    }

    // 验证变量名
    validateVariableName(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('变量名必须是非空字符串');
        }

        const trimmedName = name.trim();
        if (!trimmedName) {
            throw new Error('变量名不能为空');
        }

        // 检查变量名格式（字母、数字、下划线、中文）
        if (!/^[a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*$/.test(trimmedName)) {
            throw new Error('变量名只能包含字母、数字、下划线和中文，且不能以数字开头');
        }

        return trimmedName;
    }

    // 更新变量弹窗配置
    updateVariablePopupConfig(variableName, popupConfig) {
        const variable = this.globalVariables.get(variableName);
        if (!variable) {
            throw new Error(`变量 ${variableName} 不存在`);
        }

        variable.popupConfig = { ...variable.popupConfig, ...popupConfig };
        variable.updated = new Date();

        console.log(`[变量管理] 更新变量 ${variableName} 弹窗配置:`, variable.popupConfig);
        return variable;
    }

    // 检查变量是否需要输入弹窗
    shouldShowInputPopup(variableName) {
        const variable = this.globalVariables.get(variableName);
        return variable && variable.popupConfig && variable.popupConfig.inputPopup;
    }

    // 检查变量是否需要输出弹窗（审核）
    shouldShowOutputPopup(variableName) {
        const variable = this.globalVariables.get(variableName);
        return variable && variable.popupConfig && variable.popupConfig.outputPopup;
    }

    // 获取变量弹窗超时时间
    getVariablePopupTimeout(variableName) {
        const variable = this.globalVariables.get(variableName);
        return variable && variable.popupConfig ? variable.popupConfig.timeout : 20000;
    }

    // 获取变量统计信息
    getStatistics() {
        const globalVarCount = this.globalVariables.size;
        const nodeVarCount = this.nodeVariables.size;
        const typeDistribution = {};

        this.globalVariables.forEach(variable => {
            typeDistribution[variable.type] = (typeDistribution[variable.type] || 0) + 1;
        });

        return {
            globalVariables: globalVarCount,
            nodeConfigurations: nodeVarCount,
            typeDistribution,
            totalExecutionContexts: this.executionContext.size
        };
    }
}

// 向后兼容：创建 VariableManager 别名，保持现有代码正常工作
class VariableManager extends StorageManager {
    constructor() {
        super();
        console.log('[存储管理] 使用增强版存储管理器（向后兼容模式）');
    }

    // 向后兼容方法：获取变量值
    getGlobalVariableValue(name) {
        const item = this.globalVariables.get(name);
        if (!item) return undefined;

        // 如果是基础类型且有直接值，返回
        if (item.value !== undefined && item.storage !== 'indexeddb') {
            return item.value;
        }

        // 否则使用新的获取方法
        return this.getFromIndexedDB(name);
    }

    // 添加缺失的方法

    // 从IndexedDB获取数据
    async getFromIndexedDB(name) {
        if (!this.db) return null;

        const transaction = this.db.transaction(['storage_items', 'media_files'], 'readonly');

        try {
            const store = transaction.objectStore('storage_items');
            const result = await store.get(name);

            if (!result) return null;

            let value = result.value;

            // 处理媒体引用
            if (value && typeof value === 'object' && value.type === 'mediaReference') {
                const mediaStore = transaction.objectStore('media_files');
                const mediaResult = await mediaStore.get(value.mediaId);
                if (mediaResult) {
                    return mediaResult.data; // 返回Blob对象
                }
            }

            // 处理压缩文本
            if (result.compression && value instanceof Uint8Array) {
                value = await this.decompressText(value);
            }

            return value;

        } catch (error) {
            console.error('[存储管理] IndexedDB读取失败:', error);
            return null;
        }
    }

    // 文本解压缩
    async decompressText(compressedData) {
        if ('DecompressionStream' in window) {
            try {
                const stream = new DecompressionStream('gzip');
                const writer = stream.writable.getWriter();
                const reader = stream.readable.getReader();

                writer.write(compressedData);
                writer.close();

                const chunks = [];
                let done = false;

                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) chunks.push(value);
                }

                const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
                return new TextDecoder().decode(decompressed);
            } catch (error) {
                console.warn('[存储管理] 文本解压缩失败:', error);
                return compressedData;
            }
        }

        return compressedData;
    }

    // 内存缓存管理
    shouldCache(storageItem) {
        // 小于1MB且不是媒体文件的项目可以缓存
        return storageItem.size < 1024 * 1024 && storageItem.storage !== 'indexeddb';
    }

    async addToMemoryCache(name, value, size) {
        // 检查是否超过内存限制
        while (this.cacheConfig.currentMemoryUsage + size > this.cacheConfig.maxMemorySize) {
            await this.evictFromCache();
        }

        this.memoryCache.set(name, value);
        this.cacheConfig.currentMemoryUsage += size;
        this.updateAccessQueue(name);
    }

    async evictFromCache() {
        if (this.accessQueue.size === 0) return;

        // 获取最少使用的变量
        const oldestKey = this.accessQueue.values().next().value;
        this.accessQueue.delete(oldestKey);

        const storageItem = this.globalVariables.get(oldestKey);
        if (storageItem) {
            this.cacheConfig.currentMemoryUsage -= storageItem.size || 0;
        }

        this.memoryCache.delete(oldestKey);
        console.log(`[缓存管理] 淘汰存储项: ${oldestKey}`);
    }

    updateAccessQueue(name) {
        if (this.accessQueue.has(name)) {
            this.accessQueue.delete(name);
        }
        this.accessQueue.add(name);
    }

    // 获取存储统计
    getStorageStatistics() {
        return {
            memory: {
                used: this.cacheConfig.currentMemoryUsage,
                max: this.cacheConfig.maxMemorySize,
                cached: this.memoryCache.size
            },
            storage: {
                localStorage: this.getStorageSize('localStorage'),
                sessionStorage: this.getStorageSize('sessionStorage'),
                indexedDB: 'calculating...' // 需要异步计算
            },
            items: {
                total: this.globalVariables.size,
                byType: this.getItemsByType(),
                byStorage: this.getItemsByStorage()
            }
        };
    }

    getStorageSize(storageType) {
        try {
            const storage = window[storageType];
            let size = 0;
            for (let key in storage) {
                if (key.startsWith('storage_')) {
                    size += storage[key].length;
                }
            }
            return size;
        } catch {
            return 0;
        }
    }

    getItemsByType() {
        const typeDistribution = {};
        this.globalVariables.forEach(item => {
            typeDistribution[item.type] = (typeDistribution[item.type] || 0) + 1;
        });
        return typeDistribution;
    }

    getItemsByStorage() {
        const storageDistribution = {};
        this.globalVariables.forEach(item => {
            const storage = item.storage || 'localStorage';
            storageDistribution[storage] = (storageDistribution[storage] || 0) + 1;
        });
        return storageDistribution;
    }

    // 数据迁移工具
    async migrateFromOldSystem() {
        console.log('[数据迁移] 开始迁移旧数据...');

        // 读取旧的localStorage数据
        const oldData = localStorage.getItem('ai-workflow-variables');
        if (!oldData) {
            console.log('[数据迁移] 没有发现旧数据');
            return;
        }

        try {
            const variables = JSON.parse(oldData);
            let migrated = 0;

            for (const [name, oldVar] of Object.entries(variables.globalVariables || {})) {
                try {
                    // 如果新系统中不存在该变量，进行迁移
                    if (!this.globalVariables.has(name)) {
                        await this.createStorageItem(
                            name,
                            oldVar.type || 'string',
                            oldVar.value,
                            {
                                description: oldVar.description || '',
                                popupConfig: oldVar.popupConfig
                            }
                        );
                        migrated++;
                    }
                } catch (error) {
                    console.warn(`[数据迁移] 迁移变量 ${name} 失败:`, error);
                }
            }

            // 迁移节点配置
            if (variables.nodeVariables) {
                for (const [nodeId, config] of Object.entries(variables.nodeVariables)) {
                    if (!this.nodeVariables.has(nodeId)) {
                        this.nodeVariables.set(nodeId, config);
                    }
                }
            }

            // 备份旧数据
            localStorage.setItem('ai-workflow-variables-backup', oldData);
            console.log(`[数据迁移] 迁移完成，共迁移 ${migrated} 个变量`);

        } catch (error) {
            console.error('[数据迁移] 迁移失败:', error);
        }
    }

    // 检测文件类型
    detectFileType(file) {
        const mimeType = file.type;
        const fileName = file.name.toLowerCase();

        // 根据MIME类型判断
        for (const [type, config] of Object.entries(this.variableTypes)) {
            if (config.supportedMimes && config.supportedMimes.includes(mimeType)) {
                return type;
            }
        }

        // 根据文件扩展名判断
        const extension = fileName.split('.').pop();
        for (const [type, config] of Object.entries(this.variableTypes)) {
            if (config.supportedFormats && config.supportedFormats.includes(extension)) {
                return type;
            }
        }

        return 'document'; // 默认为文档类型
    }

    // 文件上传处理
    async handleFileUpload(file, name = null) {
        let finalName;
        if (name && name.trim()) {
            // 用户指定了名称，验证是否合法
            try {
                finalName = this.validateVariableName(name.trim());
            } catch (error) {
                // 如果用户指定的名称不合法，生成合法版本
                console.warn(`[存储管理] 用户指定的名称"${name}"不合法，自动修正`);
                finalName = this.generateValidVariableName(name.trim());
            }
        } else {
            // 用户未指定名称，从文件名自动生成
            const baseName = file.name.replace(/\.[^/.]+$/, ""); // 去掉扩展名
            finalName = this.generateValidVariableName(baseName);
        }

        const type = this.detectFileType(file);

        try {
            const storageItem = await this.createStorageItem(finalName, type, file, {
                description: `上传的${this.variableTypes[type].name}文件`,
                metadata: {
                    originalName: file.name,
                    uploadTime: new Date().toISOString(),
                    fileSize: file.size,
                    mimeType: file.type
                }
            });

            console.log(`[存储管理] 文件上传成功: ${finalName} (${this.formatSize(file.size)})`);
            return storageItem;

        } catch (error) {
            console.error('[存储管理] 文件上传失败:', error);
            throw error;
        }
    }

    // 通用URL载入方法 - 智能识别文件类型并存储
    async loadFromUrl(url, name = null, description = null) {
        try {
            console.log(`[存储管理] 开始从URL载入文件: ${url}`);

            // 1. 发起请求获取文件
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': '*/*'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 2. 获取内容类型和文件大小
            const contentType = response.headers.get('content-type') || '';
            const contentLength = parseInt(response.headers.get('content-length') || '0');

            console.log(`[存储管理] 文件信息 - 类型: ${contentType}, 大小: ${contentLength} bytes`);

            // 3. 智能生成文件名
            let finalName;
            if (name && name.trim()) {
                // 用户指定了名称，验证是否合法
                try {
                    finalName = this.validateVariableName(name.trim());
                } catch (error) {
                    // 如果用户指定的名称不合法，生成合法版本
                    console.warn(`[存储管理] 用户指定的名称"${name}"不合法，自动修正`);
                    finalName = this.generateValidVariableName(name.trim());
                }
            } else {
                // 用户未指定名称，从URL自动生成
                const extractedName = this.extractFileNameFromUrl(url);
                finalName = this.generateValidVariableName(extractedName);
            }

            // 4. 获取文件扩展名信息
            const fileExtension = this.extractFileExtension(url, contentType);
            const originalFileName = this.extractFileNameFromUrl(url);

            // 5. 智能识别存储类型
            const storageType = this.detectStorageTypeFromMime(contentType, fileExtension);
            console.log(`[存储管理] 检测到存储类型: ${storageType}`);

            // 6. 根据类型处理文件内容
            let fileContent;
            let blob;

            if (storageType === 'string' || storageType === 'largeText') {
                // 文本内容
                fileContent = await response.text();
                console.log(`[存储管理] 载入文本内容: ${fileContent.length} 字符`);
            } else {
                // 二进制内容 (图片、音频、视频、文档)
                blob = await response.blob();
                // 确保blob有正确的MIME类型
                fileContent = new Blob([blob], { type: contentType || this.getMimeFromExtension(fileExtension) });
                console.log(`[存储管理] 载入二进制内容: ${fileContent.size} bytes, 类型: ${fileContent.type}`);
            }

            // 7. 创建存储项
            const storageItem = await this.createStorageItem(
                finalName,
                storageType,
                fileContent,
                {
                    description: description || `从URL载入: ${url}`,
                    metadata: {
                        sourceUrl: url,
                        loadedAt: new Date().toISOString(),
                        originalName: originalFileName,
                        mimeType: contentType || this.getMimeFromExtension(fileExtension),
                        fileSize: blob ? blob.size : fileContent.length,
                        extension: fileExtension
                    }
                }
            );

            console.log(`[存储管理] URL载入成功: ${finalName} (${storageType}) - ${this.formatSize(storageItem.size)}`);
            return storageItem;

        } catch (error) {
            console.error('[存储管理] URL载入失败:', error);
            throw new Error(`载入文件失败: ${error.message}`);
        }
    }

    // 从URL提取文件名
    extractFileNameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const fileName = pathname.split('/').pop() || 'unnamed_file';

            // 移除查询参数和锚点
            return fileName.split('?')[0].split('#')[0];
        } catch {
            return 'unnamed_file';
        }
    }

    // 生成合法的变量名
    generateValidVariableName(baseName, suffix = '') {
        // 移除文件扩展名
        let name = baseName.replace(/\.[^.]*$/, '');

        // 如果名称为空，使用默认名称
        if (!name || name.trim() === '') {
            name = 'file';
        }

        // 替换不合法字符为下划线
        name = name
            .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')  // 替换非法字符为下划线
            .replace(/^[0-9]+/, '_$&')  // 如果以数字开头，前面加下划线
            .replace(/^_+/, '_')  // 合并开头的多个下划线
            .replace(/_+/g, '_')  // 合并多个连续下划线
            .replace(/_$/, '');  // 移除末尾下划线

        // 如果处理后为空或无效，使用默认名称
        if (!name || !/^[a-zA-Z_\u4e00-\u9fa5]/.test(name)) {
            name = 'file_' + Date.now();
        }

        // 添加后缀
        if (suffix) {
            name += suffix;
        }

        // 确保名称唯一
        let finalName = name;
        let counter = 1;
        while (this.globalVariables.has(finalName)) {
            finalName = `${name}_${counter}`;
            counter++;
        }

        return finalName;
    }

    // 提取文件扩展名
    extractFileExtension(url, contentType = '') {
        // 先从URL尝试提取
        const fileName = this.extractFileNameFromUrl(url);
        if (fileName.includes('.')) {
            return '.' + fileName.split('.').pop().toLowerCase();
        }

        // 从Content-Type推断
        const typeMap = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'audio/mpeg': '.mp3',
            'audio/wav': '.wav',
            'audio/ogg': '.ogg',
            'audio/mp4': '.m4a',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'video/ogg': '.ogv',
            'video/quicktime': '.mov',
            'application/pdf': '.pdf',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'text/plain': '.txt',
            'text/html': '.html',
            'application/json': '.json',
            'text/csv': '.csv'
        };

        return typeMap[contentType.toLowerCase()] || '';
    }

    // 从MIME类型检测存储类型
    detectStorageTypeFromMime(contentType, extension = '') {
        const type = contentType.toLowerCase();
        const ext = extension.toLowerCase();

        // 图片类型
        if (type.startsWith('image/')) {
            return 'image';
        }

        // 音频类型
        if (type.startsWith('audio/')) {
            return 'audio';
        }

        // 视频类型
        if (type.startsWith('video/')) {
            return 'video';
        }

        // 文档类型
        if (type.includes('pdf') ||
            type.includes('word') ||
            type.includes('document') ||
            type.includes('spreadsheet') ||
            type.includes('presentation') ||
            ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) {
            return 'document';
        }

        // 文本类型
        if (type.startsWith('text/') ||
            type.includes('json') ||
            type.includes('xml') ||
            ['.txt', '.json', '.xml', '.csv', '.html', '.css', '.js'].includes(ext)) {
            // 根据大小决定是普通文本还是大文本
            return 'string'; // 将在存储时根据大小自动调整
        }

        // 默认返回字符串类型
        return 'string';
    }

    // 根据扩展名获取MIME类型
    getMimeFromExtension(extension) {
        const mimeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.m4a': 'audio/mp4',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.ogv': 'video/ogg',
            '.mov': 'video/quicktime',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.txt': 'text/plain',
            '.html': 'text/html',
            '.json': 'application/json',
            '.csv': 'text/csv'
        };

        return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
    }

    // 预览URL内容（不下载，仅获取元信息）
    async previewUrl(url) {
        try {
            console.log(`[存储管理] 预览URL: ${url}`);

            // 发起HEAD请求获取元信息
            const response = await fetch(url, {
                method: 'HEAD',
                headers: {
                    'Accept': '*/*'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type') || '';
            const contentLength = parseInt(response.headers.get('content-length') || '0');
            const fileName = this.extractFileNameFromUrl(url);
            const fileExtension = this.extractFileExtension(url, contentType);
            const storageType = this.detectStorageTypeFromMime(contentType, fileExtension);

            return {
                url,
                fileName: fileName.includes('.') ? fileName : `${fileName}${fileExtension}`,
                contentType,
                size: contentLength,
                storageType,
                isPreviewable: this.isPreviewableType(storageType),
                previewUrl: this.isImageType(contentType) ? url : null
            };

        } catch (error) {
            console.error('[存储管理] URL预览失败:', error);
            throw new Error(`无法预览URL: ${error.message}`);
        }
    }

    // 检查是否为可预览类型
    isPreviewableType(storageType) {
        return ['image', 'audio', 'video'].includes(storageType);
    }

    // 检查是否为图片类型
    isImageType(contentType) {
        return contentType && contentType.toLowerCase().startsWith('image/');
    }
}

// 创建全局存储管理器实例（向后兼容变量管理）
window.variableManager = new VariableManager();

// 同时创建存储管理器别名，供新功能使用
window.storageManager = window.variableManager;

// 自动保存变量配置
setInterval(() => {
    if (window.variableManager) {
        window.variableManager.saveToStorage();
    }
}, 30000); // 每30秒自动保存

// 页面加载时自动加载存储配置和迁移数据
document.addEventListener('DOMContentLoaded', async () => {
    if (window.variableManager) {
        // 先加载现有配置
        window.variableManager.loadFromStorage();

        // 尝试迁移旧数据
        await window.variableManager.migrateFromOldSystem();

        console.log('[存储管理] 系统初始化完成');

        // 显示统计信息
        const stats = window.variableManager.getStorageStatistics();
        console.log('[存储管理] 当前统计:', stats);
    }
});

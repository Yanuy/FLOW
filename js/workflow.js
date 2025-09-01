// 工作流管理模块
class WorkflowManager {
    constructor() {
        this.currentWorkspaceId = 1; // 当前工作区ID
        this.nodes = new Map();
        this.connections = new Map();
        this.selectedNode = null;
        this.selectedConnection = null; // 添加选中的连接线
        this.clipboard = null;
        this.isDragging = false;
        this.isConnecting = false;
        this.connectionStart = null;
        this.tempConnection = null;

        // 自定义节点类型注册表
        this.customNodeTypes = new Map();

        this.nodeContainer = document.getElementById('nodeContainer');
        this.connectionSvg = document.getElementById('connectionSvg');
        this.canvas = document.getElementById('workflowCanvas');

        this.initializeEventListeners();
    }

    // 注册自定义节点类型
    registerNodeType(type, nodeClass) {
        this.customNodeTypes.set(type, nodeClass);
        console.log(`注册自定义节点类型: ${type}`);
    }

    // 获取节点类
    getNodeClass(type) {
        if (this.customNodeTypes.has(type)) {
            return this.customNodeTypes.get(type);
        }
        return WorkflowNode; // 默认节点类
    }

    // 初始化事件监听器
    initializeEventListeners() {
        // 画布点击事件
        this.canvas.addEventListener('click', this.onCanvasClick.bind(this));

        // 键盘事件
        document.addEventListener('keydown', this.onKeyDown.bind(this));

        // 右键菜单
        this.nodeContainer.addEventListener('contextmenu', this.onContextMenu.bind(this));

        // 双击事件
        this.nodeContainer.addEventListener('dblclick', this.onNodeDoubleClick.bind(this));

        // 连接事件
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
    }

    // 画布点击事件
    onCanvasClick(e) {
        if (e.target === this.canvas || e.target === this.nodeContainer) {
            this.deselectAllNodes();
        }
    }



    // 键盘事件
    onKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return; // 输入框中不处理快捷键
        }

        switch (e.key) {
            case 'Delete':
            case 'Backspace':
                if (this.selectedNode) {
                    this.deleteNode(this.selectedNode);
                } else if (this.selectedConnection) {
                    this.deleteConnection(this.selectedConnection);
                }
                break;
            case 'c':
                if (e.ctrlKey) {
                    this.copyNode();
                }
                break;
            case 'v':
                if (e.ctrlKey) {
                    this.pasteNode();
                }
                break;
            case 'a':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.selectAllNodes();
                }
                break;
            case 'Escape':
                this.cancelConnection();
                break;
        }
    }

    // 右键菜单
    onContextMenu(e) {
        e.preventDefault();

        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        contextMenu.classList.remove('hidden');

        // 点击其他地方关闭菜单
        const closeMenu = () => {
            contextMenu.classList.add('hidden');
            document.removeEventListener('click', closeMenu);
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    // 节点双击事件
    onNodeDoubleClick(e) {
        const nodeElement = e.target.closest('.workflow-node');
        if (!nodeElement) return;

        const nodeId = nodeElement.getAttribute('data-node-id');
        const node = this.nodes.get(nodeId);

        if (node && node.onDoubleClick) {
            console.log('触发节点双击:', nodeId, node.type);
            node.onDoubleClick(e);
        }
    }

    // 鼠标移动事件
    onMouseMove(e) {
        if (this.isConnecting && this.tempConnection) {
            this.updateTempConnection(e);
        }
    }

    // 鼠标抬起事件
    onMouseUp(e) {
        if (this.isConnecting) {
            this.finishConnection(e);
        }
    }

    // 创建节点
    createNode(type, data = {}) {
        // 获取正确的节点类
        const NodeClass = this.getNodeClass(type);

        // 所有节点都使用统一的构造函数格式: (type, data)
        const node = new NodeClass(type, data);

        this.nodes.set(node.id, node);
        this.nodeContainer.appendChild(node.element);

        // 为有输出的节点自动创建全局变量
        this.createAutoVariableForNode(node);

        // 检查输入输出数量，如果大于等于3则调整连接点位置
        const info = node.getNodeInfo();
        const inputCount = (info.inputs || []).length;
        const outputCount = (info.outputs || []).length;

        if (inputCount >= 3 || outputCount >= 3) {
            console.log(`[工作流管理] 节点 ${node.id} 有 ${inputCount} 个输入和 ${outputCount} 个输出，调整连接点位置`);
            this.updateNodeConnectionPoints(node);
        }

        // 选中新创建的节点
        this.selectNode(node.id);

        const displayName = this.getNodeDisplayName(node);
        Utils.showNotification(`创建了${displayName}节点`, 'success');

        return node;
    }

    // 为节点自动创建全局变量
    createAutoVariableForNode(node) {
        const info = node.getNodeInfo();
        const displayName = this.getNodeDisplayName(node);

        // 如果节点有输出且不是控制节点，为其创建对应的全局变量
        const isControlNode = ['condition', 'loop', 'delay'].includes(node.type);

        if (info.outputs && info.outputs.length > 0 && !isControlNode) {
            try {
                // 获取或创建节点配置
                const config = window.variableManager.getNodeVariableConfig(node.id);

                // 为每个输出创建对应的变量（仅在还未配置时）
                info.outputs.forEach((outputName, index) => {
                    // 检查是否已经配置了输出映射
                    if (config.outputMappings[outputName]) {
                        console.log(`[工作流管理] 节点 ${displayName} 的输出 ${outputName} 已配置映射，跳过自动创建`);
                        return;
                    }

                    // 根据输出名称推断变量类型
                    const variableType = this.inferVariableTypeFromOutputName(outputName);

                    // 生成变量名：主要输出使用节点名，其他输出使用"节点名_输出名"
                    let variableName;
                    if (index === 0 && variableType === 'string') {
                        // 主要输出且是字符串类型，直接使用节点显示名
                        variableName = displayName;
                    } else {
                        // 其他情况使用"节点名_输出名"格式
                        variableName = `${displayName}_${outputName}`;
                    }

                    // 检查变量是否已存在
                    if (!window.variableManager.getGlobalVariable(variableName)) {
                        window.variableManager.createGlobalVariable(
                            variableName,
                            variableType,
                            this.getDefaultValueForType(variableType),
                            `${displayName}的${outputName}输出`
                        );

                        console.log(`[工作流管理] 为节点 ${displayName} 自动创建${variableType}类型变量: ${variableName}`);
                    }

                    // 配置输出映射
                    config.outputMappings[outputName] = variableName;
                });

                // 自动配置输入映射（如果有连接的上游节点）
                this.configureAutoInputMappings(node, config);

                window.variableManager.configureNodeVariables(node.id, config.inputMappings, config.outputMappings);

            } catch (error) {
                console.warn(`为节点 ${displayName} 创建全局变量失败:`, error);
            }
        } else if (isControlNode) {
            // 控制节点自动配置传递上游变量
            const config = window.variableManager.getNodeVariableConfig(node.id);
            this.configureAutoInputMappings(node, config);

            // 控制节点的输出映射到上游的变量（传递数据）
            if (info.outputs.length > 0) {
                const upstreamVariable = this.getUpstreamVariableName(node);
                if (upstreamVariable) {
                    config.outputMappings[info.outputs[0]] = upstreamVariable;
                }
            }

            window.variableManager.configureNodeVariables(node.id, config.inputMappings, config.outputMappings);
        }
    }

    // 根据输出名称推断变量类型
    inferVariableTypeFromOutputName(outputName) {
        const name = outputName.toLowerCase();

        // 图像类型
        if (name === 'image' || name === 'images' || name.includes('image')) {
            return 'image';
        }

        // 音频类型
        if (name === 'audio' || name === 'audios' || name.includes('audio') ||
            name === 'sound' || name === 'sounds' || name.includes('sound')) {
            return 'audio';
        }

        // 视频类型
        if (name === 'video' || name === 'videos' || name.includes('video') ||
            name === 'movie' || name === 'movies' || name.includes('movie')) {
            return 'video';
        }

        // 文档类型
        if (name === 'document' || name === 'documents' || name.includes('document') ||
            name === 'file' || name === 'files' || name.includes('file') ||
            name === 'doc' || name === 'docs' || name.includes('doc')) {
            return 'document';
        }

        // 默认为字符串类型
        return 'string';
    }

    // 获取类型的默认值
    getDefaultValueForType(type) {
        switch (type) {
            case 'image':
            case 'audio':
            case 'video':
            case 'document':
                return null; // 媒体类型默认为空
            case 'string':
            default:
                return ''; // 字符串类型默认为空字符串
        }
    }

    // 配置自动输入映射
    configureAutoInputMappings(node, config) {
        const info = node.getNodeInfo();
        if (!info.inputs || info.inputs.length === 0) return;

        // 查找连接到此节点的上游节点
        const connections = Array.from(this.connections.values());
        const inputConnections = connections.filter(conn => conn.to.nodeId === node.id);

        inputConnections.forEach(connection => {
            const sourceNode = this.getNode(connection.from.nodeId);
            if (sourceNode) {
                const sourceDisplayName = this.getNodeDisplayName(sourceNode);
                const targetInput = connection.to.input;

                // 自动映射到源节点的变量
                config.inputMappings[targetInput] = sourceDisplayName;

                console.log(`[工作流管理] 自动配置输入映射: ${targetInput} <- ${sourceDisplayName}`);
            }
        });
    }

    // 获取上游变量名（用于控制节点）
    getUpstreamVariableName(node) {
        const connections = Array.from(this.connections.values());
        const inputConnection = connections.find(conn => conn.to.nodeId === node.id);

        if (inputConnection) {
            const sourceNode = this.getNode(inputConnection.from.nodeId);
            if (sourceNode) {
                return this.getNodeDisplayName(sourceNode);
            }
        }

        return null;
    }

    // 更新连接时的自动映射
    updateAutoMappingsForConnection(toNode, connection) {
        const config = window.variableManager.getNodeVariableConfig(toNode.id);
        const fromNode = this.getNode(connection.from.nodeId);

        if (fromNode) {
            const sourceDisplayName = this.getNodeDisplayName(fromNode);
            const targetInput = connection.to.input;

            // 自动映射输入到源节点的变量
            config.inputMappings[targetInput] = sourceDisplayName;

            // 如果是控制节点，同时更新输出映射以传递数据
            const isControlNode = ['condition', 'loop', 'delay'].includes(toNode.type);
            if (isControlNode) {
                const toNodeInfo = toNode.getNodeInfo();
                if (toNodeInfo.outputs && toNodeInfo.outputs.length > 0) {
                    config.outputMappings[toNodeInfo.outputs[0]] = sourceDisplayName;
                }
            }

            window.variableManager.configureNodeVariables(toNode.id, config.inputMappings, config.outputMappings);

            console.log(`[工作流管理] 连接创建时自动更新映射: ${targetInput} <- ${sourceDisplayName}`);
        }
    }

    // 删除节点
    deleteNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        // 清理节点资源
        if (node.cleanup) {
            node.cleanup();
        }

        // 删除相关连接
        this.removeNodeConnections(nodeId);

        // 删除DOM元素
        if (node.element && node.element.parentNode) {
            node.element.parentNode.removeChild(node.element);
        }

        // 从节点集合中删除
        this.nodes.delete(nodeId);

        // 清除选择
        if (this.selectedNode === nodeId) {
            this.selectedNode = null;
            this.updatePropertyPanel();
        }

        Utils.showNotification('节点已删除', 'info');
    }

    // 复制节点
    copyNode() {
        if (this.selectedNode) {
            const node = this.nodes.get(this.selectedNode);
            if (node) {
                this.clipboard = {
                    type: 'node',
                    data: node.toJSON()
                };
                Utils.showNotification('节点已复制', 'info');
            }
        }
    }

    // 粘贴节点
    pasteNode() {
        if (this.clipboard && this.clipboard.type === 'node') {
            const nodeData = Utils.deepClone(this.clipboard.data);
            nodeData.x += 20;
            nodeData.y += 20;

            const newNode = WorkflowNode.fromJSON(nodeData);
            this.nodes.set(newNode.id, newNode);
            this.nodeContainer.appendChild(newNode.element);
            this.selectNode(newNode.id);

            Utils.showNotification('节点已粘贴', 'success');
        }
    }

    // 选择节点
    selectNode(nodeId) {
        // 取消之前的选择
        this.deselectAllNodes();

        const node = this.nodes.get(nodeId);
        if (node) {
            node.select();
            this.selectedNode = nodeId;
            this.updatePropertyPanel();
        }
    }

    // 取消选择所有节点
    deselectAllNodes() {
        this.nodes.forEach(node => node.deselect());
        this.selectedNode = null;

        // 同时取消连接线的选择
        this.deselectAllConnections();

        this.updatePropertyPanel();
    }

    // 取消选择所有连接线
    deselectAllConnections() {
        this.connectionSvg.querySelectorAll('.connection-line').forEach(line => {
            line.classList.remove('selected');
        });
        this.selectedConnection = null;
    }

    // 选择所有节点
    selectAllNodes() {
        this.nodes.forEach(node => node.select());
    }

    // 获取节点
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }

    // 开始创建连接
    startConnection(fromNodeId, outputName, element) {
        this.isConnecting = true;
        this.connectionStart = {
            nodeId: fromNodeId,
            outputName: outputName,
            element: element
        };

        // 创建临时连接线
        this.createTempConnection();
    }

    // 创建临时连接线
    createTempConnection() {
        if (this.tempConnection) {
            this.tempConnection.remove();
        }

        this.tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempConnection.setAttribute('class', 'connection-line temp');
        this.tempConnection.setAttribute('stroke', '#999');
        this.tempConnection.setAttribute('stroke-dasharray', '5,5');
        this.connectionSvg.appendChild(this.tempConnection);
    }

    // 更新临时连接线
    updateTempConnection(e) {
        if (!this.tempConnection || !this.connectionStart) return;

        const rect = this.connectionSvg.getBoundingClientRect();
        const startElement = this.connectionStart.element;
        const startRect = startElement.getBoundingClientRect();

        const start = {
            x: startRect.left + startRect.width / 2 - rect.left,
            y: startRect.top + startRect.height / 2 - rect.top
        };

        const end = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        const path = Utils.createBezierPath(start, end);
        this.tempConnection.setAttribute('d', path);
    }

    // 完成连接
    finishConnection(e) {
        if (!this.isConnecting) return;

        const target = document.elementFromPoint(e.clientX, e.clientY);

        if (target && target.classList.contains('connection-point') &&
            target.classList.contains('input')) {

            const toNodeElement = target.closest('.workflow-node');
            const toNodeId = toNodeElement.getAttribute('data-node-id');
            const inputName = target.getAttribute('data-input');

            if (toNodeId !== this.connectionStart.nodeId) {
                this.createConnection(
                    this.connectionStart.nodeId,
                    this.connectionStart.outputName,
                    toNodeId,
                    inputName
                );
            }
        }

        this.cancelConnection();
    }

    // 取消连接
    cancelConnection() {
        this.isConnecting = false;
        this.connectionStart = null;

        if (this.tempConnection) {
            this.tempConnection.remove();
            this.tempConnection = null;
        }
    }

    // 创建连接
    createConnection(fromNodeId, outputName, toNodeId, inputName) {
        const connectionId = `${fromNodeId}-${outputName}-${toNodeId}-${inputName}`;

        // 检查是否已存在连接
        if (this.connections.has(connectionId)) {
            Utils.showNotification('连接已存在', 'warning');
            return;
        }

        // 移除目标输入的现有连接
        this.removeInputConnections(toNodeId, inputName);

        // 创建连接数据
        const connection = {
            id: connectionId,
            from: { nodeId: fromNodeId, output: outputName },
            to: { nodeId: toNodeId, input: inputName }
        };

        this.connections.set(connectionId, connection);

        // 更新节点连接信息
        const fromNode = this.nodes.get(fromNodeId);
        const toNode = this.nodes.get(toNodeId);

        if (fromNode && toNode) {
            fromNode.addOutputConnection(outputName, toNodeId, inputName);
            toNode.addInputConnection(inputName, fromNodeId, outputName);
        }

        // 绘制连接线
        this.drawConnection(connection);

        // 更新目标节点的自动映射
        if (toNode) {
            this.updateAutoMappingsForConnection(toNode, connection);
        }

        Utils.showNotification('连接已创建', 'success');
    }

    // 绘制连接线
    drawConnection(connection) {
        const fromNode = this.nodes.get(connection.from.nodeId);
        const toNode = this.nodes.get(connection.to.nodeId);

        if (!fromNode || !toNode) return;

        const fromElement = fromNode.element.querySelector(`[data-output="${connection.from.output}"]`);
        const toElement = toNode.element.querySelector(`[data-input="${connection.to.input}"]`);

        if (!fromElement || !toElement) return;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-line');
        path.setAttribute('data-connection-id', connection.id);

        // 添加点击事件
        path.addEventListener('click', () => {
            this.selectConnection(connection.id);
        });

        // 添加右键菜单事件
        path.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.selectConnection(connection.id);
            this.showConnectionContextMenu(e.clientX, e.clientY, connection.id);
        });

        this.connectionSvg.appendChild(path);
        this.updateConnectionPath(connection.id);
    }

    // 更新连接线路径
    updateConnectionPath(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;

        const fromNode = this.nodes.get(connection.from.nodeId);
        const toNode = this.nodes.get(connection.to.nodeId);

        if (!fromNode || !toNode) return;

        const fromElement = fromNode.element.querySelector(`[data-output="${connection.from.output}"]`);
        const toElement = toNode.element.querySelector(`[data-input="${connection.to.input}"]`);

        if (!fromElement || !toElement) return;

        const svgRect = this.connectionSvg.getBoundingClientRect();
        const fromRect = fromElement.getBoundingClientRect();
        const toRect = toElement.getBoundingClientRect();

        const start = {
            x: fromRect.left + fromRect.width / 2 - svgRect.left,
            y: fromRect.top + fromRect.height / 2 - svgRect.top
        };

        const end = {
            x: toRect.left + toRect.width / 2 - svgRect.left,
            y: toRect.top + toRect.height / 2 - svgRect.top
        };

        const path = Utils.createBezierPath(start, end);
        const pathElement = this.connectionSvg.querySelector(`[data-connection-id="${connectionId}"]`);

        if (pathElement) {
            pathElement.setAttribute('d', path);
        }
    }

    // 更新所有连接线
    // 更新所有连接线
    updateConnections() {
        this.connections.forEach((connection, connectionId) => {
            this.updateConnectionPath(connectionId);
        });
    }

    // 更新与特定节点相关的连接线
    updateNodeConnections(nodeId) {
        this.connections.forEach((connection, connectionId) => {
            if (connection.from.nodeId === nodeId || connection.to.nodeId === nodeId) {
                this.updateConnectionPath(connectionId);
            }
        });
    }

    // 选择连接
    selectConnection(connectionId) {
        // 取消选择所有节点
        this.deselectAllNodes();

        // 取消选择其他连接线
        this.connectionSvg.querySelectorAll('.connection-line').forEach(line => {
            line.classList.remove('selected');
        });

        // 选择当前连接线
        const pathElement = this.connectionSvg.querySelector(`[data-connection-id="${connectionId}"]`);
        if (pathElement) {
            pathElement.classList.add('selected');
        }

        this.selectedConnection = connectionId;
    }

    // 显示连接线右键菜单
    showConnectionContextMenu(x, y, connectionId) {
        // 创建连接线专用的右键菜单
        let connectionMenu = document.getElementById('connectionContextMenu');
        if (!connectionMenu) {
            connectionMenu = document.createElement('div');
            connectionMenu.id = 'connectionContextMenu';
            connectionMenu.className = 'context-menu hidden';
            connectionMenu.innerHTML = `
                <div class="context-item" data-action="delete-connection">
                    <i class="fas fa-times"></i> 删除连接线
                </div>
            `;
            document.body.appendChild(connectionMenu);

            // 绑定点击事件
            connectionMenu.addEventListener('click', (e) => {
                if (e.target.closest('.context-item')) {
                    const action = e.target.closest('.context-item').getAttribute('data-action');
                    this.handleConnectionContextAction(action, connectionId);
                    this.hideConnectionContextMenu();
                }
            });
        }

        connectionMenu.style.left = x + 'px';
        connectionMenu.style.top = y + 'px';
        connectionMenu.classList.remove('hidden');

        // 点击其他地方关闭菜单
        const closeMenu = (e) => {
            if (!connectionMenu.contains(e.target)) {
                this.hideConnectionContextMenu();
                document.removeEventListener('click', closeMenu);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    // 隐藏连接线右键菜单
    hideConnectionContextMenu() {
        const connectionMenu = document.getElementById('connectionContextMenu');
        if (connectionMenu) {
            connectionMenu.classList.add('hidden');
        }
    }

    // 处理连接线右键菜单操作
    handleConnectionContextAction(action, connectionId) {
        switch (action) {
            case 'delete-connection':
                this.deleteConnection(connectionId);
                break;
        }
    }

    // 删除连接
    deleteConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;

        // 删除DOM元素
        const pathElement = this.connectionSvg.querySelector(`[data-connection-id="${connectionId}"]`);
        if (pathElement) {
            pathElement.remove();
        }

        // 更新节点连接信息
        const fromNode = this.nodes.get(connection.from.nodeId);
        const toNode = this.nodes.get(connection.to.nodeId);

        if (fromNode) {
            fromNode.removeOutputConnection(
                connection.from.output,
                connection.to.nodeId,
                connection.to.input
            );
        }

        if (toNode) {
            toNode.removeInputConnection(connection.to.input);
        }

        // 删除连接数据
        this.connections.delete(connectionId);

        Utils.showNotification('连接已删除', 'info');
    }

    // 移除节点的所有连接
    removeNodeConnections(nodeId) {
        const connectionsToDelete = [];

        this.connections.forEach((connection, connectionId) => {
            if (connection.from.nodeId === nodeId || connection.to.nodeId === nodeId) {
                connectionsToDelete.push(connectionId);
            }
        });

        connectionsToDelete.forEach(connectionId => {
            this.deleteConnection(connectionId);
        });
    }

    // 移除输入连接
    removeInputConnections(nodeId, inputName) {
        const connectionsToDelete = [];

        this.connections.forEach((connection, connectionId) => {
            if (connection.to.nodeId === nodeId && connection.to.input === inputName) {
                connectionsToDelete.push(connectionId);
            }
        });

        connectionsToDelete.forEach(connectionId => {
            this.deleteConnection(connectionId);
        });
    }

    // 清除节点的所有输入连接
    clearNodeInputConnections(nodeId) {
        const connectionsToDelete = [];

        this.connections.forEach((connection, connectionId) => {
            if (connection.to.nodeId === nodeId) {
                connectionsToDelete.push(connectionId);
            }
        });

        connectionsToDelete.forEach(connectionId => {
            this.deleteConnection(connectionId);
        });

        if (connectionsToDelete.length > 0) {
            Utils.showNotification(`已清除 ${connectionsToDelete.length} 个输入连接`, 'success');
        } else {
            Utils.showNotification('该节点没有输入连接', 'info');
        }
    }

    // 清除节点的所有输出连接
    clearNodeOutputConnections(nodeId) {
        const connectionsToDelete = [];

        this.connections.forEach((connection, connectionId) => {
            if (connection.from.nodeId === nodeId) {
                connectionsToDelete.push(connectionId);
            }
        });

        connectionsToDelete.forEach(connectionId => {
            this.deleteConnection(connectionId);
        });

        if (connectionsToDelete.length > 0) {
            Utils.showNotification(`已清除 ${connectionsToDelete.length} 个输出连接`, 'success');
        } else {
            Utils.showNotification('该节点没有输出连接', 'info');
        }
    }

    // 更新属性面板
    updatePropertyPanel() {
        const panel = document.getElementById('propertyPanel');

        if (!this.selectedNode) {
            panel.innerHTML = `
                <div class="no-selection">
                    <i class="fas fa-mouse-pointer"></i>
                    <p>选择一个节点来编辑属性</p>
                </div>
            `;
            return;
        }

        const node = this.nodes.get(this.selectedNode);
        if (!node) return;

        console.log(`[属性面板] 更新节点 ${node.id} 的属性面板, 当前配置:`, node.config);

        const info = node.getNodeInfo();
        panel.innerHTML = this.generatePropertyForm(node, info);

        // 绑定表单事件
        this.bindPropertyFormEvents(node);

        console.log(`[属性面板] 属性面板已更新，表单事件已绑定`);
    }

    // 生成属性表单
    generatePropertyForm(node, info) {
        let formHTML = `
            <div class="property-form">
                <div class="property-header">
                    <h4>属性面板：${info.title} - ${info.description}</h4>
                </div>
        `;

        // 基础属性
        formHTML += `
            <div class="form-group compact">
                <label>节点ID:</label>
                <input type="text" value="${node.id}" readonly>
            </div>
            <div class="form-group compact">
                <label>显示名称:</label>
                <input type="text" name="displayName" value="${node.config.displayName || ''}" placeholder="${info.title}">
            </div>
        `;

        // 输入变量映射
        formHTML += this.generateInputMappingSection(node, info);

        // 输出变量映射
        formHTML += this.generateOutputMappingSection(node, info);

        // 根据节点类型生成配置项
        switch (node.type) {
            case 'ai-chat':
            case 'ai-text-generation':
            case 'ai-text-analysis':
            case 'ai-image-generation':
            case 'ai-image-edit':
            case 'ai-image-variation':
            case 'ai-audio-transcription':
            case 'ai-text-to-speech':
                formHTML += this.generateAINodeForm(node);
                break;
            case 'file-input':
                formHTML += this.generateFileInputForm(node);
                break;
            case 'file-output':
                formHTML += this.generateFileOutputForm(node);
                break;
            case 'text-input':
                formHTML += this.generateTextInputForm(node);
                break;
            case 'optional-input':
                formHTML += this.generateOptionalInputForm(node);
                break;
            case 'condition':
                formHTML += this.generateConditionForm(node);
                break;
            case 'loop':
                formHTML += this.generateLoopForm(node);
                break;
            case 'delay':
                formHTML += this.generateDelayForm(node);
                break;
            case 'http-request':
                formHTML += this.generateHttpRequestForm(node);
                break;
            case 'json-parser':
                formHTML += this.generateJsonParserForm(node);
                break;
            case 'text-transform':
                formHTML += this.generateTextTransformForm(node);
                break;
            case 'text-splitter':
                formHTML += this.generateTextSplitterForm(node);
                break;
            case 'ai-chat-window':
                formHTML += this.generateAIChatWindowForm(node);
                break;
        }

        // 添加保存按钮
        formHTML += `
            <div class="form-actions">
                <button type="button" class="btn btn-primary" id="saveNodeConfig">
                    <i class="fas fa-save"></i> 保存配置
                </button>
                <button type="button" class="btn btn-secondary" id="resetNodeConfig">
                    <i class="fas fa-undo"></i> 重置
                </button>
            </div>
        `;

        formHTML += '</div>';
        return formHTML;
    }

    // 生成输入变量映射区域
    generateInputMappingSection(node, info) {
        // 检查是否有基础输入或自定义输入
        const varConfig = window.variableManager.getNodeVariableConfig(node.id);
        const hasBaseInputs = info.inputs && info.inputs.length > 0;
        const hasCustomInputs = varConfig.customInputs && varConfig.customInputs.length > 0;



        // 如果既没有基础输入也没有自定义输入，仍然显示区域以便添加自定义输入
        // 除非是纯输出节点（如文本输入、文件输入等）
        const isOutputOnlyNode = ['text-input', 'file-input'].includes(node.type);

        if (!hasBaseInputs && !hasCustomInputs && isOutputOnlyNode) {
            return '';
        }

        const globalVars = window.variableManager.getAllGlobalVariables();

        let formHTML = `
            <div class="mapping-section" id="input-mapping-section">
                <div class="section-header">
                    <h5><i class="fas fa-sign-in-alt"></i> 输入变量映射</h5>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" class="add-btn" id="addInputMapping">
                            <i class="fas fa-plus"></i> 输入
                        </button>
                        <button type="button" class="section-toggle" data-target="input-mapping">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
                <div class="mapping-content">
                    <div class="multi-input-config">
                        <label>多输入处理:</label>
                        <select name="multiInputMode" class="multi-input-select">
                            <option value="override" ${varConfig.multiInputMode === 'override' ? 'selected' : ''}>覆盖模式（最后输入有效）</option>
                            <option value="concat" ${varConfig.multiInputMode === 'concat' ? 'selected' : ''}>字符串拼接</option>
                            <option value="json" ${varConfig.multiInputMode === 'json' ? 'selected' : ''}>合并为JSON</option>
                            <option value="batch" ${varConfig.multiInputMode === 'batch' ? 'selected' : ''}>批量处理</option>
                        </select>
                    </div>
                    <div class="mapping-list" id="inputMappingsList">
        `;

        // 显示基础输入（来自节点定义）
        if (hasBaseInputs) {
            info.inputs.forEach((inputName, index) => {
                const mappedVar = varConfig.inputMappings[inputName] || this.getAutoInputMapping(node.id, inputName, index);

                formHTML += this.generateInputMappingItem(inputName, mappedVar, globalVars, varConfig, false);
            });
        }

        // 显示额外的自定义输入
        const customInputs = varConfig.customInputs || [];
        customInputs.forEach(inputName => {
            const mappedVar = varConfig.inputMappings[inputName] || '';
            formHTML += this.generateInputMappingItem(inputName, mappedVar, globalVars, varConfig, true);
        });

        // 如果没有任何输入，显示提示信息
        if (!hasBaseInputs && customInputs.length === 0) {
            formHTML += `
                <div class="no-items-message">
                    <p>暂无输入，点击"+ 输入"添加</p>
                </div>
            `;
        }

        formHTML += `
                    </div>
                </div>
            </div>
        `;

        return formHTML;
    }

    // 生成输出变量映射区域
    generateOutputMappingSection(node, info) {
        // 检查是否有基础输出或自定义输出
        const varConfig = window.variableManager.getNodeVariableConfig(node.id);
        const hasBaseOutputs = info.outputs && info.outputs.length > 0;
        const hasCustomOutputs = varConfig.customOutputs && varConfig.customOutputs.length > 0;



        // 大部分节点都应该支持输出，除了一些特殊的控制节点
        const isNonOutputNode = ['delay'].includes(node.type);

        if (!hasBaseOutputs && !hasCustomOutputs && isNonOutputNode) {
            return '';
        }

        const globalVars = window.variableManager.getAllGlobalVariables();

        let formHTML = `
            <div class="mapping-section" id="output-mapping-section">
                <div class="section-header">
                    <h5><i class="fas fa-sign-out-alt"></i> 输出变量映射</h5>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" class="add-btn" id="addOutputMapping">
                            <i class="fas fa-plus"></i> 输出
                        </button>
                        <button type="button" class="section-toggle" data-target="output-mapping">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
                <div class="mapping-content">
                    <div class="mapping-list" id="outputMappingsList">
        `;

        // 显示基础输出（来自节点定义）
        if (hasBaseOutputs) {
            info.outputs.forEach((outputName, index) => {
                const mappedVar = varConfig.outputMappings[outputName] || this.getAutoOutputMapping(node, outputName);
                const parseConfig = varConfig.outputParseConfig?.[outputName] || { mode: 'default' };

                formHTML += this.generateOutputMappingItem(outputName, mappedVar, globalVars, parseConfig, false);
            });
        }

        // 显示额外的自定义输出
        const customOutputs = varConfig.customOutputs || [];
        customOutputs.forEach(outputName => {
            const mappedVar = varConfig.outputMappings[outputName] || '';
            const parseConfig = varConfig.outputParseConfig?.[outputName] || { mode: 'default' };

            formHTML += this.generateOutputMappingItem(outputName, mappedVar, globalVars, parseConfig, true);
        });

        // 如果没有任何输出，显示提示信息
        if (!hasBaseOutputs && customOutputs.length === 0) {
            formHTML += `
                <div class="no-items-message">
                    <p>暂无输出，点击"+ 输出"添加</p>
                </div>
            `;
        }

        formHTML += `
                    </div>
                </div>
            </div>
        `;

        return formHTML;
    }

    // 获取自动输入映射
    getAutoInputMapping(nodeId, inputName, index) {
        // 查找连接到此节点的上游节点
        const connections = Array.from(window.workflowManager.connections.values());
        const inputConnections = connections.filter(conn =>
            conn.to.nodeId === nodeId && conn.to.input === inputName
        );

        if (inputConnections.length > 0) {
            // 如果有连接，使用第一个连接的源节点变量
            const sourceNode = window.workflowManager.getNode(inputConnections[0].from.nodeId);
            if (sourceNode) {
                return this.getNodeDisplayName(sourceNode);
            }
        }

        return '';
    }

    // 获取自动输出映射
    getAutoOutputMapping(node, outputName) {
        // 默认使用节点名作为变量名
        return this.getNodeDisplayName(node);
    }

    // 生成输入映射项
    generateInputMappingItem(inputName, mappedVar, globalVars, varConfig, isCustom = false) {
        const selectedVar = globalVars.find(v => v.name === mappedVar);
        const displayValue = selectedVar ?
            `${selectedVar.name} (${this.getVariableTypeDisplay(selectedVar.type)})` :
            '默认连接输入';

        return `
            <div class="mapping-row" data-input-name="${inputName}">
                <div class="mapping-name">
                    ${isCustom ?
                `<span class="name-display custom-name-display" onclick="this.parentElement.querySelector('.name-edit').style.display='inline'; this.style.display='none';">${inputName}</span>
                         <input type="text" class="name-edit" value="${inputName}" style="display:none;" data-input="${inputName}">` :
                `<span class="name-display" onclick="this.parentElement.querySelector('.name-edit').style.display='inline'; this.style.display='none';">${inputName}</span>
                         <input type="text" class="name-edit" value="${inputName}" style="display:none;" data-input="${inputName}">`
            }
                </div>
                <div class="mapping-value">
                    <select name="input_mapping_${inputName}" class="mapping-select">
                        <option value="">默认连接输入</option>
                        <option value="__NO_INPUT__" ${mappedVar === '__NO_INPUT__' ? 'selected' : ''}>无输入</option>
                        ${globalVars.map(variable => {
                const typeDisplay = this.getVariableTypeDisplay(variable.type);
                return `<option value="${variable.name}" ${variable.name === mappedVar ? 'selected' : ''}>${variable.name} (${typeDisplay})</option>`;
            }).join('')}
                    </select>
                </div>
                <div class="mapping-actions">
                    ${mappedVar ? `<button type="button" class="action-btn edit-variable" data-variable="${mappedVar}" title="编辑变量"><i class="fas fa-cog"></i></button>` : ''}
                    <button type="button" class="action-btn create-variable-for-input" data-input="${inputName}" title="创建变量"><i class="fas fa-plus"></i></button>
                    <button type="button" class="action-btn ${isCustom ? 'remove-input-mapping' : 'clear-input-mapping'}" data-input="${inputName}" title="${isCustom ? '删除输入' : '清空映射'}" ${!isCustom ? 'data-is-default="true"' : ''}><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }

    // 获取节点显示名称
    getNodeDisplayName(node) {
        if (node.displayName) {
            return node.displayName;
        }

        // 生成基于类型的显示名称
        const info = node.getNodeInfo();
        const baseTypeName = info.title;

        // 计算同类型节点的数量
        const sameTypeNodes = Array.from(this.nodes.values()).filter(n => n.type === node.type);
        const nodeIndex = sameTypeNodes.findIndex(n => n.id === node.id);
        const displayName = `${baseTypeName}${nodeIndex + 1}`;

        // 缓存显示名称
        node.displayName = displayName;

        return displayName;
    }

    // 生成输出映射项
    generateOutputMappingItem(outputName, mappedVar, globalVars, parseConfig, isCustom = false) {
        const selectedVar = globalVars.find(v => v.name === mappedVar);
        const displayValue = selectedVar ?
            `${selectedVar.name} (${this.getVariableTypeDisplay(selectedVar.type)})` :
            '默认节点变量';

        return `
            <div class="mapping-row" data-output-name="${outputName}">
                <div class="mapping-name">
                    ${isCustom ?
                `<span class="name-display custom-name-display" onclick="this.parentElement.querySelector('.name-edit').style.display='inline'; this.style.display='none';">${outputName}</span>
                         <input type="text" class="name-edit" value="${outputName}" style="display:none;" data-output="${outputName}">` :
                `<span class="name-display" onclick="this.parentElement.querySelector('.name-edit').style.display='inline'; this.style.display='none';">${outputName}</span>
                         <input type="text" class="name-edit" value="${outputName}" style="display:none;" data-output="${outputName}">`
            }
                </div>
                <div class="mapping-value">
                    <select name="output_mapping_${outputName}" class="mapping-select">
                        <option value="">默认节点变量</option>
                        <option value="__NO_OUTPUT__" ${mappedVar === '__NO_OUTPUT__' ? 'selected' : ''}>无输出</option>
                        ${globalVars.map(variable => {
                const typeDisplay = this.getVariableTypeDisplay(variable.type);
                return `<option value="${variable.name}" ${variable.name === mappedVar ? 'selected' : ''}>${variable.name} (${typeDisplay})</option>`;
            }).join('')}
                    </select>
                </div>
                <div class="mapping-actions">
                    ${mappedVar ? `<button type="button" class="action-btn edit-variable" data-variable="${mappedVar}" title="编辑变量"><i class="fas fa-cog"></i></button>` : ''}
                    <button type="button" class="action-btn create-variable-for-output" data-output="${outputName}" title="创建变量"><i class="fas fa-plus"></i></button>
                    <button type="button" class="action-btn ${isCustom ? 'remove-output-mapping' : 'clear-output-mapping'}" data-output="${outputName}" title="${isCustom ? '删除输出' : '清空映射'}" ${!isCustom ? 'data-is-default="true"' : ''}><i class="fas fa-trash"></i></button>
                </div>
            </div>
            ${parseConfig.mode !== 'default' ? this.generateParseConfigRow(outputName, parseConfig) : ''}
        `;
    }

    // 生成解析配置行
    generateParseConfigRow(outputName, parseConfig) {
        const defaultPlaceholders = {
            'delimiter': '开始符号|结束符号，例如：{|}',
            'field': '字段名，例如：poetry',
            'regex': '正则表达式，例如："([^"]*)"',
            'sequence': '行号，例如：1'
        };

        return `
            <div class="parse-config-row" data-output-name="${outputName}">
                <div class="parse-config-label">解析模式:</div>
                <div class="parse-config-content">
                    <select name="output_parse_mode_${outputName}" class="parse-mode-select">
                        <option value="default" ${parseConfig.mode === 'default' ? 'selected' : ''}>默认输出</option>
                        <option value="delimiter" ${parseConfig.mode === 'delimiter' ? 'selected' : ''}>分隔符解析</option>
                        <option value="field" ${parseConfig.mode === 'field' ? 'selected' : ''}>字段名匹配</option>
                        <option value="regex" ${parseConfig.mode === 'regex' ? 'selected' : ''}>正则表达式</option>
                        <option value="sequence" ${parseConfig.mode === 'sequence' ? 'selected' : ''}>序列提取</option>
                    </select>
                    ${parseConfig.mode !== 'default' ? `
                        <input type="text" name="output_parse_config_${outputName}" 
                               value="${parseConfig.config || (parseConfig.mode === 'delimiter' ? '{|}' : '')}" 
                               placeholder="${defaultPlaceholders[parseConfig.mode] || '解析配置'}" 
                               class="parse-config-input">
                    ` : ''}
                </div>
            </div>
        `;
    }

    // 获取解析模式提示
    getParseModeTip(mode) {
        const tips = {
            'delimiter': '分隔符解析：配置格式为"开始符号|结束符号"，默认为{|}',
            'field': '字段名匹配：输入JSON字段名或文本匹配模式',
            'regex': '正则表达式：使用标准正则表达式语法，支持捕获组',
            'sequence': '序列提取：输入行号（从1开始）来提取指定行的内容'
        };

        return tips[mode] || '';
    }

    // 添加自定义输入映射
    async addCustomInputMapping(node, form) {
        const result = await this.showAddInputDialog();
        if (!result) return;

        const { inputName, inputType, variableName } = result;

        const config = window.variableManager.getNodeVariableConfig(node.id);
        if (!config.customInputs) {
            config.customInputs = [];
        }

        if (config.customInputs.includes(inputName)) {
            Utils.showNotification('输入名称已存在', 'warning');
            return;
        }

        config.customInputs.push(inputName);

        // 设置输入类型配置
        if (!config.inputTypes) {
            config.inputTypes = {};
        }
        config.inputTypes[inputName] = inputType;

        // 如果选择了变量，设置映射
        if (variableName) {
            config.inputMappings[inputName] = variableName;
        }

        // 保存完整的配置
        window.variableManager.nodeVariables.set(node.id, config);

        // 更新节点的连接点
        this.updateNodeConnectionPoints(node);

        // 刷新属性面板
        this.updatePropertyPanel();



        Utils.showNotification(`已添加自定义输入"${inputName}"`, 'success');
    }

    // 移除自定义输入映射
    removeCustomInputMapping(node, inputName, form) {
        const config = window.variableManager.getNodeVariableConfig(node.id);
        if (config.customInputs) {
            config.customInputs = config.customInputs.filter(name => name !== inputName);
        }

        // 移除相关配置
        delete config.inputMappings[inputName];
        if (config.inputMergeMode) {
            delete config.inputMergeMode[inputName];
        }
        if (config.inputTypes) {
            delete config.inputTypes[inputName];
        }

        // 保存完整的配置
        window.variableManager.nodeVariables.set(node.id, config);

        // 更新节点的连接点
        this.updateNodeConnectionPoints(node);

        // 刷新属性面板
        this.updatePropertyPanel();
    }

    // 清空输入映射（默认映射重置为无输入）
    clearInputMapping(node, inputName, form) {
        const config = window.variableManager.getNodeVariableConfig(node.id);

        // 设置为无输入
        config.inputMappings[inputName] = '__NO_INPUT__';

        // 保存配置
        window.variableManager.nodeVariables.set(node.id, config);

        // 刷新属性面板
        this.updatePropertyPanel();

        Utils.showNotification(`已将输入"${inputName}"设置为无输入`, 'success');
    }

    // 添加自定义输出映射
    async addCustomOutputMapping(node, form) {
        const result = await this.showAddOutputDialog();
        if (!result) {
            return;
        }

        const { outputName, bindingType, existingVariable } = result;

        const config = window.variableManager.getNodeVariableConfig(node.id);
        if (!config.customOutputs) {
            config.customOutputs = [];
        }

        if (config.customOutputs.includes(outputName)) {
            Utils.showNotification('输出名称已存在', 'warning');
            return;
        }

        config.customOutputs.push(outputName);

        let variableName;
        let notificationMessage;

        if (bindingType === 'existing') {
            // 绑定现有变量
            variableName = existingVariable;
            config.outputMappings[outputName] = variableName;
            notificationMessage = `已添加输出"${outputName}"并绑定到现有变量"${variableName}"`;
        } else {
            // 创建新变量
            const displayName = this.getNodeDisplayName(node);
            variableName = `${displayName}_${outputName}`;

            try {
                if (!window.variableManager.getGlobalVariable(variableName)) {
                    window.variableManager.createGlobalVariable(
                        variableName,
                        'string',
                        '',
                        `${displayName}的${outputName}输出`
                    );

                    // 自动绑定到新创建的变量
                    config.outputMappings[outputName] = variableName;

                    console.log(`[工作流管理] 为自定义输出 ${outputName} 自动创建并绑定变量 ${variableName}`);
                }
                notificationMessage = `已添加输出"${outputName}"并创建全局变量"${variableName}"`;
            } catch (error) {
                console.warn(`创建自定义输出变量失败:`, error);
                notificationMessage = `已添加输出"${outputName}"，但创建变量失败`;
            }
        }

        // 保存完整的配置
        window.variableManager.nodeVariables.set(node.id, config);

        // 更新节点的连接点
        this.updateNodeConnectionPoints(node);

        // 刷新属性面板
        this.updatePropertyPanel();



        Utils.showNotification(notificationMessage, 'success');
    }

    // 更新节点连接点
    updateNodeConnectionPoints(node) {
        // 清除现有连接点
        const existingConnectionPoints = node.element.querySelectorAll('.connection-point');
        existingConnectionPoints.forEach(point => point.remove());

        // 获取节点基础信息和自定义配置
        const info = node.getNodeInfo();
        const varConfig = window.variableManager.getNodeVariableConfig(node.id);

        // 重新计算输入和输出列表
        const allInputs = [...(info.inputs || [])];
        if (varConfig.customInputs) {
            allInputs.push(...varConfig.customInputs);
        }

        const allOutputs = [...(info.outputs || [])];
        if (varConfig.customOutputs) {
            allOutputs.push(...varConfig.customOutputs);
        }

        // 添加输入连接点
        allInputs.forEach((inputName, index) => {
            const inputPoint = document.createElement('div');
            inputPoint.className = 'connection-point input';
            inputPoint.setAttribute('data-input', inputName);
            inputPoint.title = inputName;

            // 改进的位置计算：更紧凑，适应更多连接点
            const startY = 20; // 起始位置，更靠上
            let pointSpacing;

            if (allInputs.length <= 2) {
                pointSpacing = 20; // 少量连接点时使用正常间距
            } else if (allInputs.length <= 4) {
                pointSpacing = 15; // 中等数量时紧凑一些
            } else {
                pointSpacing = 12; // 大量连接点时最紧凑
            }

            inputPoint.style.top = `${startY + index * pointSpacing}px`;
            node.element.appendChild(inputPoint);
        });

        // 添加输出连接点
        allOutputs.forEach((outputName, index) => {
            const outputPoint = document.createElement('div');
            outputPoint.className = 'connection-point output';
            outputPoint.setAttribute('data-output', outputName);
            outputPoint.title = outputName;

            // 改进的位置计算：更紧凑，适应更多连接点
            const startY = 20; // 起始位置，更靠上
            let pointSpacing;

            if (allOutputs.length <= 2) {
                pointSpacing = 20; // 少量连接点时使用正常间距
            } else if (allOutputs.length <= 4) {
                pointSpacing = 15; // 中等数量时紧凑一些
            } else {
                pointSpacing = 12; // 大量连接点时最紧凑
            }

            outputPoint.style.top = `${startY + index * pointSpacing}px`;
            node.element.appendChild(outputPoint);
        });

        // 确保节点有足够的高度来容纳所有连接点
        this.adjustNodeHeightForConnections(node, Math.max(allInputs.length, allOutputs.length));

        // 重新绑定连接点事件
        node.element.querySelectorAll('.connection-point').forEach(point => {
            // 移除旧的事件监听器
            point.replaceWith(point.cloneNode(true));
        });

        // 重新绑定连接点事件
        node.element.querySelectorAll('.connection-point').forEach(point => {
            point.addEventListener('mousedown', node.onConnectionMouseDown.bind(node));
        });

        // 更新连接线
        this.updateConnections();

        console.log(`[工作流管理] 节点 ${node.id} 连接点已更新`);
    }

    // 调整节点高度以适应连接点
    adjustNodeHeightForConnections(node, maxConnections) {
        if (maxConnections <= 2) {
            return; // 少量连接点时不需要调整
        }

        let requiredHeight;
        if (maxConnections <= 4) {
            requiredHeight = 80; // 中等数量时的最小高度
        } else {
            // 大量连接点时计算所需高度
            const spacing = 12;
            const startY = 20;
            const bottomPadding = 20;
            requiredHeight = startY + (maxConnections - 1) * spacing + bottomPadding;
        }

        // 设置最小高度
        const currentHeight = parseInt(node.element.style.height) || 80;
        if (requiredHeight > currentHeight) {
            node.element.style.minHeight = requiredHeight + 'px';
        }
    }

    // 重命名输入映射
    renameInputMapping(node, oldName, newName) {
        const config = window.variableManager.getNodeVariableConfig(node.id);

        // 检查新名称是否已存在
        const nodeInfo = node.getNodeInfo();
        const allInputs = [...(nodeInfo.inputs || []), ...(config.customInputs || [])];
        if (allInputs.includes(newName) && newName !== oldName) {
            Utils.showNotification('输入名称已存在', 'warning');
            return false;
        }

        // 更新自定义输入列表
        if (config.customInputs && config.customInputs.includes(oldName)) {
            const index = config.customInputs.indexOf(oldName);
            config.customInputs[index] = newName;
        }

        // 更新映射配置
        if (config.inputMappings[oldName]) {
            config.inputMappings[newName] = config.inputMappings[oldName];
            delete config.inputMappings[oldName];
        }

        // 更新其他相关配置
        if (config.inputTypes && config.inputTypes[oldName]) {
            config.inputTypes[newName] = config.inputTypes[oldName];
            delete config.inputTypes[oldName];
        }

        if (config.inputMergeMode && config.inputMergeMode[oldName]) {
            config.inputMergeMode[newName] = config.inputMergeMode[oldName];
            delete config.inputMergeMode[oldName];
        }

        // 保存配置
        window.variableManager.nodeVariables.set(node.id, config);

        // 更新连接点
        this.updateNodeConnectionPoints(node);

        console.log(`[变量管理] 重命名输入: ${oldName} -> ${newName}`);
        return true;
    }

    // 重命名输出映射
    renameOutputMapping(node, oldName, newName) {
        const config = window.variableManager.getNodeVariableConfig(node.id);

        // 检查新名称是否已存在
        const nodeInfo = node.getNodeInfo();
        const allOutputs = [...(nodeInfo.outputs || []), ...(config.customOutputs || [])];
        if (allOutputs.includes(newName) && newName !== oldName) {
            Utils.showNotification('输出名称已存在', 'warning');
            return false;
        }

        // 更新自定义输出列表
        if (config.customOutputs && config.customOutputs.includes(oldName)) {
            const index = config.customOutputs.indexOf(oldName);
            config.customOutputs[index] = newName;
        }

        // 更新映射配置
        if (config.outputMappings[oldName]) {
            config.outputMappings[newName] = config.outputMappings[oldName];
            delete config.outputMappings[oldName];
        }

        // 更新解析配置
        if (config.outputParseConfig && config.outputParseConfig[oldName]) {
            config.outputParseConfig[newName] = config.outputParseConfig[oldName];
            delete config.outputParseConfig[oldName];
        }

        // 保存配置
        window.variableManager.nodeVariables.set(node.id, config);

        // 更新连接点
        this.updateNodeConnectionPoints(node);

        console.log(`[变量管理] 重命名输出: ${oldName} -> ${newName}`);
        return true;
    }

    // 移除自定义输出映射
    removeCustomOutputMapping(node, outputName, form) {
        const config = window.variableManager.getNodeVariableConfig(node.id);
        if (config.customOutputs) {
            config.customOutputs = config.customOutputs.filter(name => name !== outputName);
        }

        // 移除相关配置
        delete config.outputMappings[outputName];
        if (config.outputParseConfig) {
            delete config.outputParseConfig[outputName];
        }

        // 保存完整的配置
        window.variableManager.nodeVariables.set(node.id, config);

        // 更新节点的连接点
        this.updateNodeConnectionPoints(node);

        // 刷新属性面板
        this.updatePropertyPanel();

        Utils.showNotification(`已移除自定义输出"${outputName}"`, 'success');
    }

    // 清空输出映射（默认映射重置为无输出）
    clearOutputMapping(node, outputName, form) {
        const config = window.variableManager.getNodeVariableConfig(node.id);

        // 设置为无输出
        config.outputMappings[outputName] = '__NO_OUTPUT__';

        // 保存配置
        window.variableManager.nodeVariables.set(node.id, config);

        // 刷新属性面板
        this.updatePropertyPanel();

        Utils.showNotification(`已将输出"${outputName}"设置为无输出`, 'success');
    }

    // 获取变量类型显示名称
    getVariableTypeDisplay(type) {
        const typeNames = {
            string: '字符串',
            number: '数字',
            boolean: '布尔值',
            object: '对象',
            array: '数组'
        };
        return typeNames[type] || type;
    }

    // 格式化变量值显示
    formatVariableValue(value) {
        if (value === null || value === undefined) {
            return '空';
        }

        const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return str.length > 30 ? str.substring(0, 30) + '...' : str;
    }

    // AI节点表单
    generateAINodeForm(node) {
        let formHTML = `
            <div class="form-group">
                <label>提示词:</label>
                <textarea name="prompt" rows="3">${node.config.prompt || ''}</textarea>
            </div>
        `;

        // 为不同类型的AI节点添加特定字段
        if (node.type === 'ai-text-generation') {
            formHTML += `
                <div class="form-group">
                    <label>生成主题:</label>
                    <input type="text" name="topic" value="${node.config.topic || ''}" 
                           placeholder="输入生成主题">
                </div>
            `;
        } else if (node.type === 'ai-text-analysis') {
            formHTML += `
                <div class="form-group">
                    <label>分析文本:</label>
                    <textarea name="text" rows="3">${node.config.text || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>分析类型:</label>
                    <select name="analysisType">
                        <option value="sentiment" ${node.config.analysisType === 'sentiment' ? 'selected' : ''}>情感分析</option>
                        <option value="keywords" ${node.config.analysisType === 'keywords' ? 'selected' : ''}>关键词提取</option>
                        <option value="summary" ${node.config.analysisType === 'summary' ? 'selected' : ''}>文本摘要</option>
                    </select>
                </div>
            `;
        } else if (node.type === 'ai-image-generation') {
            formHTML += `
                <div class="form-group">
                    <label>图像模型:</label>
                    <select name="model">
                        <option value="dall-e-3" ${node.config.model === 'dall-e-3' ? 'selected' : ''}>DALL-E 3</option>
                        <option value="dall-e-2" ${node.config.model === 'dall-e-2' ? 'selected' : ''}>DALL-E 2</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>图像尺寸:</label>
                    <select name="size">
                        <option value="1024x1024" ${node.config.size === '1024x1024' ? 'selected' : ''}>1024×1024</option>
                        <option value="1792x1024" ${node.config.size === '1792x1024' ? 'selected' : ''}>1792×1024 (横向)</option>
                        <option value="1024x1792" ${node.config.size === '1024x1792' ? 'selected' : ''}>1024×1792 (纵向)</option>
                        ${node.config.model !== 'dall-e-3' ? `
                            <option value="512x512" ${node.config.size === '512x512' ? 'selected' : ''}>512×512</option>
                            <option value="256x256" ${node.config.size === '256x256' ? 'selected' : ''}>256×256</option>
                        ` : ''}
                    </select>
                </div>
                <div class="form-group">
                    <label>图像质量:</label>
                    <select name="quality">
                        <option value="standard" ${node.config.quality === 'standard' ? 'selected' : ''}>标准</option>
                        <option value="hd" ${node.config.quality === 'hd' ? 'selected' : ''}>高清</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>生成数量:</label>
                    <input type="number" name="count" value="${node.config.count || 1}" 
                           min="1" max="10" step="1">
                    <small class="form-text">DALL-E 3 只支持生成 1 张图像</small>
                </div>
            `;
        } else if (node.type === 'ai-image-edit') {
            formHTML += `
                <div class="form-group">
                    <label>图像模型:</label>
                    <select name="model">
                        <option value="dall-e-2" ${node.config.model === 'dall-e-2' ? 'selected' : ''}>DALL-E 2</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>图像尺寸:</label>
                    <select name="size">
                        <option value="1024x1024" ${node.config.size === '1024x1024' ? 'selected' : ''}>1024×1024</option>
                        <option value="512x512" ${node.config.size === '512x512' ? 'selected' : ''}>512×512</option>
                        <option value="256x256" ${node.config.size === '256x256' ? 'selected' : ''}>256×256</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>生成数量:</label>
                    <input type="number" name="count" value="${node.config.count || 1}" 
                           min="1" max="10" step="1">
                </div>
            `;
        } else if (node.type === 'ai-image-variation') {
            formHTML += `
                <div class="form-group">
                    <label>图像模型:</label>
                    <select name="model">
                        <option value="dall-e-2" ${node.config.model === 'dall-e-2' ? 'selected' : ''}>DALL-E 2</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>图像尺寸:</label>
                    <select name="size">
                        <option value="1024x1024" ${node.config.size === '1024x1024' ? 'selected' : ''}>1024×1024</option>
                        <option value="512x512" ${node.config.size === '512x512' ? 'selected' : ''}>512×512</option>
                        <option value="256x256" ${node.config.size === '256x256' ? 'selected' : ''}>256×256</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>生成数量:</label>
                    <input type="number" name="count" value="${node.config.count || 2}" 
                           min="1" max="10" step="1">
                </div>
            `;
        } else if (node.type === 'ai-audio-transcription') {
            formHTML += `
                <div class="form-group">
                    <label>转录模型:</label>
                    <select name="model">
                        <option value="whisper-1" ${node.config.model === 'whisper-1' ? 'selected' : ''}>Whisper-1</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>语言:</label>
                    <select name="language">
                        <option value="auto" ${node.config.language === 'auto' ? 'selected' : ''}>自动检测</option>
                        <option value="zh" ${node.config.language === 'zh' ? 'selected' : ''}>中文</option>
                        <option value="en" ${node.config.language === 'en' ? 'selected' : ''}>英语</option>
                        <option value="ja" ${node.config.language === 'ja' ? 'selected' : ''}>日语</option>
                        <option value="ko" ${node.config.language === 'ko' ? 'selected' : ''}>韩语</option>
                        <option value="fr" ${node.config.language === 'fr' ? 'selected' : ''}>法语</option>
                        <option value="de" ${node.config.language === 'de' ? 'selected' : ''}>德语</option>
                        <option value="es" ${node.config.language === 'es' ? 'selected' : ''}>西班牙语</option>
                        <option value="ru" ${node.config.language === 'ru' ? 'selected' : ''}>俄语</option>
                    </select>
                </div>
            `;
        } else if (node.type === 'ai-text-to-speech') {
            formHTML += `
                <div class="form-group">
                    <label>语音模型:</label>
                    <select name="model">
                        <option value="tts-1" ${node.config.model === 'tts-1' ? 'selected' : ''}>TTS-1</option>
                        <option value="tts-1-hd" ${node.config.model === 'tts-1-hd' ? 'selected' : ''}>TTS-1-HD</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>声音:</label>
                    <select name="voice">
                        <option value="alloy" ${node.config.voice === 'alloy' ? 'selected' : ''}>Alloy</option>
                        <option value="echo" ${node.config.voice === 'echo' ? 'selected' : ''}>Echo</option>
                        <option value="fable" ${node.config.voice === 'fable' ? 'selected' : ''}>Fable</option>
                        <option value="onyx" ${node.config.voice === 'onyx' ? 'selected' : ''}>Onyx</option>
                        <option value="nova" ${node.config.voice === 'nova' ? 'selected' : ''}>Nova</option>
                        <option value="shimmer" ${node.config.voice === 'shimmer' ? 'selected' : ''}>Shimmer</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>语速:</label>
                    <input type="number" name="speed" value="${node.config.speed || 1.0}" 
                           step="0.1" min="0.25" max="4.0">
                    <small class="form-text">范围：0.25 - 4.0</small>
                </div>
                <div class="form-group">
                    <label>文本内容:</label>
                    <textarea name="text" rows="3">${node.config.text || ''}</textarea>
                </div>
            `;
        }

        // 只有文本生成和分析类节点需要这些参数
        const textGenerationNodes = ['ai-chat', 'ai-text-generation', 'ai-text-analysis'];
        if (textGenerationNodes.includes(node.type)) {
            formHTML += `
                <div class="form-group">
                    <label>模型:</label>
                    <input type="text" name="model" value="${node.config.model || ''}" 
                           placeholder="留空使用全局配置">
                </div>
                <div class="form-group">
                    <label>Temperature:</label>
                    <input type="number" name="temperature" value="${node.config.temperature || 0.7}" 
                           step="0.1" min="0" max="2">
                </div>
                <div class="form-group">
                    <label>最大Token数:</label>
                    <input type="number" name="maxTokens" value="${node.config.maxTokens || 2048}" 
                           min="1" max="4096">
                </div>
            `;
        }

        return formHTML;
    }

    // 文件输入表单
    generateFileInputForm(node) {
        return `
            <div class="form-group">
                <label>文件类型:</label>
                <select name="fileType">
                    <option value="text" ${node.config.fileType === 'text' ? 'selected' : ''}>文本文件</option>
                    <option value="json" ${node.config.fileType === 'json' ? 'selected' : ''}>JSON文件</option>
                    <option value="csv" ${node.config.fileType === 'csv' ? 'selected' : ''}>CSV文件</option>
                    <option value="any" ${node.config.fileType === 'any' ? 'selected' : ''}>任意文件</option>
                </select>
            </div>
            <div class="form-group">
                <label>编码:</label>
                <select name="encoding">
                    <option value="utf-8" ${node.config.encoding === 'utf-8' ? 'selected' : ''}>UTF-8</option>
                    <option value="gbk" ${node.config.encoding === 'gbk' ? 'selected' : ''}>GBK</option>
                </select>
            </div>
        `;
    }

    // 文件输出表单
    generateFileOutputForm(node) {
        return `
            <div class="form-group">
                <label>文件名:</label>
                <input type="text" name="filename" value="${node.config.filename || 'output.txt'}">
            </div>
            <div class="form-group">
                <label>格式:</label>
                <select name="format">
                    <option value="text" ${node.config.format === 'text' ? 'selected' : ''}>文本</option>
                    <option value="json" ${node.config.format === 'json' ? 'selected' : ''}>JSON</option>
                    <option value="csv" ${node.config.format === 'csv' ? 'selected' : ''}>CSV</option>
                </select>
            </div>
        `;
    }

    // 文本输入表单
    generateTextInputForm(node) {
        return `
            <div class="form-group">
                <label>文本内容:</label>
                <textarea name="text" rows="5">${node.config.text || ''}</textarea>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" name="multiline" ${node.config.multiline ? 'checked' : ''}>
                    多行文本
                </label>
            </div>
        `;
    }

    // 可选输入表单
    generateOptionalInputForm(node) {
        return `
            <div class="form-group">
                <label>默认文本内容:</label>
                <textarea name="text" rows="4">${node.config.text || '默认输入内容'}</textarea>
            </div>
            <div class="form-group">
                <label>超时时间(秒):</label>
                <input type="number" name="timeout" value="${node.config.timeout || 20}" min="5" max="300">
                <small class="form-text">用户未输入时的等待时间，超时后使用默认值</small>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" name="multiline" ${node.config.multiline ? 'checked' : ''}>
                    多行输入
                </label>
            </div>
        `;
    }

    // 条件判断表单
    generateConditionForm(node) {
        return `
            <div class="form-group">
                <label>条件值:</label>
                <input type="text" name="condition" value="${node.config.condition || ''}">
            </div>
            <div class="form-group">
                <label>操作符:</label>
                <select name="operator">
                    <option value="equals" ${node.config.operator === 'equals' ? 'selected' : ''}>等于</option>
                    <option value="contains" ${node.config.operator === 'contains' ? 'selected' : ''}>包含</option>
                    <option value="empty" ${node.config.operator === 'empty' ? 'selected' : ''}>为空</option>
                    <option value="not_empty" ${node.config.operator === 'not_empty' ? 'selected' : ''}>不为空</option>
                </select>
            </div>
        `;
    }

    // 循环表单
    generateLoopForm(node) {
        return `
            <div class="form-group">
                <label>最大循环次数:</label>
                <input type="number" name="maxIterations" value="${node.config.maxIterations || 10}" min="1" max="100">
            </div>
            <div class="form-group">
                <label>循环条件:</label>
                <input type="text" name="condition" value="${node.config.condition || ''}">
            </div>
        `;
    }

    // 延时表单
    generateDelayForm(node) {
        return `
            <div class="form-group">
                <label>延时时间(毫秒):</label>
                <input type="number" name="duration" value="${node.config.duration || 1000}" min="0">
            </div>
        `;
    }

    // HTTP请求表单
    generateHttpRequestForm(node) {
        return `
            <div class="form-group">
                <label>URL:</label>
                <input type="url" name="url" value="${node.config.url || ''}">
            </div>
            <div class="form-group">
                <label>方法:</label>
                <select name="method">
                    <option value="GET" ${node.config.method === 'GET' ? 'selected' : ''}>GET</option>
                    <option value="POST" ${node.config.method === 'POST' ? 'selected' : ''}>POST</option>
                    <option value="PUT" ${node.config.method === 'PUT' ? 'selected' : ''}>PUT</option>
                    <option value="DELETE" ${node.config.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                </select>
            </div>
            <div class="form-group">
                <label>请求头(JSON):</label>
                <textarea name="headers" rows="3">${JSON.stringify(node.config.headers || {}, null, 2)}</textarea>
            </div>
            <div class="form-group">
                <label>请求体:</label>
                <textarea name="body" rows="3">${node.config.body || ''}</textarea>
            </div>
        `;
    }

    // JSON解析表单
    generateJsonParserForm(node) {
        return `
            <div class="form-group">
                <label>JSON路径:</label>
                <input type="text" name="path" value="${node.config.path || ''}" 
                       placeholder="例如: data.items.0.name">
            </div>
            <div class="form-group">
                <label>操作:</label>
                <select name="operation">
                    <option value="extract" ${node.config.operation === 'extract' ? 'selected' : ''}>提取</option>
                    <option value="validate" ${node.config.operation === 'validate' ? 'selected' : ''}>验证</option>
                </select>
            </div>
        `;
    }

    // 文本转换表单
    generateTextTransformForm(node) {
        return `
            <div class="form-group">
                <label>操作:</label>
                <select name="operation">
                    <option value="lowercase" ${node.config.operation === 'lowercase' ? 'selected' : ''}>转小写</option>
                    <option value="uppercase" ${node.config.operation === 'uppercase' ? 'selected' : ''}>转大写</option>
                    <option value="trim" ${node.config.operation === 'trim' ? 'selected' : ''}>去除空格</option>
                    <option value="replace" ${node.config.operation === 'replace' ? 'selected' : ''}>替换</option>
                </select>
            </div>
            <div class="form-group">
                <label>匹配模式(正则):</label>
                <input type="text" name="pattern" value="${node.config.pattern || ''}">
            </div>
            <div class="form-group">
                <label>替换为:</label>
                <input type="text" name="replacement" value="${node.config.replacement || ''}">
            </div>
        `;
    }

    // 文本分割表单
    generateTextSplitterForm(node) {
        return `
            <div class="form-group">
                <label>块大小:</label>
                <input type="number" name="chunkSize" value="${node.config.chunkSize || 1000}" min="100" max="5000">
            </div>
            <div class="form-group">
                <label>重叠字符数:</label>
                <input type="number" name="chunkOverlap" value="${node.config.chunkOverlap || 200}" min="0" max="1000">
            </div>
            <div class="form-group">
                <label>分隔符:</label>
                <input type="text" name="separator" value="${node.config.separator || '\\n\\n'}" 
                       placeholder="例如: \\n\\n 或 . 或 句号">
            </div>
        `;
    }

    // AI对话窗口表单
    generateAIChatWindowForm(node) {
        return `
            <div class="form-group">
                <label>模式说明:</label>
                <div class="info-text">
                    <p><strong>流处理模式：</strong>工作流输入直接发送给AI</p>
                    <p><strong>手动模式：</strong>输入放到输入框等待用户操作</p>
                </div>
            </div>
            <div class="form-group">
                <label>窗口标题:</label>
                <input type="text" name="title" value="${node.config.title || 'AI对话窗口'}">
            </div>
            <div class="form-group">
                <label>模型:</label>
                <select name="model">
                    <option value="gpt-3.5-turbo" ${node.config.model === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo</option>
                    <option value="gpt-4" ${node.config.model === 'gpt-4' ? 'selected' : ''}>GPT-4</option>
                    <option value="gpt-4-turbo" ${node.config.model === 'gpt-4-turbo' ? 'selected' : ''}>GPT-4 Turbo</option>
                    <option value="claude-3-sonnet" ${node.config.model === 'claude-3-sonnet' ? 'selected' : ''}>Claude 3 Sonnet</option>
                    <option value="local-model" ${node.config.model === 'local-model' ? 'selected' : ''}>本地模型</option>
                </select>
            </div>
            <div class="form-group">
                <label>系统提示:</label>
                <textarea name="prompt" rows="3">${node.config.prompt || '你是一个有用的AI助手。'}</textarea>
            </div>
            <div class="form-group">
                <label>输入模式:</label>
                <select name="inputMode">
                    <option value="stream" ${node.config.inputMode === 'stream' || !node.config.inputMode ? 'selected' : ''}>流处理模式（直接发送给AI）</option>
                    <option value="manual" ${node.config.inputMode === 'manual' ? 'selected' : ''}>手动模式（放入输入框，等待用户操作）</option>
                </select>
            </div>
            <div class="form-group">
                <label>输出模式:</label>
                <select name="outputMode">
                    <option value="auto" ${node.config.outputMode === 'auto' || !node.config.outputMode ? 'selected' : ''}>自动模式（输出最新AI回复）</option>
                    <option value="manual" ${node.config.outputMode === 'manual' ? 'selected' : ''}>手动模式（指定输出内容）</option>
                </select>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" name="autoResponse" ${node.config.autoResponse !== false ? 'checked' : ''}>
                    自动响应输入
                </label>
            </div>
            <div class="form-group" id="manualOutputGroup" style="${node.config.outputMode === 'manual' ? '' : 'display: none;'}">
                <label>手动输出内容:</label>
                <textarea name="manualOutput" rows="2">${node.config.manualOutput || ''}</textarea>
            </div>
        `;
    }

    // 绑定属性表单事件
    bindPropertyFormEvents(node) {
        const form = document.querySelector('.property-form');
        if (!form) {
            console.warn('未找到属性表单');
            return;
        }

        console.log('绑定表单事件，表单元素:', form);

        // 移除旧的事件监听器（如果存在）
        if (this.currentFormHandler) {
            form.removeEventListener('input', this.currentFormHandler);
            form.removeEventListener('change', this.currentFormHandler);
            form.removeEventListener('blur', this.currentFormHandler);
        }

        // 立即保存配置的函数
        const saveConfig = () => {
            console.log('开始保存配置...');

            const config = {};
            const inputs = form.querySelectorAll('input, textarea, select');

            // 收集变量映射信息
            const inputMappings = {};
            const outputMappings = {};
            const outputParseConfig = {};
            const inputMergeMode = {};

            console.log('找到的表单元素数量:', inputs.length);

            inputs.forEach(element => {
                const name = element.name;
                if (!name || element.readOnly) return;

                console.log(`处理字段: ${name}, 类型: ${element.type}, 值: ${element.value}`);

                // 处理输入变量映射
                if (name.startsWith('input_mapping_')) {
                    const inputName = name.replace('input_mapping_', '');
                    if (element.value) {
                        inputMappings[inputName] = element.value;
                    }
                    return;
                }

                // 处理输出变量映射
                if (name.startsWith('output_mapping_')) {
                    const outputName = name.replace('output_mapping_', '');
                    if (element.value) {
                        outputMappings[outputName] = element.value;
                    }
                    return;
                }

                // 处理输出解析模式
                if (name.startsWith('output_parse_mode_')) {
                    const outputName = name.replace('output_parse_mode_', '');
                    if (!outputParseConfig[outputName]) {
                        outputParseConfig[outputName] = {};
                    }
                    outputParseConfig[outputName].mode = element.value;
                    return;
                }

                // 处理输出解析配置
                if (name.startsWith('output_parse_config_')) {
                    const outputName = name.replace('output_parse_config_', '');
                    if (!outputParseConfig[outputName]) {
                        outputParseConfig[outputName] = {};
                    }
                    outputParseConfig[outputName].config = element.value;
                    return;
                }

                // 处理输入合并模式
                if (name.startsWith('input_merge_')) {
                    const inputName = name.replace('input_merge_', '');
                    inputMergeMode[inputName] = element.checked ? 'merge' : 'normal';
                    return;
                }

                // 处理常规配置字段
                if (element.type === 'checkbox') {
                    config[name] = element.checked;
                } else if (element.type === 'number') {
                    const numValue = parseFloat(element.value);
                    config[name] = isNaN(numValue) ? (name === 'maxTokens' ? 2048 : 0) : numValue;
                } else if (element.type === 'select-one') {
                    config[name] = element.value;
                } else if (name === 'headers' || name === 'documents') {
                    try {
                        config[name] = JSON.parse(element.value || (name === 'documents' ? '[]' : '{}'));
                    } catch {
                        config[name] = name === 'documents' ? [] : {};
                    }
                } else {
                    config[name] = element.value;
                }
            });

            console.log('收集到的配置:', config);
            console.log('收集到的输入映射:', inputMappings);
            console.log('收集到的输出映射:', outputMappings);
            console.log('收集到的解析配置:', outputParseConfig);

            // 更新节点配置
            node.updateConfig(config);

            // 获取当前变量配置并更新
            const currentVarConfig = window.variableManager.getNodeVariableConfig(node.id);

            // 保留自定义输入输出和现有映射，只更新修改的部分
            const finalInputMappings = { ...currentVarConfig.inputMappings, ...inputMappings };
            const finalOutputMappings = { ...currentVarConfig.outputMappings, ...outputMappings };

            // 保存变量映射配置
            const updatedConfig = {
                ...currentVarConfig,
                inputMappings: finalInputMappings,
                outputMappings: finalOutputMappings,
                outputParseConfig: { ...currentVarConfig.outputParseConfig, ...outputParseConfig },
                inputMergeMode: { ...currentVarConfig.inputMergeMode, ...inputMergeMode }
            };

            window.variableManager.configureNodeVariables(
                node.id,
                updatedConfig.inputMappings,
                updatedConfig.outputMappings
            );

            // 保存完整的配置到节点变量配置
            window.variableManager.nodeVariables.set(node.id, updatedConfig);

            console.log('节点配置已更新:', node.config);
            console.log('变量映射配置已更新:', updatedConfig);
        };

        // 防抖版本的保存函数
        const debouncedSave = Utils.debounce(saveConfig, 500);

        // 事件处理函数
        const handleFormChange = (e) => {
            console.log('表单变化事件触发:', e.type, e.target.name, e.target.value);
            debouncedSave();
        };

        // 绑定多种事件
        form.addEventListener('input', handleFormChange);
        form.addEventListener('change', handleFormChange);
        form.addEventListener('blur', handleFormChange, true); // 使用捕获阶段

        // 为每个输入字段单独绑定立即保存事件
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            // 键盘抬起时立即保存
            input.addEventListener('keyup', (e) => {
                console.log(`键盘抬起事件: ${e.target.name} = ${e.target.value}`);
                if (e.key === 'Enter' || e.key === 'Tab') {
                    console.log('立即保存配置');
                    saveConfig();
                }
            });

            // 失去焦点时保存
            input.addEventListener('blur', () => {
                console.log(`字段失去焦点: ${input.name} = ${input.value}`);
                saveConfig();
            });
        });

        // AI对话窗口特殊事件处理
        if (node.type === 'ai-chat-window') {
            // 输出模式切换显示/隐藏手动输出配置
            const outputModeSelect = form.querySelector('select[name="outputMode"]');
            const manualOutputGroup = form.querySelector('#manualOutputGroup');
            if (outputModeSelect && manualOutputGroup) {
                outputModeSelect.addEventListener('change', (e) => {
                    if (e.target.value === 'manual') {
                        manualOutputGroup.style.display = '';
                    } else {
                        manualOutputGroup.style.display = 'none';
                    }
                });
            }
        }

        // 绑定保存按钮事件
        const saveBtn = form.querySelector('#saveNodeConfig');
        const resetBtn = form.querySelector('#resetNodeConfig');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                console.log('手动保存按钮被点击');
                saveConfig();
                Utils.showNotification('节点配置已保存', 'success');
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                console.log('重置按钮被点击');
                // 重新生成表单以恢复默认值
                setTimeout(() => {
                    this.updatePropertyPanel();
                }, 0);
                Utils.showNotification('节点配置已重置', 'info');
            });
        }

        // 绑定变量管理事件
        this.bindVariableManagementEvents(node, form);

        // 保存处理器引用
        this.currentFormHandler = handleFormChange;

        console.log('表单事件绑定完成，包括保存和重置按钮');

        // 添加全局测试函数
        window.testConfigSave = () => {
            console.log('=== 配置保存测试 ===');
            console.log('当前节点ID:', node.id);
            console.log('当前节点配置:', node.config);
            console.log('表单元素:', form);
            console.log('表单输入字段:', form.querySelectorAll('input, textarea, select'));
            saveConfig();
            console.log('测试保存后的配置:', node.config);
        };

        console.log('已添加全局测试函数 window.testConfigSave()');
    }

    // 绑定变量管理事件
    bindVariableManagementEvents(node, form) {
        // 多输入处理模式变化
        const multiInputSelect = form.querySelector('.multi-input-select');
        if (multiInputSelect) {
            multiInputSelect.addEventListener('change', (e) => {
                const config = window.variableManager.getNodeVariableConfig(node.id);
                config.multiInputMode = e.target.value;
                window.variableManager.nodeVariables.set(node.id, config);
                console.log(`[变量管理] 节点 ${node.id} 多输入处理模式设置为: ${e.target.value}`);
            });
        }

        // 添加输入映射
        const addInputBtn = form.querySelector('#addInputMapping');
        if (addInputBtn) {
            addInputBtn.addEventListener('click', () => {
                this.addCustomInputMapping(node, form);
            });
        }

        // 添加输出映射
        const addOutputBtn = form.querySelector('#addOutputMapping');
        if (addOutputBtn) {
            addOutputBtn.addEventListener('click', () => {
                this.addCustomOutputMapping(node, form);
            });
        }

        // 删除输入映射
        form.querySelectorAll('.remove-input-mapping').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const inputName = e.target.closest('.remove-input-mapping').getAttribute('data-input');
                this.removeCustomInputMapping(node, inputName, form);
            });
        });

        // 清空输入映射
        form.querySelectorAll('.clear-input-mapping').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const inputName = e.target.closest('.clear-input-mapping').getAttribute('data-input');
                this.clearInputMapping(node, inputName, form);
            });
        });

        // 删除输出映射
        form.querySelectorAll('.remove-output-mapping').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const outputName = e.target.closest('.remove-output-mapping').getAttribute('data-output');
                this.removeCustomOutputMapping(node, outputName, form);
            });
        });

        // 清空输出映射
        form.querySelectorAll('.clear-output-mapping').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const outputName = e.target.closest('.clear-output-mapping').getAttribute('data-output');
                this.clearOutputMapping(node, outputName, form);
            });
        });

        // 输入变量映射变化
        form.querySelectorAll('select[name^="input_mapping_"]').forEach(select => {
            select.addEventListener('change', (e) => {
                const inputName = e.target.name.replace('input_mapping_', '');
                const variableName = e.target.value;

                const config = window.variableManager.getNodeVariableConfig(node.id);

                if (variableName) {
                    config.inputMappings[inputName] = variableName;
                } else {
                    delete config.inputMappings[inputName];
                }

                // 保存完整的配置
                window.variableManager.nodeVariables.set(node.id, config);

                console.log(`[变量管理] 节点 ${node.id} 输入 ${inputName} 映射到变量 ${variableName}`);
            });
        });

        // 输出变量映射变化
        form.querySelectorAll('select[name^="output_mapping_"]').forEach(select => {
            select.addEventListener('change', (e) => {
                const outputName = e.target.name.replace('output_mapping_', '');
                const variableName = e.target.value;

                const config = window.variableManager.getNodeVariableConfig(node.id);

                if (variableName) {
                    config.outputMappings[outputName] = variableName;
                } else {
                    delete config.outputMappings[outputName];
                }

                // 保存完整的配置
                window.variableManager.nodeVariables.set(node.id, config);

                console.log(`[变量管理] 节点 ${node.id} 输出 ${outputName} 映射到变量 ${variableName}`);
            });
        });

        // 为输入创建变量
        form.querySelectorAll('.create-variable-for-input').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const inputName = e.target.closest('.create-variable-for-input').getAttribute('data-input');
                const displayName = this.getNodeDisplayName(node);
                const suggestedName = `${displayName}_${inputName}_input`;

                const created = await this.showCreateVariableDialog(suggestedName, 'string', '', `${displayName}的${inputName}输入`);

                if (created) {
                    // 自动绑定到该输入
                    const config = window.variableManager.getNodeVariableConfig(node.id);
                    config.inputMappings[inputName] = suggestedName;

                    // 保存完整的配置
                    window.variableManager.nodeVariables.set(node.id, config);

                    // 刷新属性面板
                    this.updatePropertyPanel();

                    Utils.showNotification(`已创建变量"${suggestedName}"并绑定到输入"${inputName}"`, 'success');
                }
            });
        });

        // 输入名编辑
        form.querySelectorAll('.name-edit[data-input]').forEach(input => {
            input.addEventListener('blur', (e) => {
                const oldName = e.target.getAttribute('data-input');
                const newName = e.target.value.trim();

                if (newName && newName !== oldName) {
                    this.renameInputMapping(node, oldName, newName);
                }

                // 隐藏编辑框，显示显示框
                const nameDisplay = e.target.parentElement.querySelector('.name-display');
                if (nameDisplay) {
                    nameDisplay.textContent = newName || oldName;
                    nameDisplay.style.display = 'inline';
                    e.target.style.display = 'none';
                }
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });
        });

        // 输出名编辑
        form.querySelectorAll('.name-edit[data-output]').forEach(input => {
            input.addEventListener('blur', (e) => {
                const oldName = e.target.getAttribute('data-output');
                const newName = e.target.value.trim();

                if (newName && newName !== oldName) {
                    this.renameOutputMapping(node, oldName, newName);
                }

                // 隐藏编辑框，显示显示框
                const nameDisplay = e.target.parentElement.querySelector('.name-display');
                if (nameDisplay) {
                    nameDisplay.textContent = newName || oldName;
                    nameDisplay.style.display = 'inline';
                    e.target.style.display = 'none';
                }
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });
        });

        // 编辑变量按钮
        form.querySelectorAll('.edit-variable').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const variableName = e.target.closest('.edit-variable').getAttribute('data-variable');
                const edited = await this.showEditVariableDialog(variableName);
                if (edited) {
                    this.updatePropertyPanel();
                }
            });
        });

        // 为输出创建变量
        form.querySelectorAll('.create-variable-for-output').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const outputName = e.target.closest('.create-variable-for-output').getAttribute('data-output');
                const displayName = this.getNodeDisplayName(node);
                const suggestedName = `${displayName}_${outputName}`;

                // 根据节点类型和输出名称推断变量类型
                let defaultType = 'string';
                if (outputName === 'images' && ['ai-image-generation', 'ai-image-edit', 'ai-image-variation'].includes(node.type)) {
                    defaultType = 'image';
                } else if (outputName === 'audio' && ['ai-text-to-speech'].includes(node.type)) {
                    defaultType = 'audio';
                }

                const created = await this.showCreateVariableDialog(suggestedName, defaultType, '', `${displayName}的${outputName}输出`);

                if (created) {
                    // 自动绑定到该输出
                    const config = window.variableManager.getNodeVariableConfig(node.id);
                    config.outputMappings[outputName] = suggestedName;

                    // 保存完整的配置
                    window.variableManager.nodeVariables.set(node.id, config);

                    // 刷新属性面板
                    this.updatePropertyPanel();

                    Utils.showNotification(`已创建变量"${suggestedName}"并绑定到输出"${outputName}"`, 'success');
                }
            });
        });

        // 输出解析模式变化
        form.querySelectorAll('.parse-mode-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const outputName = e.target.name.replace('output_parse_mode_', '');
                const mode = e.target.value;
                const optionsDiv = form.querySelector(`#parseOptions_${outputName}`);

                if (optionsDiv) {
                    optionsDiv.style.display = mode !== 'default' ? 'block' : 'none';
                }

                // 保存解析配置
                const config = window.variableManager.getNodeVariableConfig(node.id);
                if (!config.outputParseConfig) {
                    config.outputParseConfig = {};
                }
                config.outputParseConfig[outputName] = { mode, config: '' };
                window.variableManager.configureNodeVariables(node.id, config.inputMappings, config.outputMappings);
            });
        });

        // 输出解析配置变化
        form.querySelectorAll('.parse-config-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const outputName = e.target.name.replace('output_parse_config_', '');
                const configValue = e.target.value;

                // 保存解析配置
                const config = window.variableManager.getNodeVariableConfig(node.id);
                if (!config.outputParseConfig) {
                    config.outputParseConfig = {};
                }
                if (!config.outputParseConfig[outputName]) {
                    config.outputParseConfig[outputName] = { mode: 'default' };
                }
                config.outputParseConfig[outputName].config = configValue;
                window.variableManager.configureNodeVariables(node.id, config.inputMappings, config.outputMappings);
            });
        });
    }

    // 显示创建变量对话框
    async showCreateVariableDialog(defaultName = '', defaultType = 'string', defaultValue = '', defaultDescription = '') {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-plus"></i> 创建全局变量</h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    ${this.generateVariableForm(defaultName, defaultType, defaultValue, defaultDescription)}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary cancel-btn">取消</button>
                    <button type="button" class="btn btn-primary create-btn">创建</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        return new Promise((resolve) => {
            const cleanup = () => {
                modal.classList.remove('show');
                setTimeout(() => {
                    if (modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                }, 300);
            };

            // 取消按钮
            modal.querySelector('.cancel-btn').onclick = () => {
                cleanup();
                resolve(false);
            };

            // 关闭按钮
            modal.querySelector('.close').onclick = () => {
                cleanup();
                resolve(false);
            };

            // 创建按钮
            modal.querySelector('.create-btn').onclick = async () => {
                try {
                    await this.handleVariableCreation(modal);
                    cleanup();
                    resolve(true);
                } catch (error) {
                    Utils.showNotification(`操作失败: ${error.message}`, 'error');
                }
            };

            // 点击模态框外部关闭
            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            };

            // 绑定事件处理
            this.bindModalEvents(modal);

            // 自动聚焦
            setTimeout(() => {
                const firstInput = modal.querySelector('input, select');
                if (firstInput) firstInput.focus();
            }, 100);
        });
    }    // 生成变量创建表单
    generateVariableForm(defaultName, defaultType, defaultValue, defaultDescription) {
        return `
            <div class="form-group">
                <label>变量名:</label>
                <input type="text" id="varName" value="${defaultName}" placeholder="输入变量名">
            </div>
            <div class="form-group">
                <label>变量类型:</label>
                <select id="varType" onchange="window.workflowManager.updateVariableInputType(this.value)">
                    <option value="string" ${defaultType === 'string' ? 'selected' : ''}>字符串</option>
                    <option value="number" ${defaultType === 'number' ? 'selected' : ''}>数字</option>
                    <option value="boolean" ${defaultType === 'boolean' ? 'selected' : ''}>布尔值</option>
                    <option value="object" ${defaultType === 'object' ? 'selected' : ''}>对象</option>
                    <option value="array" ${defaultType === 'array' ? 'selected' : ''}>数组</option>
                    <option value="image" ${defaultType === 'image' ? 'selected' : ''}>图片</option>
                    <option value="audio" ${defaultType === 'audio' ? 'selected' : ''}>音频</option>
                    <option value="video" ${defaultType === 'video' ? 'selected' : ''}>视频</option>
                    <option value="document" ${defaultType === 'document' ? 'selected' : ''}>文档</option>
                    <option value="largeText" ${defaultType === 'largeText' ? 'selected' : ''}>大文本</option>
                </select>
            </div>
            <div class="form-group" id="valueInputGroup">
                <label>初始值:</label>
                <textarea id="varValue" rows="3" placeholder="输入初始值">${defaultValue}</textarea>
            </div>
            <div class="form-group" id="fileInputGroup" style="display: none;">
                <div class="input-method-tabs">
                    <div class="tab-buttons">
                        <button type="button" class="tab-btn active" data-tab="file">
                            <i class="fas fa-upload"></i> 文件上传
                        </button>
                        <button type="button" class="tab-btn" data-tab="url">
                            <i class="fas fa-link"></i> URL载入
                        </button>
                    </div>
                    <div class="tab-content">
                        <div class="tab-panel active" data-panel="file">
                            <label>选择文件:</label>
                            <input type="file" id="varFile" accept="*/*">
                            <small class="form-text text-muted">选择要上传的文件</small>
                        </div>
                        <div class="tab-panel" data-panel="url">
                            <label>文件URL:</label>
                            <input type="url" id="urlFileUrl" placeholder="https://example.com/file.jpg">
                            <small class="form-text text-muted">输入文件的URL地址</small>
                            <div class="url-actions">
                                <button type="button" class="btn btn-sm btn-info" id="previewUrlBtn">
                                    <i class="fas fa-eye"></i> 预览
                                </button>
                            </div>
                            <div class="url-preview" id="urlModalPreview" style="display: none;">
                                <h6>预览:</h6>
                                <div class="preview-content" id="urlModalPreviewContent"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>描述:</label>
                <input type="text" id="varDescription" value="${defaultDescription}" placeholder="变量描述（可选）">
            </div>
        `;
    }

    // 生成URL载入表单
    generateUrlLoadForm() {
        return `
            <div class="form-group">
                <label for="urlFileUrl">文件URL:</label>
                <input type="url" id="urlFileUrl" placeholder="https://example.com/file.jpg" required>
                <small class="form-text text-muted">支持图片、音频、视频、文档等多种文件类型</small>
            </div>
            <div class="form-group">
                <label for="urlVarName">变量名:</label>
                <input type="text" id="urlVarName" placeholder="自动从URL生成">
                <small class="form-text text-muted">留空将自动从URL提取文件名</small>
            </div>
            <div class="form-group">
                <label for="urlVarDescription">描述 (可选):</label>
                <input type="text" id="urlVarDescription" placeholder="文件描述">
            </div>
            <div class="form-group">
                <button type="button" class="btn btn-info" id="previewUrlBtn">
                    <i class="fas fa-eye"></i> 预览
                </button>
            </div>
            <div class="url-preview" id="urlModalPreview" style="display: none;">
                <h6>预览:</h6>
                <div class="preview-content" id="urlModalPreviewContent"></div>
            </div>
        `;
    }

    // 绑定模态框事件
    bindModalEvents(modal) {
        // 文件类型变化事件
        const typeSelect = modal.querySelector('#varType');
        if (typeSelect) {
            this.updateVariableInputType(typeSelect.value);
        }

        // 绑定标签页切换事件
        const tabButtons = modal.querySelectorAll('.tab-btn');
        const tabPanels = modal.querySelectorAll('.tab-panel');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = btn.getAttribute('data-tab');

                // 更新按钮状态
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 更新面板显示
                tabPanels.forEach(panel => {
                    const panelTab = panel.getAttribute('data-panel');
                    if (panelTab === targetTab) {
                        panel.classList.add('active');
                    } else {
                        panel.classList.remove('active');
                    }
                });
            });
        });

        // URL预览事件
        const previewBtn = modal.querySelector('#previewUrlBtn');
        if (previewBtn) {
            previewBtn.onclick = () => this.previewUrlInModal(modal);
        }
    }

    // 更新变量输入类型
    updateVariableInputType(type) {
        const valueGroup = document.getElementById('valueInputGroup');
        const fileGroup = document.getElementById('fileInputGroup');
        const valueInput = document.getElementById('varValue');
        const fileInput = document.getElementById('varFile');

        if (!valueGroup || !fileGroup) return;

        const isFileType = ['image', 'audio', 'video', 'document'].includes(type);

        if (isFileType) {
            valueGroup.style.display = 'none';
            fileGroup.style.display = 'block';

            // 设置文件类型过滤
            if (fileInput) {
                switch (type) {
                    case 'image':
                        fileInput.accept = 'image/*';
                        break;
                    case 'audio':
                        fileInput.accept = 'audio/*';
                        break;
                    case 'video':
                        fileInput.accept = 'video/*';
                        break;
                    case 'document':
                        fileInput.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';
                        break;
                }
            }
        } else {
            valueGroup.style.display = 'block';
            fileGroup.style.display = 'none';

            // 根据类型调整输入框
            if (valueInput) {
                if (type === 'boolean') {
                    valueInput.outerHTML = `
                        <select id="varValue">
                            <option value="true">true</option>
                            <option value="false">false</option>
                        </select>
                    `;
                } else if (type === 'largeText') {
                    valueInput.rows = 8;
                    valueInput.placeholder = '请输入大段文本内容...';
                } else if (type === 'object') {
                    valueInput.rows = 4;
                    valueInput.placeholder = '{"key": "value"}';
                } else if (type === 'array') {
                    valueInput.rows = 4;
                    valueInput.placeholder = '["item1", "item2"]';
                } else if (type === 'number') {
                    valueInput.outerHTML = `<input type="number" id="varValue" placeholder="请输入数字">`;
                } else {
                    valueInput.rows = 3;
                    valueInput.placeholder = '输入初始值';
                }
            }
        }
    }

    // 处理变量创建
    async handleVariableCreation(modal) {
        const name = modal.querySelector('#varName').value.trim();
        const type = modal.querySelector('#varType').value;
        const description = modal.querySelector('#varDescription').value.trim();

        const isFileType = ['image', 'audio', 'video', 'document'].includes(type);
        let value;

        if (isFileType) {
            // 检查是否使用URL载入
            const urlInput = modal.querySelector('#urlFileUrl');
            const fileInput = modal.querySelector('#varFile');

            const hasUrl = urlInput && urlInput.value.trim();
            const hasFile = fileInput && fileInput.files[0];

            if (hasUrl) {
                // 使用URL载入
                const url = urlInput.value.trim();
                Utils.showNotification('正在从URL载入文件...', 'info');

                // 传递用户输入的名称（可能为空），让loadFromUrl方法处理名称生成和验证
                const storageItem = await window.variableManager.loadFromUrl(url, name || null, description);
                Utils.showNotification(`文件"${storageItem.name}"载入成功`, 'success');
            } else if (hasFile) {
                // 使用文件上传
                const file = fileInput.files[0];

                // 对于文件上传，如果用户未提供名称，则使用文件名
                const finalName = name || file.name.replace(/\.[^.]*$/, ''); // 移除扩展名
                await window.variableManager.handleFileUpload(file, finalName);
                Utils.showNotification(`成功创建${type}变量 "${finalName}"`, 'success');
            } else {
                throw new Error('请选择文件或输入URL');
            }
        } else {
            // 对于非文件类型，变量名是必需的
            if (!name) {
                throw new Error('变量名不能为空');
            }

            const valueInput = modal.querySelector('#varValue');
            let rawValue = valueInput?.value || '';

            // 根据类型解析值
            switch (type) {
                case 'number':
                    value = parseFloat(rawValue) || 0;
                    break;
                case 'boolean':
                    value = rawValue === 'true';
                    break;
                case 'object':
                case 'array':
                    try {
                        value = JSON.parse(rawValue || (type === 'array' ? '[]' : '{}'));
                    } catch (error) {
                        throw new Error('JSON格式错误');
                    }
                    break;
                default:
                    value = rawValue;
            }

            window.variableManager.createGlobalVariable(name, type, value, description);
            Utils.showNotification(`变量 "${name}" 创建成功`, 'success');
        }

        // 刷新变量列表
        if (window.uiManager && window.uiManager.safeRefreshVariablesList) {
            window.uiManager.safeRefreshVariablesList();
        }
    }

    // 处理URL载入
    async handleUrlLoad(modal) {
        const url = modal.querySelector('#urlFileUrl').value.trim();
        const name = modal.querySelector('#urlVarName').value.trim();
        const description = modal.querySelector('#urlVarDescription').value.trim();

        if (!url) {
            throw new Error('请输入URL');
        }

        Utils.showNotification('正在载入文件...', 'info');

        const storageItem = await window.variableManager.loadFromUrl(url, name, description);
        Utils.showNotification(`文件"${storageItem.name}"载入成功`, 'success');

        // 刷新变量列表
        if (window.uiManager && window.uiManager.safeRefreshVariablesList) {
            window.uiManager.safeRefreshVariablesList();
        }
    }

    // 在模态框中预览URL内容
    async previewUrlInModal(modal) {
        try {
            const url = modal.querySelector('#urlFileUrl').value.trim();
            if (!url) {
                Utils.showNotification('请输入URL', 'error');
                return;
            }

            const previewDiv = modal.querySelector('#urlModalPreview');
            const contentDiv = modal.querySelector('#urlModalPreviewContent');

            if (previewDiv && contentDiv) {
                previewDiv.style.display = 'block';
                contentDiv.innerHTML = '<div class="loading-spinner">预览中...</div>';

                const previewInfo = await window.variableManager.previewUrl(url);

                let previewHtml = `
                    <div class="preview-info">
                        <div class="preview-filename">${previewInfo.fileName}</div>
                        <div class="preview-type">类型: ${previewInfo.storageType} (${previewInfo.contentType})</div>
                        <div class="preview-size">大小: ${this.formatFileSize(previewInfo.size)}</div>
                    </div>
                `;

                if (previewInfo.previewUrl) {
                    previewHtml = `
                        <div class="preview-content">
                            <img src="${previewInfo.previewUrl}" class="preview-thumbnail" alt="预览" style="max-width: 200px; max-height: 150px;">
                            ${previewHtml}
                        </div>
                    `;
                }

                contentDiv.innerHTML = previewHtml;

                // 自动填入变量名称
                const nameInput = modal.querySelector('#urlVarName');
                if (nameInput && !nameInput.value) {
                    nameInput.value = previewInfo.fileName;
                }
            }

        } catch (error) {
            console.error('预览失败:', error);
            Utils.showNotification(`预览失败: ${error.message}`, 'error');

            const contentDiv = modal.querySelector('#urlModalPreviewContent');
            if (contentDiv) {
                contentDiv.innerHTML = `<div class="text-danger">预览失败: ${error.message}</div>`;
            }
        }
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 显示编辑变量对话框
    async showEditVariableDialog(variableName) {
        const variable = window.variableManager.getGlobalVariable(variableName);
        if (!variable) {
            Utils.showNotification('变量不存在', 'error');
            return;
        }

        const popupConfig = variable.popupConfig || {};

        const modalContent = `
            <div class="variable-form">
                <div class="form-group">
                    <label>变量名:</label>
                    <input type="text" value="${variable.name}" readonly>
                </div>
                <div class="form-group">
                    <label>变量类型:</label>
                    <input type="text" value="${this.getVariableTypeDisplay(variable.type)}" readonly>
                </div>
                <div class="form-group">
                    <label>当前值:</label>
                    <textarea id="editVarValue" rows="4">${typeof variable.value === 'object' ? JSON.stringify(variable.value, null, 2) : variable.value}</textarea>
                </div>
                <div class="form-group">
                    <label>描述:</label>
                    <input type="text" id="editVarDescription" value="${variable.description || ''}" placeholder="变量描述（可选）">
                </div>
                
                <div class="popup-config-section">
                    <h4><i class="fas fa-window-maximize"></i> 弹窗配置</h4>
                    <div class="popup-options">
                        <label class="checkbox-label">
                            <input type="checkbox" id="enableInputPopup" ${popupConfig.inputPopup ? 'checked' : ''}>
                            <span>输入时弹窗</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" id="enableOutputPopup" ${popupConfig.outputPopup ? 'checked' : ''}>
                            <span>输出时弹窗(审核)</span>
                        </label>
                    </div>
                    <div class="timeout-config">
                        <label for="popupTimeout">超时时间:</label>
                        <input type="number" id="popupTimeout" value="${(popupConfig.timeout || 20000) / 1000}" min="5" max="300">
                        <span>秒</span>
                    </div>
                </div>
            </div>
        `;

        return new Promise((resolve) => {
            const testPopup = async () => {
                const inputPopup = document.getElementById('enableInputPopup').checked;
                const outputPopup = document.getElementById('enableOutputPopup').checked;
                const timeout = parseInt(document.getElementById('popupTimeout').value) * 1000;

                try {
                    // 测试输入弹窗
                    if (inputPopup) {
                        const result = await window.popupManager.showVariableInputPopup(
                            'test',
                            variableName,
                            variable.value,
                            timeout
                        );
                        console.log('输入弹窗测试结果:', result);
                    }

                    // 测试输出弹窗
                    if (outputPopup) {
                        const result = await window.popupManager.showVariableOutputPopup(
                            'test',
                            variableName,
                            variable.value,
                            timeout
                        );
                        console.log('输出弹窗测试结果:', result);
                    }

                    if (!inputPopup && !outputPopup) {
                        Utils.showNotification('该变量未启用弹窗功能', 'warning');
                    }
                } catch (error) {
                    console.log('弹窗测试被取消或发生错误:', error);
                }
            };

            const saveVariable = () => {
                const newValue = document.getElementById('editVarValue').value;
                const newDescription = document.getElementById('editVarDescription').value.trim();
                const inputPopup = document.getElementById('enableInputPopup').checked;
                const outputPopup = document.getElementById('enableOutputPopup').checked;
                const timeout = parseInt(document.getElementById('popupTimeout').value) * 1000;

                try {
                    // 更新变量值和描述
                    window.variableManager.updateGlobalVariable(variableName, newValue, true, newDescription);

                    // 更新弹窗配置
                    window.variableManager.updateVariablePopupConfig(variableName, {
                        inputPopup,
                        outputPopup,
                        timeout
                    });

                    Utils.hideModal();
                    this.updatePropertyPanel(); // 刷新面板
                    Utils.showNotification(`变量 "${variableName}" 更新成功`, 'success');
                    resolve(true);
                } catch (error) {
                    Utils.showNotification(`更新变量失败: ${error.message}`, 'error');
                }
            };

            Utils.showModal(`编辑变量: ${variableName}`, modalContent, [
                {
                    text: '取消',
                    type: 'secondary',
                    onclick: () => {
                        Utils.hideModal();
                        resolve(false);
                    }
                },
                {
                    text: '测试弹窗',
                    type: 'warning',
                    onclick: testPopup
                },
                {
                    text: '保存',
                    type: 'primary',
                    onclick: saveVariable
                }
            ]);
        });
    }

    // 显示确认对话框
    async showConfirmDialog(message, title = '确认') {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-question-circle"></i> ${title}</h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary cancel-btn">取消</button>
                    <button type="button" class="btn btn-danger confirm-btn">确认</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        return new Promise((resolve) => {
            const cleanup = () => {
                modal.classList.remove('show');
                setTimeout(() => {
                    if (modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                }, 300);
            };

            // 取消按钮
            modal.querySelector('.cancel-btn').onclick = () => {
                cleanup();
                resolve(false);
            };

            // 关闭按钮
            modal.querySelector('.close').onclick = () => {
                cleanup();
                resolve(false);
            };

            // 确认按钮
            modal.querySelector('.confirm-btn').onclick = () => {
                cleanup();
                resolve(true);
            };

            // 点击模态框外部关闭
            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            };
        });
    }

    // 显示添加输入对话框
    async showAddInputDialog() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-plus"></i> 添加自定义输入</h3>
                    <span class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>输入名称:</label>
                        <input type="text" id="inputName" placeholder="请输入输入名称" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>输入类型:</label>
                        <select id="inputType" class="form-control">
                            <option value="variable">变量输入（选择已有全局变量）</option>
                            <option value="immediate">即时输入（执行时弹出输入框）</option>
                            <option value="file">即时文件输入（执行时选择文件）</option>
                            <option value="optional">可选输入（执行时可跳过的输入）</option>
                        </select>
                    </div>
                    <div class="form-group" id="variableSelection">
                        <label>选择变量:</label>
                        <select id="selectedVariable" class="form-control">
                            <option value="">请选择变量</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="cancelAddInput">取消</button>
                    <button type="button" class="btn btn-primary" id="confirmAddInput">确定</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 填充变量选择下拉框
        const variableSelect = modal.querySelector('#selectedVariable');
        const globalVars = window.variableManager.getAllGlobalVariables();
        globalVars.forEach(variable => {
            const option = document.createElement('option');
            option.value = variable.name;
            option.textContent = `${variable.name} (${this.getVariableTypeDisplay(variable.type)})`;
            variableSelect.appendChild(option);
        });

        // 输入类型变化时切换变量选择显示
        const inputTypeSelect = modal.querySelector('#inputType');
        const variableSelection = modal.querySelector('#variableSelection');

        inputTypeSelect.addEventListener('change', () => {
            variableSelection.style.display = inputTypeSelect.value === 'variable' ? 'block' : 'none';
        });

        return new Promise((resolve) => {
            modal.querySelector('#confirmAddInput').onclick = () => {
                const inputName = modal.querySelector('#inputName').value.trim();
                const inputType = modal.querySelector('#inputType').value;
                const variableName = modal.querySelector('#selectedVariable').value;

                if (!inputName) {
                    Utils.showNotification('请输入名称', 'warning');
                    return;
                }

                if (inputType === 'variable' && !variableName) {
                    Utils.showNotification('请选择变量', 'warning');
                    return;
                }

                cleanup();
                resolve({
                    inputName,
                    inputType,
                    variableName: inputType === 'variable' ? variableName : null
                });
            };

            modal.querySelector('#cancelAddInput').onclick = () => {
                cleanup();
                resolve(null);
            };

            // 点击模态框外部关闭
            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(null);
                }
            };

            // 清理函数
            function cleanup() {
                modal.classList.remove('show');
                setTimeout(() => {
                    if (modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                }, 300);
            }
        });
    }

    // 显示添加输出对话框
    async showAddOutputDialog() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-plus"></i> 添加自定义输出</h3>
                    <span class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>输出名称:</label>
                        <input type="text" id="outputName" placeholder="请输入输出名称" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>绑定方式:</label>
                        <select id="bindingType" class="form-control">
                            <option value="create">创建新的全局变量</option>
                            <option value="existing">绑定现有全局变量</option>
                        </select>
                    </div>
                    <div class="form-group" id="existingVariableSelection" style="display: none;">
                        <label>选择现有变量:</label>
                        <select id="selectedExistingVariable" class="form-control">
                            <option value="">请选择变量</option>
                        </select>
                    </div>
                    <div class="info-text" id="createInfo">
                        <i class="fas fa-info-circle"></i>
                        系统将自动创建对应的全局变量并绑定到此输出。
                    </div>
                    <div class="info-text" id="bindInfo" style="display: none;">
                        <i class="fas fa-link"></i>
                        此输出将更新选中的全局变量。
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="cancelAddOutput">取消</button>
                    <button type="button" class="btn btn-primary" id="confirmAddOutput">确定</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 填充现有变量下拉框
        const existingVariableSelect = modal.querySelector('#selectedExistingVariable');
        const globalVars = window.variableManager.getAllGlobalVariables();
        globalVars.forEach(variable => {
            const option = document.createElement('option');
            option.value = variable.name;
            option.textContent = `${variable.name} (${this.getVariableTypeDisplay(variable.type)})`;
            existingVariableSelect.appendChild(option);
        });

        // 绑定方式变化时切换UI
        const bindingTypeSelect = modal.querySelector('#bindingType');
        const existingVariableSelection = modal.querySelector('#existingVariableSelection');
        const createInfo = modal.querySelector('#createInfo');
        const bindInfo = modal.querySelector('#bindInfo');

        bindingTypeSelect.addEventListener('change', () => {
            const isExisting = bindingTypeSelect.value === 'existing';
            existingVariableSelection.style.display = isExisting ? 'block' : 'none';
            createInfo.style.display = isExisting ? 'none' : 'block';
            bindInfo.style.display = isExisting ? 'block' : 'none';
        });

        return new Promise((resolve) => {
            modal.querySelector('#confirmAddOutput').onclick = () => {
                const outputName = modal.querySelector('#outputName').value.trim();
                const bindingType = modal.querySelector('#bindingType').value;
                const existingVariable = modal.querySelector('#selectedExistingVariable').value;

                if (!outputName) {
                    Utils.showNotification('请输入输出名称', 'warning');
                    return;
                }

                if (bindingType === 'existing' && !existingVariable) {
                    Utils.showNotification('请选择要绑定的变量', 'warning');
                    return;
                }

                cleanup();
                resolve({
                    outputName,
                    bindingType,
                    existingVariable: bindingType === 'existing' ? existingVariable : null
                });
            };

            modal.querySelector('#cancelAddOutput').onclick = () => {
                cleanup();
                resolve(null);
            };

            // 点击模态框外部关闭
            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(null);
                }
            };

            // 清理函数
            function cleanup() {
                modal.classList.remove('show');
                setTimeout(() => {
                    if (modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                    }
                }, 300);
            }
        });
    }

    // 清空工作流
    clear() {
        this.nodes.clear();
        this.connections.clear();
        this.selectedNode = null;

        this.nodeContainer.innerHTML = '';
        this.connectionSvg.innerHTML = '';

        this.updatePropertyPanel();
    }

    // 导出工作流
    exportWorkflow() {
        const data = {
            nodes: Array.from(this.nodes.values()).map(node => node.toJSON()),
            connections: Array.from(this.connections.values()),
            metadata: {
                created: new Date().toISOString(),
                version: '1.0.0'
            }
        };

        const filename = `workflow_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        Utils.downloadFile(JSON.stringify(data, null, 2), filename);

        Utils.showNotification('工作流已导出', 'success');
    }

    // 加载预设工作流
    loadPresetWorkflow(presetId) {
        const preset = window.appConfig.getPresetWorkflow(presetId);
        if (!preset) {
            Utils.showNotification('预设工作流不存在', 'error');
            return;
        }

        try {
            // 清空当前工作流
            this.clear();

            // 创建节点映射表（索引 -> 节点ID）
            const nodeMap = new Map();

            // 创建节点
            preset.nodes.forEach((nodeData, index) => {
                const node = this.createNode(nodeData.type, {
                    x: nodeData.x,
                    y: nodeData.y,
                    config: nodeData.config
                });

                nodeMap.set(index, node.id);
            });

            // 创建连接
            if (preset.connections) {
                preset.connections.forEach(conn => {
                    const fromNodeId = nodeMap.get(conn.from);
                    const toNodeId = nodeMap.get(conn.to);

                    if (fromNodeId && toNodeId) {
                        this.createConnection(
                            fromNodeId,
                            conn.fromOutput,
                            toNodeId,
                            conn.toInput
                        );
                    }
                });
            }

            Utils.showNotification(`已加载预设工作流: ${preset.name}`, 'success');
        } catch (error) {
            console.error('加载预设工作流失败:', error);
            Utils.showNotification('加载预设工作流失败', 'error');
        }
    }

    // 导入工作流
    async importWorkflow(file) {
        try {
            const content = await Utils.readFile(file);
            const data = JSON.parse(content);

            // 清空当前工作流
            this.clear();

            // 导入节点
            if (data.nodes) {
                data.nodes.forEach(nodeData => {
                    const node = WorkflowNode.fromJSON(nodeData);
                    this.nodes.set(node.id, node);
                    this.nodeContainer.appendChild(node.element);
                });
            }

            // 导入连接
            if (data.connections) {
                data.connections.forEach(connection => {
                    this.connections.set(connection.id, connection);

                    // 更新节点连接信息
                    const fromNode = this.nodes.get(connection.from.nodeId);
                    const toNode = this.nodes.get(connection.to.nodeId);

                    if (fromNode && toNode) {
                        fromNode.addOutputConnection(
                            connection.from.output,
                            connection.to.nodeId,
                            connection.to.input
                        );
                        toNode.addInputConnection(
                            connection.to.input,
                            connection.from.nodeId,
                            connection.from.output
                        );

                        this.drawConnection(connection);
                    }
                });
            }

            Utils.showNotification('工作流已导入', 'success');

        } catch (error) {
            console.error('导入工作流失败:', error);
            Utils.showNotification('导入工作流失败: ' + error.message, 'error');
        }
    }

    // 保存到本地存储
    save() {
        const data = {
            nodes: Array.from(this.nodes.values()).map(node => node.toJSON()),
            connections: Array.from(this.connections.values()),
            metadata: {
                saved: new Date().toISOString(),
                version: '1.0.0'
            }
        };

        try {
            localStorage.setItem('ai-workflow-data', JSON.stringify(data));
            Utils.showNotification('工作流已保存', 'success');
        } catch (error) {
            console.error('保存工作流失败:', error);
            Utils.showNotification('保存工作流失败', 'error');
        }
    }

    // 从本地存储加载
    load() {
        try {
            const saved = localStorage.getItem('ai-workflow-data');
            if (saved) {
                const data = JSON.parse(saved);

                // 清空当前工作流
                this.clear();

                // 导入节点
                if (data.nodes) {
                    data.nodes.forEach(nodeData => {
                        const node = WorkflowNode.fromJSON(nodeData);
                        this.nodes.set(node.id, node);
                        this.nodeContainer.appendChild(node.element);
                    });
                }

                // 导入连接
                if (data.connections) {
                    data.connections.forEach(connection => {
                        this.connections.set(connection.id, connection);

                        // 更新节点连接信息
                        const fromNode = this.nodes.get(connection.from.nodeId);
                        const toNode = this.nodes.get(connection.to.nodeId);

                        if (fromNode && toNode) {
                            fromNode.addOutputConnection(
                                connection.from.output,
                                connection.to.nodeId,
                                connection.to.input
                            );
                            toNode.addInputConnection(
                                connection.to.input,
                                connection.from.nodeId,
                                connection.from.output
                            );

                            this.drawConnection(connection);
                        }
                    });
                }

                Utils.showNotification('工作流已加载', 'success');
            } else {
                Utils.showNotification('没有保存的工作流', 'info');
            }
        } catch (error) {
            console.error('加载工作流失败:', error);
            Utils.showNotification('加载工作流失败', 'error');
        }
    }
}

// 创建全局工作流管理器实例
window.workflowManager = new WorkflowManager();

// 注册自定义节点类型
if (typeof AIChatWindowNode !== 'undefined') {
    window.workflowManager.registerNodeType('ai-chat-window', AIChatWindowNode);
}
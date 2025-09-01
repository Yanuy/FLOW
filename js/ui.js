// UI交互模块 - 简化版本
class UIManager {
    constructor() {
        this.initializeEventListeners();
        this.initializeModals();
        this.initializeContextMenu();
        this.initializeDragAndDrop();
        this.initializeNodeSizeSettings();
    }

    // 初始化事件监听器
    initializeEventListeners() {
        // 工具栏按钮事件
        document.getElementById('playBtn').addEventListener('click', () => {
            window.workflowExecutor.executeWorkflow();
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            window.workflowExecutor.stopExecution();
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
            window.workflowManager.save();
        });

        document.getElementById('loadBtn').addEventListener('click', () => {
            window.workflowManager.load();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            window.workflowManager.exportWorkflow();
        });

        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                window.workflowManager.importWorkflow(e.target.files[0]);
                e.target.value = ''; // 清空选择
            }
        });

        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettingsModal();
        });

        document.getElementById('presetsBtn').addEventListener('click', () => {
            this.showPresetsModal();
        });

        document.getElementById('variablesBtn').addEventListener('click', () => {
            this.showVariablesModal();
        });

        // 执行状态面板关闭按钮
        document.getElementById('closeStatus').addEventListener('click', () => {
            window.workflowExecutor.hideExecutionStatus();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // 窗口大小改变时更新连接线
        window.addEventListener('resize', Utils.debounce(() => {
            window.workflowManager.updateConnections();
        }, 250));
    }

    // 初始化模态框
    initializeModals() {
        // 设置模态框
        const settingsModal = document.getElementById('settingsModal');
        const closeBtn = settingsModal.querySelector('.close');
        const cancelBtn = document.getElementById('cancelSettings');
        const saveBtn = document.getElementById('saveSettings');

        closeBtn.addEventListener('click', () => {
            this.hideSettingsModal();
        });

        cancelBtn.addEventListener('click', () => {
            this.hideSettingsModal();
        });

        saveBtn.addEventListener('click', () => {
            this.saveSettings();
        });

        // 点击模态框外部关闭
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                this.hideSettingsModal();
            }
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideSettingsModal();
                this.hidePresetsModal();
                this.hideVariablesModal();
            }
        });

        // 预设模板模态框
        const presetsModal = document.getElementById('presetsModal');
        const presetsCloseBtn = document.getElementById('closePresets');
        const presetsCancelBtn = document.getElementById('cancelPresets');

        presetsCloseBtn.addEventListener('click', () => {
            this.hidePresetsModal();
        });

        presetsCancelBtn.addEventListener('click', () => {
            this.hidePresetsModal();
        });

        // 点击模态框外部关闭
        presetsModal.addEventListener('click', (e) => {
            if (e.target === presetsModal) {
                this.hidePresetsModal();
            }
        });

        // 变量管理模态框事件将在创建时动态绑定
    }

    // 初始化上下文菜单
    initializeContextMenu() {
        const contextMenu = document.getElementById('contextMenu');

        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.workflow-node')) {
                e.preventDefault();
                this.showContextMenu(e.clientX, e.clientY);
            }
        });

        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // 上下文菜单项点击
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-item')?.getAttribute('data-action');
            if (action) {
                this.handleContextAction(action);
                this.hideContextMenu();
            }
        });
    }

    // 初始化拖拽功能
    initializeDragAndDrop() {
        // 节点库项目拖拽
        document.querySelectorAll('.node-item').forEach(item => {
            item.draggable = true;

            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                const nodeType = item.getAttribute('data-type');
                e.dataTransfer.setData('application/node-type', nodeType);
                e.dataTransfer.effectAllowed = 'copy';
            });

            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
            });
        });

        // 工作区拖拽接收
        const workspace = document.querySelector('.workspace');

        workspace.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            workspace.classList.add('drag-over');
        });

        workspace.addEventListener('dragleave', (e) => {
            if (!workspace.contains(e.relatedTarget)) {
                workspace.classList.remove('drag-over');
            }
        });

        workspace.addEventListener('drop', (e) => {
            e.preventDefault();
            workspace.classList.remove('drag-over');

            const nodeType = e.dataTransfer.getData('application/node-type');
            if (nodeType) {
                const rect = workspace.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                window.workflowManager.createNode(nodeType, { x, y });
            }
        });

        // 文件拖拽处理
        this.initializeFileDrop();
    }

    // 初始化文件拖拽
    initializeFileDrop() {
        const workspace = document.querySelector('.workspace');

        workspace.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        workspace.addEventListener('drop', async (e) => {
            if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();

                const files = Array.from(e.dataTransfer.files);
                const file = files[0];

                if (file && file.name.endsWith('.json')) {
                    // 可能是工作流文件
                    const confirm = await Utils.confirm(
                        '检测到JSON文件，是否作为工作流导入？取消将创建文件输入节点。',
                        '文件导入'
                    );

                    if (confirm) {
                        window.workflowManager.importWorkflow(file);
                    } else {
                        // 创建文件输入节点
                        const rect = workspace.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;

                        const node = window.workflowManager.createNode('file-input', { x, y });

                        // 读取文件内容
                        try {
                            const content = await Utils.readFile(file);
                            node.setOutputValue('content', content);
                            node.setOutputValue('filename', file.name);

                            Utils.showNotification(`文件 "${file.name}" 已加载到节点`, 'success');
                        } catch (error) {
                            Utils.showNotification(`读取文件失败: ${error.message}`, 'error');
                        }
                    }
                } else if (file) {
                    // 创建文件输入节点
                    const rect = workspace.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;

                    const node = window.workflowManager.createNode('file-input', { x, y });

                    // 读取文件内容
                    try {
                        const content = await Utils.readFile(file);
                        node.setOutputValue('content', content);
                        node.setOutputValue('filename', file.name);

                        Utils.showNotification(`文件 "${file.name}" 已加载到节点`, 'success');
                    } catch (error) {
                        Utils.showNotification(`读取文件失败: ${error.message}`, 'error');
                    }
                }
            }
        });
    }

    // 显示上下文菜单
    showContextMenu(x, y) {
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.classList.remove('hidden');
    }

    // 隐藏上下文菜单
    hideContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.classList.add('hidden');
    }

    // 处理上下文操作
    handleContextAction(action) {
        const selectedNode = window.workflowManager.selectedNode;
        if (!selectedNode) return;

        switch (action) {
            case 'viewCode':
                this.viewNodeCode(selectedNode);
                break;
            case 'copy':
                window.workflowManager.copyNode(selectedNode);
                break;
            case 'paste':
                window.workflowManager.pasteNode();
                break;
            case 'clearInputConnections':
                window.workflowManager.clearNodeInputConnections(selectedNode);
                break;
            case 'clearOutputConnections':
                window.workflowManager.clearNodeOutputConnections(selectedNode);
                break;
            case 'delete':
                window.workflowManager.deleteNode(selectedNode);
                break;
        }
    }

    // 查看节点代码/配置
    viewNodeCode(nodeId) {
        const node = window.workflowManager.nodes.get(nodeId);
        if (!node) return;

        switch (node.type) {
            case 'javascript-code':
            case 'python-code':
                // 代码节点：打开代码编辑器
                console.log('右键菜单：打开代码节点编辑器', node.type, node.id);
                if (node.openCodeEditor) {
                    node.openCodeEditor();
                } else {
                    Utils.showNotification('代码编辑器功能暂不可用', 'warning');
                }
                break;

            case 'code-editor':
                // 代码编辑器节点：打开编辑器窗口
                console.log('右键菜单：打开代码编辑器节点', node.id);
                if (node.openEditor) {
                    node.openEditor();
                } else {
                    Utils.showNotification('代码编辑器功能暂不可用', 'warning');
                }
                break;

            case 'ai-chat-window':
                // AI对话节点：打开对话窗口
                console.log('右键菜单：打开AI对话节点', node.id);
                if (node.openConversationWindow) {
                    node.openConversationWindow();
                } else {
                    Utils.showNotification('AI对话窗口功能暂不可用', 'warning');
                }
                break;

            default:
                // 其他节点：显示配置面板
                this.showNodeConfigDialog(node);
                break;
        }
    }

    // 显示节点配置对话框
    showNodeConfigDialog(node) {
        const configDialog = document.createElement('div');
        configDialog.className = 'config-dialog-overlay';
        configDialog.innerHTML = `
            <div class="config-dialog">
                <div class="config-header">
                    <h3><i class="${node.getNodeInfo().icon}"></i> ${node.getNodeInfo().title} - 配置</h3>
                    <button class="close-btn" onclick="this.closest('.config-dialog-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="config-content">
                    <div class="config-section">
                        <h4>基本信息</h4>
                        <div class="config-item">
                            <label>节点ID:</label>
                            <span>${node.id}</span>
                        </div>
                        <div class="config-item">
                            <label>节点类型:</label>
                            <span>${node.type}</span>
                        </div>
                        <div class="config-item">
                            <label>位置:</label>
                            <span>(${Math.round(node.x)}, ${Math.round(node.y)})</span>
                        </div>
                    </div>
                    <div class="config-section">
                        <h4>配置参数</h4>
                        <div class="config-params">
                            ${this.generateConfigParamsHTML(node)}
                        </div>
                    </div>
                </div>
                <div class="config-footer">
                    <button class="config-btn primary" onclick="this.closest('.config-dialog-overlay').remove()">
                        确定
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(configDialog);
    }

    // 生成配置参数HTML
    generateConfigParamsHTML(node) {
        let html = '';
        const config = node.config || {};

        Object.entries(config).forEach(([key, value]) => {
            if (key === 'code' && typeof value === 'string' && value.length > 100) {
                // 代码类型的配置，显示预览
                const preview = value.substring(0, 100) + '...';
                html += `
                    <div class="config-item">
                        <label>${key}:</label>
                        <pre class="code-preview-small">${preview}</pre>
                    </div>
                `;
            } else {
                // 普通配置
                const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                html += `
                    <div class="config-item">
                        <label>${key}:</label>
                        <span>${displayValue}</span>
                    </div>
                `;
            }
        });

        return html || '<div class="no-config">暂无配置参数</div>';
    }

    // 处理键盘快捷键
    handleKeyboardShortcuts(e) {
        // 如果在输入框中，忽略快捷键
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (e.key) {
            case 'Delete':
                if (window.workflowManager.selectedNode) {
                    window.workflowManager.deleteNode(window.workflowManager.selectedNode);
                }
                break;

            case 's':
                if (e.ctrlKey) {
                    e.preventDefault();
                    window.workflowManager.save();
                }
                break;

            case 'o':
                if (e.ctrlKey) {
                    e.preventDefault();
                    window.workflowManager.load();
                }
                break;

            case 'e':
                if (e.ctrlKey) {
                    e.preventDefault();
                    window.workflowManager.exportWorkflow();
                }
                break;

            case ',':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.showSettingsModal();
                }
                break;

            case 'c':
                if (e.ctrlKey && window.workflowManager.selectedNode) {
                    e.preventDefault();
                    window.workflowManager.copyNode(window.workflowManager.selectedNode);
                }
                break;

            case 'v':
                if (e.ctrlKey) {
                    e.preventDefault();
                    window.workflowManager.pasteNode();
                }
                break;

            case 'F5':
                e.preventDefault();
                window.workflowExecutor.executeWorkflow();
                break;

            case 'F9':
                e.preventDefault();
                window.workflowExecutor.simulateExecution();
                break;
        }
    }

    // 显示设置模态框
    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        const config = window.appConfig.getConfig();

        // 填充当前配置
        document.getElementById('apiUrl').value = config.url || '';
        document.getElementById('apiKey').value = config.apiKey || '';
        document.getElementById('defaultModel').value = config.model || '';
        document.getElementById('maxTokens').value = config.maxTokens || '';
        document.getElementById('temperature').value = config.temperature || '';

        // 设置节点大小配置
        const nodeWidth = config.nodeDefaultWidth || 180;
        const nodeHeight = config.nodeDefaultHeight || 80;
        document.getElementById('nodeDefaultWidth').value = nodeWidth;
        document.getElementById('nodeDefaultHeight').value = nodeHeight;
        document.getElementById('nodeWidthValue').textContent = nodeWidth + 'px';
        document.getElementById('nodeHeightValue').textContent = nodeHeight + 'px';

        // 设置自动展开选项
        document.getElementById('autoExpandResults').checked = config.autoExpandResults !== false; // 默认开启

        // 绑定滑动条事件
        document.getElementById('nodeDefaultWidth').addEventListener('input', (e) => {
            document.getElementById('nodeWidthValue').textContent = e.target.value + 'px';
        });

        document.getElementById('nodeDefaultHeight').addEventListener('input', (e) => {
            document.getElementById('nodeHeightValue').textContent = e.target.value + 'px';
        });

        modal.classList.add('show');

        // 聚焦到第一个输入框
        setTimeout(() => {
            document.getElementById('apiUrl').focus();
        }, 100);
    }

    // 隐藏设置模态框
    hideSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.classList.remove('show');
    }

    // 保存设置
    saveSettings() {
        const form = document.getElementById('apiConfigForm');
        const formData = new FormData(form);

        const config = {
            url: formData.get('apiUrl'),
            apiKey: formData.get('apiKey'),
            model: formData.get('defaultModel'),
            maxTokens: parseInt(formData.get('maxTokens')),
            temperature: parseFloat(formData.get('temperature')),
            nodeDefaultWidth: parseInt(formData.get('nodeDefaultWidth')),
            nodeDefaultHeight: parseInt(formData.get('nodeDefaultHeight')),
            autoExpandResults: document.getElementById('autoExpandResults').checked
        };

        window.appConfig.saveConfig(config);

        // 应用节点大小设置到CSS
        this.applyNodeSizeSettings(config.nodeDefaultWidth, config.nodeDefaultHeight);

        this.hideSettingsModal();

        Utils.showNotification('配置已保存', 'success');
    }

    // 应用节点大小设置
    applyNodeSizeSettings(width, height) {
        // 更新CSS变量
        document.documentElement.style.setProperty('--node-default-width', width + 'px');
        document.documentElement.style.setProperty('--node-default-height', height + 'px');

        // 更新所有现有节点的大小
        if (window.workflowManager) {
            Object.values(window.workflowManager.nodes).forEach(node => {
                if (node.element) {
                    node.width = width;
                    node.height = height;
                    // 节点会通过CSS变量自动调整大小
                }
            });
        }
    }

    // 显示预设模板模态框
    showPresetsModal() {
        const modal = document.getElementById('presetsModal');
        const presetsList = document.getElementById('presetsList');

        // 清空列表
        presetsList.innerHTML = '';

        // 获取预设工作流列表
        const presets = window.appConfig.getPresetWorkflows();

        // 生成预设列表
        presets.forEach(preset => {
            const presetItem = document.createElement('div');
            presetItem.className = 'preset-item';
            presetItem.innerHTML = `
                <div class="preset-header">
                    <h4>${preset.name}</h4>
                    <button class="btn btn-primary btn-sm load-preset" data-preset-id="${preset.id}">
                        <i class="fas fa-download"></i> 加载
                    </button>
                </div>
                <p class="preset-description">${preset.description}</p>
                <div class="preset-info">
                    <span class="preset-nodes-count">节点数: ${preset.nodes.length}</span>
                    <span class="preset-connections-count">连接数: ${preset.connections ? preset.connections.length : 0}</span>
                </div>
            `;

            presetsList.appendChild(presetItem);
        });

        // 绑定加载按钮事件
        presetsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('load-preset') || e.target.closest('.load-preset')) {
                const button = e.target.closest('.load-preset');
                const presetId = button.getAttribute('data-preset-id');

                if (presetId) {
                    window.workflowManager.loadPresetWorkflow(presetId);
                    this.hidePresetsModal();
                }
            }
        });

        modal.classList.add('show');
    }

    // 隐藏预设模板模态框
    hidePresetsModal() {
        const modal = document.getElementById('presetsModal');
        modal.classList.remove('show');
    }

    // 显示存储管理模态框
    showVariablesModal() {
        // 总是重新创建模态框以确保事件绑定正确
        this.createVariablesModal();

        const modal = document.getElementById('variablesModal');
        if (!modal) {
            console.error('无法创建存储管理模态框');
            Utils.showNotification('存储管理界面加载失败', 'error');
            return;
        }

        modal.classList.remove('hidden');
        modal.classList.add('show');

        // 刷新存储列表和统计信息
        this.refreshVariablesList();
        this.updateStorageStats();
    }

    // 创建存储管理模态框
    createVariablesModal() {
        // 移除现有的模态框（如果存在）
        const existingModal = document.getElementById('variablesModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 创建新的模态框
        const modal = document.createElement('div');
        modal.id = 'variablesModal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content large-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-database"></i> 全局存储管理</h3>
                    <span class="modal-close" id="closeVariables">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="variables-toolbar">
                        <div class="toolbar-left">
                            <button type="button" class="btn btn-success" id="addGlobalVariableInModal">
                                <i class="fas fa-plus"></i> 新建变量
                            </button>
                            <button type="button" class="btn btn-secondary" id="importVariables">
                                <i class="fas fa-upload"></i> 导入存储
                            </button>
                            <button type="button" class="btn btn-secondary" id="exportVariables">
                                <i class="fas fa-download"></i> 导出存储
                            </button>
                            <button type="button" class="btn btn-warning" id="storageStatsBtn">
                                <i class="fas fa-chart-bar"></i> 存储统计
                            </button>
                        </div>
                        <div class="toolbar-right">
                            <input type="text" id="storageSearchInput" class="form-control" placeholder="搜索存储项..." style="width: 150px; margin-right: 10px;">
                            <select id="variableTypeFilter" class="form-control">
                                <option value="">全部类型</option>
                                <option value="string">字符串</option>
                                <option value="number">数字</option>
                                <option value="boolean">布尔值</option>
                                <option value="object">对象</option>
                                <option value="array">数组</option>
                                <option value="image">图片</option>
                                <option value="audio">音频</option>
                                <option value="video">视频</option>
                                <option value="document">文档</option>
                                <option value="largeText">大文本</option>
                            </select>
                            <button type="button" class="btn btn-danger" id="clearAllVariables">
                                <i class="fas fa-trash-alt"></i> 全部清空
                            </button>
                        </div>
                    </div>
                    <div class="storage-stats" id="storageStatsPanel" style="display: none;">
                        <div class="stats-grid">
                            <div class="stat-item">
                                <i class="fas fa-database"></i>
                                <div class="stat-info">
                                    <span class="stat-label">总存储项</span>
                                    <span class="stat-value" id="totalItems">0</span>
                                </div>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-memory"></i>
                                <div class="stat-info">
                                    <span class="stat-label">内存使用</span>
                                    <span class="stat-value" id="memoryUsage">0 KB</span>
                                </div>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-hdd"></i>
                                <div class="stat-info">
                                    <span class="stat-label">磁盘使用</span>
                                    <span class="stat-value" id="diskUsage">0 KB</span>
                                </div>
                            </div>
                            <div class="stat-item">
                                <i class="fas fa-images"></i>
                                <div class="stat-info">
                                    <span class="stat-label">多媒体文件</span>
                                    <span class="stat-value" id="mediaFiles">0</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="variables-list" id="variablesModalList">
                        <!-- 存储项列表将在这里动态生成 -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="cancelVariables">关闭</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 重新绑定事件
        this.bindVariablesModalEvents();
    }

    // 绑定存储管理模态框事件
    bindVariablesModalEvents() {
        const modal = document.getElementById('variablesModal');
        if (!modal) return;

        // 关闭按钮
        const closeBtn = modal.querySelector('#closeVariables');
        const cancelBtn = modal.querySelector('#cancelVariables');

        if (closeBtn) {
            closeBtn.onclick = () => this.hideVariablesModal();
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => this.hideVariablesModal();
        }

        // 工具栏按钮
        const addBtn = modal.querySelector('#addGlobalVariableInModal');
        if (addBtn) {
            addBtn.onclick = () => window.workflowManager.showCreateVariableDialog();
        }

        const addFromUrlBtn = modal.querySelector('#addFromUrlBtn');
        if (addFromUrlBtn) {
            addFromUrlBtn.onclick = () => window.workflowManager.showCreateVariableDialog('', 'image', '', '来自URL的文件');
        }

        const storageStatsBtn = modal.querySelector('#storageStatsBtn');
        if (storageStatsBtn) {
            storageStatsBtn.onclick = () => this.toggleStorageStats();
        }

        const clearBtn = modal.querySelector('#clearAllVariables');
        if (clearBtn) {
            clearBtn.onclick = () => this.clearAllVariables();
        }

        const exportBtn = modal.querySelector('#exportVariables');
        if (exportBtn) {
            exportBtn.onclick = () => this.exportVariables();
        }

        const importBtn = modal.querySelector('#importVariables');
        if (importBtn) {
            importBtn.onclick = () => this.importVariables();
        }

        const typeFilter = modal.querySelector('#variableTypeFilter');
        if (typeFilter) {
            typeFilter.onchange = (e) => this.filterVariablesByType(e.target.value);
        }

        const searchInput = modal.querySelector('#storageSearchInput');
        if (searchInput) {
            searchInput.oninput = (e) => this.filterVariablesBySearch(e.target.value);
        }

        // 点击外部关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.hideVariablesModal();
            }
        };
    }

    // 隐藏存储管理模态框
    hideVariablesModal() {
        const modal = document.getElementById('variablesModal');
        if (modal) {
            modal.classList.remove('show');
            modal.classList.add('hidden');

            // 可选：完全移除模态框以释放内存
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300); // 等待动画完成
        }
    }

    // 安全刷新存储列表
    safeRefreshVariablesList() {
        const variablesModal = document.getElementById('variablesModal');
        if (variablesModal && variablesModal.classList.contains('show')) {
            this.refreshVariablesList();
        }
    }

    // 刷新存储列表（全新实现）
    refreshVariablesList() {
        const container = document.getElementById('variablesModalList');
        if (!container) {
            console.error('存储列表容器未找到');
            return;
        }

        // 获取所有存储项（包括新的多媒体类型）
        const allItems = window.variableManager.getAllStorageItems ?
            window.variableManager.getAllStorageItems() :
            window.variableManager.getAllGlobalVariables();

        // 应用搜索和类型过滤
        const filteredItems = this.applyStorageFilters(allItems);

        if (filteredItems.length === 0) {
            container.innerHTML = `
                <div class="empty-storage">
                    <i class="fas fa-database"></i>
                    <h4>暂无存储项</h4>
                    <p>开始创建您的第一个存储项</p>
                    <button type="button" class="btn btn-primary" onclick="window.workflowManager.showCreateVariableDialog()">
                        <i class="fas fa-plus"></i> 创建变量
                    </button>
                </div>
            `;
            return;
        }

        // 生成存储项列表
        let html = '<div class="variables-table">';
        html += `
            <div class="table-header">
                <div class="col-name">名称</div>
                <div class="col-type">类型</div>
                <div class="col-value">内容预览</div>
                <div class="col-actions">操作</div>
            </div>
        `;

        filteredItems.forEach(item => {
            html += this.generateStorageItemRow(item);
        });

        html += '</div>';
        container.innerHTML = html;

        // 绑定事件
        this.bindStorageEvents();
    }

    // 生成存储项行（支持多媒体类型）
    generateStorageItemRow(item) {
        const typeClass = `item-type ${item.type}`;
        const valuePreview = this.generateValuePreview(item);

        return `
            <div class="storage-item" data-storage-name="${item.name}">
                <div class="item-name">
                    <i class="fas ${this.getStorageTypeIcon(item.type)}"></i>
                    <span>${item.name}</span>
                    ${item.description ? `<small class="text-muted d-block">${item.description}</small>` : ''}
                </div>
                <div class="item-type ${item.type}">${this.getStorageTypeDisplay(item.type)}</div>
                <div class="item-value">${valuePreview}</div>
                <div class="item-actions">
                    ${this.generateStorageActions(item)}
                </div>
            </div>
        `;
    }

    // 生成值预览（支持多媒体）
    generateValuePreview(item) {
        const value = item.value;
        const type = item.type;

        switch (type) {
            case 'image':
                if (value instanceof Blob) {
                    const url = URL.createObjectURL(value);
                    return `
                        <div class="media-preview">
                            <img src="${url}" class="media-thumbnail" onclick="window.uiManager.showMediaViewer('${item.name}', 'image')" alt="图片预览">
                            <div class="media-info">
                                <div class="media-size">${this.formatFileSize(value.size)}</div>
                                <small class="text-muted">${value.type}</small>
                            </div>
                        </div>
                    `;
                }
                return `<span class="text-muted">图片数据</span>`;

            case 'audio':
                if (value instanceof Blob) {
                    const url = URL.createObjectURL(value);
                    return `
                        <div class="media-preview">
                            <audio controls class="audio-player" style="max-width: 200px;">
                                <source src="${url}" type="${value.type}">
                            </audio>
                            <div class="media-info">
                                <div class="media-size">${this.formatFileSize(value.size)}</div>
                            </div>
                        </div>
                    `;
                }
                return `<span class="text-muted">音频数据</span>`;

            case 'video':
                if (value instanceof Blob) {
                    const url = URL.createObjectURL(value);
                    return `
                        <div class="media-preview">
                            <video width="120" height="80" controls style="border-radius: 4px;">
                                <source src="${url}" type="${value.type}">
                            </video>
                            <div class="media-info">
                                <div class="media-size">${this.formatFileSize(value.size)}</div>
                            </div>
                        </div>
                    `;
                }
                return `<span class="text-muted">视频数据</span>`;

            case 'document':
                if (value instanceof Blob) {
                    return `
                        <div class="media-preview">
                            <i class="fas fa-file-alt" style="font-size: 24px; color: #6c757d;"></i>
                            <div class="media-info">
                                <div class="media-size">${this.formatFileSize(value.size)}</div>
                                <small class="text-muted">${value.type}</small>
                            </div>
                        </div>
                    `;
                }
                return `<span class="text-muted">文档数据</span>`;

            case 'largeText':
                const textLength = typeof value === 'string' ? value.length : 0;
                const textPreview = typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100);
                return `
                    <div class="value-preview" onclick="window.uiManager.showTextViewer('${item.name}')">
                        <div style="font-family: monospace; font-size: 12px; max-height: 60px; overflow: hidden;">
                            ${this.escapeHtml(textPreview)}${textLength > 100 ? '...' : ''}
                        </div>
                        <small class="text-muted">${textLength} 字符</small>
                    </div>
                `;

            case 'object':
            case 'array':
                try {
                    const jsonStr = JSON.stringify(value, null, 2);
                    const jsonPreview = jsonStr.length > 100 ? jsonStr.substring(0, 100) + '...' : jsonStr;
                    return `
                        <div class="value-preview" onclick="window.uiManager.showJsonViewer('${item.name}')">
                            <code style="font-size: 11px; max-height: 60px; overflow: hidden; display: block;">
                                ${this.escapeHtml(jsonPreview)}
                            </code>
                        </div>
                    `;
                } catch {
                    return `<span class="text-muted">无效的${type}数据</span>`;
                }

            default:
                // string, number, boolean
                const strValue = String(value);
                const strPreview = strValue.length > 100 ? strValue.substring(0, 100) + '...' : strValue;
                return `<span style="font-family: monospace; font-size: 12px;">${this.escapeHtml(strPreview)}</span>`;
        }
    }

    // 生成存储操作按钮
    generateStorageActions(item) {
        let actions = `
            <button type="button" class="btn btn-sm btn-info view-storage" data-storage="${item.name}" title="查看详情">
                <i class="fas fa-eye"></i>
            </button>
            <button type="button" class="btn btn-sm btn-primary edit-storage" data-storage="${item.name}" title="编辑">
                <i class="fas fa-edit"></i>
            </button>
        `;

        // 多媒体文件添加下载按钮
        if (['image', 'audio', 'video', 'document'].includes(item.type)) {
            actions += `
                <button type="button" class="btn btn-sm btn-success download-storage" data-storage="${item.name}" title="下载">
                    <i class="fas fa-download"></i>
                </button>
            `;
        }

        actions += `
            <button type="button" class="btn btn-sm btn-danger delete-storage" data-storage="${item.name}" title="删除">
                <i class="fas fa-trash"></i>
            </button>
        `;

        return actions;
    }

    // 绑定存储事件
    bindStorageEvents() {
        const container = document.getElementById('variablesModalList');
        if (!container) return;

        // 查看详情
        container.querySelectorAll('.view-storage').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const storageName = btn.getAttribute('data-storage');
                this.showStorageDetails(storageName);
            };
        });

        // 编辑存储
        container.querySelectorAll('.edit-storage').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const storageName = btn.getAttribute('data-storage');
                this.showEditStorageDialog(storageName);
            };
        });

        // 下载文件
        container.querySelectorAll('.download-storage').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const storageName = btn.getAttribute('data-storage');
                this.downloadStorageItem(storageName);
            };
        });

        // 删除存储
        container.querySelectorAll('.delete-storage').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const storageName = btn.getAttribute('data-storage');
                this.deleteStorageItem(storageName);
            };
        });
    }

    // 生成变量行
    generateVariableRow(variable) {
        const typeDisplay = this.getVariableTypeDisplay(variable.type);
        const valueDisplay = this.formatVariableValue(variable.value);

        return `
            <div class="table-row" data-variable-name="${variable.name}">
                <div class="col-name">
                    <i class="fas fa-cube"></i>
                    <span class="variable-name">${variable.name}</span>
                </div>
                <div class="col-type">
                    <span class="type-badge type-${variable.type}">${typeDisplay}</span>
                </div>
                <div class="col-value" title="${this.escapeHtml(String(variable.value))}">
                    ${valueDisplay}
                </div>
                <div class="col-actions">
                    <button type="button" class="btn btn-sm btn-primary edit-variable" data-variable="${variable.name}">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button type="button" class="btn btn-sm btn-danger delete-variable" data-variable="${variable.name}">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            </div>
        `;
    }

    // 绑定变量事件
    bindVariableEvents() {
        // 绑定编辑按钮
        document.querySelectorAll('.edit-variable').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const variableName = e.target.getAttribute('data-variable');
                this.showEditVariableDialog(variableName);
            });
        });

        // 绑定删除按钮
        document.querySelectorAll('.delete-variable').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const variableName = e.target.getAttribute('data-variable');
                const confirmed = await Utils.confirm(`确定要删除变量 "${variableName}" 吗？此操作不可恢复。`, '确认删除');

                if (confirmed) {
                    try {
                        window.variableManager.deleteGlobalVariable(variableName);
                        Utils.showNotification(`成功删除变量 "${variableName}"`, 'success');

                        // 立即刷新变量列表，因为删除操作没有模态框冲突
                        this.refreshVariablesList();
                    } catch (error) {
                        Utils.showNotification(`删除变量失败: ${error.message}`, 'error');
                    }
                }
            });
        });
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 生成编辑值字段
    generateEditValueField(variable) {
        const type = variable.type;
        const value = variable.value;

        if (['image', 'audio', 'video', 'document'].includes(type)) {
            // 多媒体类型显示预览和替换选项
            let previewHtml = '';
            if (type === 'image' && value instanceof Blob) {
                const url = URL.createObjectURL(value);
                previewHtml = `<img src="${url}" class="media-preview" style="max-width: 200px; max-height: 150px;" alt="图片预览">`;
            } else if (type === 'audio' && value instanceof Blob) {
                const url = URL.createObjectURL(value);
                previewHtml = `<audio controls><source src="${url}" type="${value.type}"></audio>`;
            } else if (type === 'video' && value instanceof Blob) {
                const url = URL.createObjectURL(value);
                previewHtml = `<video width="200" height="120" controls><source src="${url}" type="${value.type}"></video>`;
            } else if (type === 'document' && value instanceof Blob) {
                previewHtml = `<i class="fas fa-file-alt" style="font-size: 48px; color: #6c757d;"></i><br><small>${this.formatFileSize(value.size)}</small>`;
            }

            return `
                <div class="form-group">
                    <label>当前文件:</label>
                    <div class="media-preview-container">
                        ${previewHtml}
                        <div class="media-info">
                            <div>大小: ${value instanceof Blob ? this.formatFileSize(value.size) : '未知'}</div>
                            <div>类型: ${value instanceof Blob ? value.type : '未知'}</div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="editVarFile">替换文件 (可选):</label>
                    <input type="file" id="editVarFile" accept="${this.getFileAccept(type)}">
                    <small class="text-muted">留空保持原文件不变</small>
                </div>
            `;
        } else {
            // 普通类型的值编辑
            const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
            return `
                <div class="form-group">
                    <label for="editVarValue">当前值:</label>
                    <textarea id="editVarValue" rows="3">${displayValue}</textarea>
                </div>
            `;
        }
    }

    // 获取文件接受类型
    getFileAccept(type) {
        const accepts = {
            image: 'image/*',
            audio: 'audio/*',
            video: 'video/*',
            document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'
        };
        return accepts[type] || '*/*';
    }

    // 显示编辑变量对话框
    showEditVariableDialog(variableName) {
        const variable = window.variableManager.getGlobalVariable(variableName);
        if (!variable) {
            Utils.showNotification('变量不存在', 'error');
            return;
        }

        const popupConfig = variable.popupConfig || {};

        const modalContent = `
            <div class="variable-form">
                <div class="form-group">
                    <label for="editVarName">变量名:</label>
                    <input type="text" id="editVarName" value="${variable.name}" readonly>
                </div>
                <div class="form-group">
                    <label for="editVarType">变量类型:</label>
                    <select id="editVarType" ${['image', 'audio', 'video', 'document'].includes(variable.type) ? 'disabled' : ''}>
                        <option value="string" ${variable.type === 'string' ? 'selected' : ''}>字符串</option>
                        <option value="number" ${variable.type === 'number' ? 'selected' : ''}>数字</option>
                        <option value="boolean" ${variable.type === 'boolean' ? 'selected' : ''}>布尔值</option>
                        <option value="object" ${variable.type === 'object' ? 'selected' : ''}>对象</option>
                        <option value="array" ${variable.type === 'array' ? 'selected' : ''}>数组</option>
                        <option value="image" ${variable.type === 'image' ? 'selected' : ''}>图片</option>
                        <option value="audio" ${variable.type === 'audio' ? 'selected' : ''}>音频</option>
                        <option value="video" ${variable.type === 'video' ? 'selected' : ''}>视频</option>
                        <option value="document" ${variable.type === 'document' ? 'selected' : ''}>文档</option>
                        <option value="largeText" ${variable.type === 'largeText' ? 'selected' : ''}>大文本</option>
                    </select>
                    ${['image', 'audio', 'video', 'document'].includes(variable.type) ? '<small class="text-muted">多媒体类型不可更改</small>' : ''}
                </div>
                ${this.generateEditValueField(variable)}
                <div class="form-group">
                    <label for="editVarDescription">描述:</label>
                    <input type="text" id="editVarDescription" value="${variable.description || ''}">
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

        Utils.showModal(`编辑变量: ${variableName}`, modalContent, [
            {
                text: '取消',
                type: 'secondary',
                onclick: () => {
                    Utils.hideModal();
                    // 取消时不做任何其他操作，保持主窗口状态
                }
            },
            {
                text: '保存',
                type: 'primary',
                onclick: () => this.handleEditVariable(variableName)
            }
        ]);
    }

    // 处理编辑变量
    async handleEditVariable(variableName) {
        try {
            const variable = window.variableManager.getGlobalVariable(variableName);
            const isFileType = ['image', 'audio', 'video', 'document'].includes(variable.type);

            const newDescription = document.getElementById('editVarDescription').value.trim();
            const inputPopup = document.getElementById('enableInputPopup').checked;
            const outputPopup = document.getElementById('enableOutputPopup').checked;
            const timeout = parseInt(document.getElementById('popupTimeout').value) * 1000;

            // 检查是否需要替换文件
            if (isFileType) {
                const fileInput = document.getElementById('editVarFile');
                if (fileInput && fileInput.files[0]) {
                    // 用户选择了新文件，需要替换
                    const newFile = fileInput.files[0];
                    await window.variableManager.handleFileUpload(newFile, variableName);
                    Utils.showNotification(`成功替换文件变量 "${variableName}"`, 'success');
                } else {
                    // 只更新描述，不替换文件
                    window.variableManager.updateGlobalVariable(variableName, variable.value, true, newDescription);
                    Utils.showNotification(`成功更新变量描述 "${variableName}"`, 'success');
                }
            } else {
                // 普通类型变量
                const newValue = document.getElementById('editVarValue').value;
                window.variableManager.updateGlobalVariable(variableName, newValue, true, newDescription);
                Utils.showNotification(`成功更新变量 "${variableName}"`, 'success');
            }

            // 更新弹窗配置
            window.variableManager.updateVariablePopupConfig(variableName, {
                inputPopup,
                outputPopup,
                timeout
            });

            Utils.hideModal();

            // 立即刷新变量列表
            this.safeRefreshVariablesList();
        } catch (error) {
            Utils.showNotification(`更新变量失败: ${error.message}`, 'error');
        }
    }



    // 清空所有变量
    async clearAllVariables() {
        const confirmed = await Utils.confirm('确定要清空所有变量吗？此操作不可恢复。', '确认清空');

        if (confirmed) {
            window.variableManager.clearAll();
            Utils.showNotification('已清空所有变量', 'success');

            // 立即刷新变量列表，因为清空操作没有模态框冲突
            this.refreshVariablesList();
        }
    }

    // 导出变量
    exportVariables() {
        const data = window.variableManager.exportVariables();
        const filename = `variables_${new Date().toISOString().slice(0, 10)}.json`;
        Utils.downloadFile(JSON.stringify(data, null, 2), filename);
        Utils.showNotification('变量配置已导出', 'success');
    }

    // 导入变量
    importVariables() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const content = await Utils.readFile(file);
                    const data = JSON.parse(content);

                    const confirmed = await Utils.confirm('导入变量将覆盖现有配置，确定继续吗？', '确认导入');

                    if (confirmed) {
                        window.variableManager.importVariables(data);
                        Utils.showNotification('变量配置导入成功', 'success');

                        // 立即刷新变量列表，因为导入操作没有模态框冲突
                        this.refreshVariablesList();
                    }
                } catch (error) {
                    Utils.showNotification(`导入失败: ${error.message}`, 'error');
                }
            }
        };

        input.click();
    }

    // 按类型过滤变量
    filterVariablesByType(type) {
        const rows = document.querySelectorAll('.table-row');

        rows.forEach(row => {
            const variableName = row.dataset.variableName;
            const variable = window.variableManager.getGlobalVariable(variableName);

            if (!type || variable.type === type) {
                row.style.display = 'flex';
            } else {
                row.style.display = 'none';
            }
        });
    }

    // 辅助方法
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

    formatVariableValue(value) {
        if (value === null || value === undefined) {
            return '<em>空</em>';
        }

        const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return str.length > 50 ? str.substring(0, 50) + '...' : str;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 新增：存储管理增强方法

    // 显示添加存储对话框（支持所有类型）
    // 更新存储统计信息
    updateStorageStats() {
        try {
            const stats = window.variableManager.getStorageStatistics();

            document.getElementById('totalItems').textContent = stats.items.total;
            document.getElementById('memoryUsage').textContent = this.formatFileSize(stats.memory.used);
            document.getElementById('diskUsage').textContent = this.formatFileSize(stats.storage.indexedDB || 0);

            const mediaCount = (stats.items.byType.image || 0) +
                (stats.items.byType.audio || 0) +
                (stats.items.byType.video || 0);
            document.getElementById('mediaFiles').textContent = mediaCount;

        } catch (error) {
            console.error('更新统计信息失败:', error);
        }
    }

    // 切换存储统计显示
    toggleStorageStats() {
        const panel = document.getElementById('storageStatsPanel');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            this.updateStorageStats();
        } else {
            panel.style.display = 'none';
        }
    }

    // 应用存储过滤器
    applyStorageFilters(items) {
        const searchTerm = document.getElementById('storageSearchInput')?.value.toLowerCase() || '';
        const typeFilter = document.getElementById('variableTypeFilter')?.value || '';

        return items.filter(item => {
            const matchesSearch = !searchTerm ||
                item.name.toLowerCase().includes(searchTerm) ||
                (item.description && item.description.toLowerCase().includes(searchTerm));

            const matchesType = !typeFilter || item.type === typeFilter;

            return matchesSearch && matchesType;
        });
    }

    // 搜索过滤
    filterVariablesBySearch(searchTerm) {
        this.refreshVariablesList();
    }

    // 获取存储类型图标
    getStorageTypeIcon(type) {
        const icons = {
            string: 'fa-font',
            number: 'fa-hashtag',
            boolean: 'fa-toggle-on',
            object: 'fa-code',
            array: 'fa-list',
            image: 'fa-image',
            audio: 'fa-volume-up',
            video: 'fa-video',
            document: 'fa-file-alt',
            largeText: 'fa-file-text'
        };
        return icons[type] || 'fa-cube';
    }

    // 获取存储类型显示名称
    getStorageTypeDisplay(type) {
        const types = {
            string: '字符串',
            number: '数字',
            boolean: '布尔值',
            object: '对象',
            array: '数组',
            image: '图片',
            audio: '音频',
            video: '视频',
            document: '文档',
            largeText: '大文本'
        };
        return types[type] || type;
    }

    // 显示媒体查看器
    showMediaViewer(storageName, mediaType) {
        try {
            const item = window.variableManager.getGlobalVariable(storageName);
            if (!item || !item.value) {
                Utils.showNotification('无法找到媒体文件', 'error');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal show media-viewer-modal';

            let mediaContent = '';
            let url = '';

            if (item.value instanceof Blob) {
                url = URL.createObjectURL(item.value);
            }

            switch (mediaType) {
                case 'image':
                    mediaContent = `<img src="${url}" class="media-viewer-content" alt="${storageName}">`;
                    break;
                case 'audio':
                    mediaContent = `<audio controls class="media-viewer-content"><source src="${url}"></audio>`;
                    break;
                case 'video':
                    mediaContent = `<video controls class="media-viewer-content"><source src="${url}"></video>`;
                    break;
            }

            modal.innerHTML = `
                <div class="modal-content">
                    <div class="media-viewer-header">
                        <h3>${storageName}</h3>
                        <span class="modal-close" onclick="this.closest('.modal').remove(); URL.revokeObjectURL('${url}')">&times;</span>
                    </div>
                    <div class="media-viewer-body">
                        ${mediaContent}
                    </div>
                    <div class="media-viewer-footer">
                        <button class="btn btn-primary" onclick="window.uiManager.downloadStorageItem('${storageName}')">
                            <i class="fas fa-download"></i> 下载
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

        } catch (error) {
            console.error('显示媒体查看器失败:', error);
            Utils.showNotification('无法显示媒体文件', 'error');
        }
    }

    // 下载存储项
    downloadStorageItem(storageName) {
        try {
            const item = window.variableManager.getGlobalVariable(storageName);
            if (!item || !item.value) {
                Utils.showNotification('无法找到文件', 'error');
                return;
            }

            if (item.value instanceof Blob) {
                const url = URL.createObjectURL(item.value);
                const a = document.createElement('a');
                a.href = url;
                a.download = storageName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                Utils.showNotification('文件下载已开始', 'success');
            } else {
                // 文本内容下载
                const content = typeof item.value === 'object' ?
                    JSON.stringify(item.value, null, 2) :
                    String(item.value);

                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${storageName}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                Utils.showNotification('文件下载已开始', 'success');
            }

        } catch (error) {
            console.error('下载失败:', error);
            Utils.showNotification('下载失败', 'error');
        }
    }

    // 删除存储项
    async deleteStorageItem(storageName) {
        if (confirm(`确定要删除存储项"${storageName}"吗？`)) {
            try {
                window.variableManager.deleteGlobalVariable(storageName);
                Utils.showNotification(`存储项"${storageName}"已删除`, 'success');
                this.refreshVariablesList();
                this.updateStorageStats();
            } catch (error) {
                console.error('删除失败:', error);
                Utils.showNotification('删除失败', 'error');
            }
        }
    }

    // 显示文本查看器
    showTextViewer(storageName) {
        try {
            const item = window.variableManager.getGlobalVariable(storageName);
            if (!item) {
                Utils.showNotification('无法找到文本内容', 'error');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 80vw; max-height: 80vh;">
                    <div class="modal-header">
                        <h3><i class="fas fa-file-text"></i> ${storageName}</h3>
                        <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <pre style="white-space: pre-wrap; max-height: 60vh; overflow-y: auto; background: #f8f9fa; padding: 15px; border-radius: 4px;">${this.escapeHtml(String(item.value))}</pre>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="window.uiManager.downloadStorageItem('${storageName}')">
                            <i class="fas fa-download"></i> 下载
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">关闭</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

        } catch (error) {
            console.error('显示文本查看器失败:', error);
            Utils.showNotification('无法显示文本内容', 'error');
        }
    }

    // 显示JSON查看器
    showJsonViewer(storageName) {
        try {
            const item = window.variableManager.getGlobalVariable(storageName);
            if (!item) {
                Utils.showNotification('无法找到JSON内容', 'error');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 80vw; max-height: 80vh;">
                    <div class="modal-header">
                        <h3><i class="fas fa-code"></i> ${storageName}</h3>
                        <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <pre style="white-space: pre-wrap; max-height: 60vh; overflow-y: auto; background: #f8f9fa; padding: 15px; border-radius: 4px; font-family: 'Courier New', monospace;">${this.escapeHtml(JSON.stringify(item.value, null, 2))}</pre>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="window.uiManager.downloadStorageItem('${storageName}')">
                            <i class="fas fa-download"></i> 下载
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">关闭</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

        } catch (error) {
            console.error('显示JSON查看器失败:', error);
            Utils.showNotification('无法显示JSON内容', 'error');
        }
    }

    // 显示存储详情
    showStorageDetails(storageName) {
        try {
            const item = window.variableManager.getGlobalVariable(storageName);
            if (!item) {
                Utils.showNotification('无法找到存储项', 'error');
                return;
            }

            let sizeInfo = '';
            if (item.value instanceof Blob) {
                sizeInfo = this.formatFileSize(item.value.size);
            } else {
                const str = typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value);
                sizeInfo = this.formatFileSize(str.length);
            }

            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-info-circle"></i> 存储详情</h3>
                        <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="storage-details">
                            <div class="detail-row">
                                <strong>名称:</strong> ${item.name}
                            </div>
                            <div class="detail-row">
                                <strong>类型:</strong> <span class="item-type ${item.type}">${this.getStorageTypeDisplay(item.type)}</span>
                            </div>
                            <div class="detail-row">
                                <strong>大小:</strong> ${sizeInfo}
                            </div>
                            ${item.description ? `<div class="detail-row"><strong>描述:</strong> ${item.description}</div>` : ''}
                            ${item.metadata?.sourceUrl ? `<div class="detail-row"><strong>来源URL:</strong> <a href="${item.metadata.sourceUrl}" target="_blank">${item.metadata.sourceUrl}</a></div>` : ''}
                            ${item.metadata?.loadedAt ? `<div class="detail-row"><strong>载入时间:</strong> ${new Date(item.metadata.loadedAt).toLocaleString()}</div>` : ''}
                            ${item.metadata?.mimeType ? `<div class="detail-row"><strong>MIME类型:</strong> ${item.metadata.mimeType}</div>` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-info" onclick="window.uiManager.showEditStorageDialog('${storageName}')">
                            <i class="fas fa-edit"></i> 编辑
                        </button>
                        <button class="btn btn-primary" onclick="window.uiManager.downloadStorageItem('${storageName}')">
                            <i class="fas fa-download"></i> 下载
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">关闭</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

        } catch (error) {
            console.error('显示存储详情失败:', error);
            Utils.showNotification('无法显示存储详情', 'error');
        }
    }

    // 显示编辑存储对话框
    showEditStorageDialog(storageName) {
        try {
            const item = window.variableManager.getGlobalVariable(storageName);
            if (!item) {
                Utils.showNotification('无法找到存储项', 'error');
                return;
            }

            // 先关闭之前的弹窗
            const existingModal = document.querySelector('.modal.show');
            if (existingModal) {
                existingModal.remove();
            }

            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-edit"></i> 编辑存储项</h3>
                        <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="editStorageForm">
                            <div class="form-group">
                                <label for="editStorageName">存储名称:</label>
                                <input type="text" id="editStorageName" class="form-control" value="${item.name}" required>
                            </div>
                            <div class="form-group">
                                <label for="editStorageDescription">描述:</label>
                                <input type="text" id="editStorageDescription" class="form-control" value="${item.description || ''}">
                            </div>
                            ${!['image', 'audio', 'video', 'document'].includes(item.type) ? `
                                <div class="form-group">
                                    <label for="editStorageValue">值:</label>
                                    ${this.generateEditValueInput(item)}
                                </div>
                            ` : `
                                <div class="form-group">
                                    <label>当前文件:</label>
                                    <div class="current-file-info">
                                        <i class="fas ${this.getStorageTypeIcon(item.type)}"></i>
                                        ${item.name} (${this.formatFileSize(item.size || (item.value && item.value.size) || 0)})
                                    </div>
                                    <small class="text-muted">文件类型的存储项不支持直接编辑值，如需更改请删除后重新创建</small>
                                </div>
                            `}
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
                        <button type="button" class="btn btn-primary" onclick="window.uiManager.handleEditStorage('${storageName}')">保存修改</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

        } catch (error) {
            console.error('显示编辑对话框失败:', error);
            Utils.showNotification('无法显示编辑界面', 'error');
        }
    }

    // 生成编辑值输入控件
    generateEditValueInput(item) {
        switch (item.type) {
            case 'boolean':
                return `
                    <select id="editStorageValue" class="form-control">
                        <option value="true" ${item.value === true ? 'selected' : ''}>true</option>
                        <option value="false" ${item.value === false ? 'selected' : ''}>false</option>
                    </select>
                `;
            case 'largeText':
                return `<textarea id="editStorageValue" class="form-control" rows="6">${this.escapeHtml(String(item.value))}</textarea>`;
            case 'object':
            case 'array':
                return `<textarea id="editStorageValue" class="form-control" rows="8">${this.escapeHtml(JSON.stringify(item.value, null, 2))}</textarea>`;
            case 'number':
                return `<input type="number" id="editStorageValue" class="form-control" value="${item.value}">`;
            default:
                return `<input type="text" id="editStorageValue" class="form-control" value="${this.escapeHtml(String(item.value))}">`;
        }
    }

    // 处理编辑存储
    async handleEditStorage(originalName) {
        try {
            const item = window.variableManager.getGlobalVariable(originalName);
            if (!item) {
                Utils.showNotification('无法找到存储项', 'error');
                return;
            }

            const newName = document.getElementById('editStorageName').value.trim();
            const newDescription = document.getElementById('editStorageDescription').value.trim();

            if (!newName) {
                Utils.showNotification('请输入存储名称', 'error');
                return;
            }

            let newValue = item.value;

            // 如果不是文件类型，更新值
            if (!['image', 'audio', 'video', 'document'].includes(item.type)) {
                const valueInput = document.getElementById('editStorageValue');
                if (valueInput) {
                    let rawValue = valueInput.value;

                    switch (item.type) {
                        case 'number':
                            newValue = parseFloat(rawValue) || 0;
                            break;
                        case 'boolean':
                            newValue = rawValue === 'true';
                            break;
                        case 'object':
                        case 'array':
                            try {
                                newValue = JSON.parse(rawValue);
                            } catch (error) {
                                Utils.showNotification('JSON格式错误', 'error');
                                return;
                            }
                            break;
                        default:
                            newValue = rawValue;
                    }
                }
            }

            // 如果名称改变了，需要先删除旧的再创建新的
            if (newName !== originalName) {
                window.variableManager.deleteGlobalVariable(originalName);
                await window.variableManager.createStorageItem(newName, item.type, newValue, {
                    description: newDescription,
                    ...item.metadata
                });
            } else {
                // 只更新现有项
                const updatedItem = {
                    ...item,
                    description: newDescription,
                    value: newValue
                };
                window.variableManager.globalVariables.set(originalName, updatedItem);
                window.variableManager.saveToStorage();
            }

            Utils.showNotification('存储项已更新', 'success');
            this.refreshVariablesList();

            // 关闭弹窗
            document.querySelector('.modal.show').remove();

        } catch (error) {
            console.error('编辑存储项失败:', error);
            Utils.showNotification(`编辑失败: ${error.message}`, 'error');
        }
    }

    // 初始化界面
    initialize() {
        // 初始化主题
        this.initializeTheme();

        // 显示欢迎消息
        setTimeout(() => {
            Utils.showNotification('欢迎使用AI工作流平台！拖拽节点开始创建工作流。', 'info', 5000);
        }, 1000);
    }

    // 初始化主题
    initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
        }
    }

    // 初始化节点大小设置
    initializeNodeSizeSettings() {
        if (window.appConfig) {
            const config = window.appConfig.getConfig();
            const width = config.nodeDefaultWidth || 180;
            const height = config.nodeDefaultHeight || 80;
            this.applyNodeSizeSettings(width, height);
        }
    }
}

// 创建全局UI管理器实例
window.uiManager = new UIManager();

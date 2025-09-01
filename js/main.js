// 主应用入口
class AIWorkflowApp {
    constructor() {
        this.version = '1.0.0';
        this.initialized = false;
    }

    // 初始化应用
    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            console.log(`🚀 AI工作流平台 v${this.version} 启动中...`);

            // 检查浏览器兼容性
            this.checkBrowserCompatibility();

            // 初始化配置
            await this.initializeConfig();

            // 初始化组件
            this.initializeComponents();

            // 绑定全局事件
            this.bindGlobalEvents();

            // 初始化UI
            window.uiManager.initialize();

            // 加载保存的工作流
            this.autoLoadWorkflow();

            this.initialized = true;

            console.log('✅ AI工作流平台初始化完成');

            // 显示启动消息
            this.showWelcomeMessage();

        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            Utils.showNotification('应用初始化失败: ' + error.message, 'error');
        }
    }

    // 检查浏览器兼容性
    checkBrowserCompatibility() {
        const features = {
            fetch: typeof fetch !== 'undefined',
            localStorage: typeof localStorage !== 'undefined',
            canvas: typeof CanvasRenderingContext2D !== 'undefined',
            svg: typeof SVGElement !== 'undefined',
            dragAndDrop: 'draggable' in document.createElement('div'),
            fileReader: typeof FileReader !== 'undefined'
        };

        const unsupported = Object.entries(features)
            .filter(([, supported]) => !supported)
            .map(([feature]) => feature);

        if (unsupported.length > 0) {
            const message = `您的浏览器不支持以下功能: ${unsupported.join(', ')}。建议使用最新版本的Chrome、Firefox或Edge浏览器。`;
            Utils.showNotification(message, 'warning', 10000);
            console.warn('浏览器兼容性问题:', unsupported);
        }
    }

    // 初始化配置
    async initializeConfig() {
        const config = window.appConfig.getConfig();

        // 如果是首次使用或使用默认API密钥，显示设置向导
        const isDefaultApiKey = config.apiKey === 'sk-qJv60VOOREcVfbwnCvF49vaNgA4cSF91BEu8BESa7DCPptFq';
        const isFirstVisit = !localStorage.getItem('ai-workflow-setup-completed');

        if (isDefaultApiKey && isFirstVisit) {
            setTimeout(() => {
                this.showSetupWizard();
            }, 2000);
        }
    }

    // 初始化组件
    initializeComponents() {
        // 确保所有全局组件都已初始化
        if (!window.appConfig) {
            throw new Error('配置管理器未初始化');
        }

        if (!window.workflowManager) {
            throw new Error('工作流管理器未初始化');
        }

        if (!window.workflowExecutor) {
            throw new Error('工作流执行器未初始化');
        }

        if (!window.uiManager) {
            throw new Error('UI管理器未初始化');
        }

        // 初始化新增组件
        this.initializeNewComponents();

        // 初始化侧边栏功能
        this.initializeSidebars();

        console.log('✅ 所有组件初始化完成');
    }

    // 初始化新增组件
    initializeNewComponents() {
        try {
            // 初始化流处理引擎
            if (typeof StreamEngine !== 'undefined') {
                window.streamEngine = new StreamEngine();
                console.log('✅ 流处理引擎初始化完成');
            }

            // 初始化Agent管理器
            if (typeof AgentManager !== 'undefined') {
                window.agentManager = new AgentManager();
                console.log('✅ Agent管理器初始化完成');
            }

            // 初始化对话窗口管理器
            if (typeof ConversationWindowManager !== 'undefined') {
                window.conversationWindowManager = new ConversationWindowManager();
                console.log('✅ 对话窗口管理器初始化完成');
            }

            // 初始化音频录制管理器
            if (typeof AudioRecorderManager !== 'undefined') {
                window.audioRecorderManager = new AudioRecorderManager();
                console.log('✅ 音频录制管理器初始化完成');
            }

            // 初始化API管理器
            if (typeof APIManager !== 'undefined') {
                window.apiManager = new APIManager();
                console.log('✅ API管理器初始化完成');
            }

            // 初始化简化API客户端
            if (typeof SimpleAPIClient !== 'undefined') {
                window.simpleAPIClient = new SimpleAPIClient();
                console.log('✅ 简化API客户端初始化完成');
            }

        } catch (error) {
            console.error('新增组件初始化失败:', error);
            Utils.showNotification('新增组件初始化失败: ' + error.message, 'warning');
        }
    }

    // 初始化侧边栏功能
    initializeSidebars() {
        // 初始化侧边栏拖拽调整
        this.initSidebarResizing();

        // 初始化节点库折叠
        this.initNodeLibraryCollapse();

        // 初始化变量映射折叠
        this.initVariableMappingCollapse();
    }

    // 初始化侧边栏拖拽调整
    initSidebarResizing() {
        const resizers = document.querySelectorAll('.sidebar-resizer');

        resizers.forEach(resizer => {
            const targetId = resizer.getAttribute('data-target');
            const sidebar = document.getElementById(targetId);

            if (!sidebar) return;

            let isResizing = false;
            let startX = 0;
            let startWidth = 0;

            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                startWidth = parseInt(window.getComputedStyle(sidebar).width, 10);

                document.body.style.userSelect = 'none';
                document.body.style.cursor = 'col-resize';

                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;

                const deltaX = e.clientX - startX;
                let newWidth;

                if (targetId === 'leftSidebar') {
                    newWidth = startWidth + deltaX;
                } else if (targetId === 'rightSidebar') {
                    newWidth = startWidth - deltaX;
                }

                // 限制最小和最大宽度
                newWidth = Math.max(200, Math.min(600, newWidth));

                sidebar.style.width = newWidth + 'px';

                // 通知工作流管理器更新连接线
                if (window.workflowManager) {
                    window.workflowManager.updateConnections();
                }
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.userSelect = '';
                    document.body.style.cursor = '';

                    // 保存侧边栏宽度
                    const width = sidebar.style.width;
                    localStorage.setItem(`ai-workflow-${targetId}-width`, width);
                }
            });
        });

        // 恢复保存的侧边栏宽度
        this.restoreSidebarWidths();
    }

    // 恢复侧边栏宽度
    restoreSidebarWidths() {
        const leftSidebar = document.getElementById('leftSidebar');
        const rightSidebar = document.getElementById('rightSidebar');

        const leftWidth = localStorage.getItem('ai-workflow-leftSidebar-width');
        const rightWidth = localStorage.getItem('ai-workflow-rightSidebar-width');

        if (leftWidth && leftSidebar) {
            leftSidebar.style.width = leftWidth;
        }

        if (rightWidth && rightSidebar) {
            rightSidebar.style.width = rightWidth;
        }
    }

    // 初始化节点库折叠
    initNodeLibraryCollapse() {
        const categoryToggles = document.querySelectorAll('.category-toggle');

        categoryToggles.forEach(toggle => {
            const targetId = toggle.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);

            if (!targetContent) return;

            // 从本地存储恢复折叠状态
            const isCollapsed = localStorage.getItem(`ai-workflow-category-${targetId}`) === 'true';

            if (isCollapsed) {
                targetContent.style.display = 'none';
                toggle.querySelector('i').className = 'fas fa-chevron-right';
            }

            toggle.addEventListener('click', () => {
                const isCurrentlyVisible = targetContent.style.display !== 'none';

                if (isCurrentlyVisible) {
                    targetContent.style.display = 'none';
                    toggle.querySelector('i').className = 'fas fa-chevron-right';
                    localStorage.setItem(`ai-workflow-category-${targetId}`, 'true');
                } else {
                    targetContent.style.display = 'block';
                    toggle.querySelector('i').className = 'fas fa-chevron-down';
                    localStorage.setItem(`ai-workflow-category-${targetId}`, 'false');
                }
            });
        });
    }

    // 初始化变量映射折叠
    initVariableMappingCollapse() {
        // 使用事件委托来处理动态创建的映射区域
        document.addEventListener('click', (e) => {
            // 检查是否点击了section-toggle按钮
            if (e.target.classList.contains('section-toggle') ||
                e.target.closest('.section-toggle')) {

                const toggle = e.target.closest('.section-toggle') || e.target;
                const sectionHeader = toggle.closest('.section-header');
                const mappingSection = sectionHeader.closest('.mapping-section');
                const mappingContent = mappingSection.querySelector('.mapping-content');

                if (!mappingContent) return;

                const isCurrentlyVisible = !mappingContent.classList.contains('collapsed');
                const sectionId = mappingSection.id || mappingSection.className;

                if (isCurrentlyVisible) {
                    mappingContent.classList.add('collapsed');
                    toggle.classList.add('collapsed');
                    localStorage.setItem(`ai-workflow-mapping-${sectionId}`, 'true');
                } else {
                    mappingContent.classList.remove('collapsed');
                    toggle.classList.remove('collapsed');
                    localStorage.setItem(`ai-workflow-mapping-${sectionId}`, 'false');
                }
            }
        });

        // 恢复映射区域折叠状态（在属性面板更新后）
        this.restoreMappingCollapse();
    }

    // 恢复映射区域折叠状态
    restoreMappingCollapse() {
        // 使用MutationObserver来监听属性面板的变化
        const propertyPanel = document.getElementById('propertyPanel');
        if (!propertyPanel) return;

        const observer = new MutationObserver(() => {
            // 恢复所有映射区域的折叠状态
            const mappingSections = propertyPanel.querySelectorAll('.mapping-section');
            mappingSections.forEach(section => {
                const sectionId = section.id;
                const toggle = section.querySelector('.section-toggle');
                const content = section.querySelector('.mapping-content');

                if (!sectionId || !toggle || !content) return;

                const isCollapsed = localStorage.getItem(`ai-workflow-mapping-${sectionId}`) === 'true';

                if (isCollapsed) {
                    content.classList.add('collapsed');
                    toggle.classList.add('collapsed');
                } else {
                    content.classList.remove('collapsed');
                    toggle.classList.remove('collapsed');
                }
            });
        });

        observer.observe(propertyPanel, {
            childList: true,
            subtree: true
        });
    }

    // 绑定全局事件
    bindGlobalEvents() {
        // 页面卸载前保存数据
        window.addEventListener('beforeunload', (e) => {
            this.saveAppState();
        });

        // 错误处理（过滤已知的无害错误）
        window.addEventListener('error', (e) => {
            const ignoredErrors = [
                'Can only have one anonymous define call per script file',
                'Duplicate definition of module',
                'Failed to load resource',
                'X.default.parse is not a function',
                'Loading "stackframe" failed'
            ];

            const errorMessage = e.message || e.error?.message || '';
            const shouldIgnore = ignoredErrors.some(ignored => errorMessage.includes(ignored));

            if (shouldIgnore) {
                console.warn('忽略已知错误:', errorMessage);
                e.preventDefault();
                return false;
            }

            console.error('全局错误:', e.error || e.message);
            if (window.Utils && Utils.showNotification) {
                Utils.showNotification('发生了一个错误，请查看控制台获取详细信息', 'error');
            }
        });

        // 未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (e) => {
            const ignoredReasons = [
                'X.default.parse is not a function',
                'Failed to load resource',
                'pyodide'
            ];

            const reasonStr = String(e.reason);
            const shouldIgnore = ignoredReasons.some(ignored => reasonStr.includes(ignored));

            if (shouldIgnore) {
                console.warn('忽略已知Promise拒绝:', e.reason);
                e.preventDefault();
                return false;
            }

            console.error('未处理的Promise拒绝:', e.reason);
            if (window.Utils && Utils.showNotification) {
                Utils.showNotification('异步操作失败，请查看控制台获取详细信息', 'error');
            }
        });

        // 网络状态变化
        window.addEventListener('online', () => {
            Utils.showNotification('网络连接已恢复', 'success');
        });

        window.addEventListener('offline', () => {
            Utils.showNotification('网络连接已断开，部分功能可能无法使用', 'warning');
        });

        // 可见性变化（页面切换）
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // 页面重新可见时更新连接线
                window.workflowManager.updateConnections();
            }
        });
    }

    // 自动加载工作流
    autoLoadWorkflow() {
        try {
            const autoSave = localStorage.getItem('ai-workflow-autosave');
            const lastSaved = localStorage.getItem('ai-workflow-last-saved');

            if (autoSave && lastSaved) {
                const timeDiff = Date.now() - parseInt(lastSaved);
                const hoursDiff = timeDiff / (1000 * 60 * 60);

                // 如果在24小时内有自动保存，提示用户是否恢复
                if (hoursDiff < 24) {
                    setTimeout(async () => {
                        const restore = await Utils.confirm(
                            `检测到 ${Math.round(hoursDiff)} 小时前的自动保存，是否要恢复？`,
                            '恢复工作流'
                        );

                        if (restore) {
                            window.workflowManager.load();
                        }
                    }, 3000);
                }
            }
        } catch (error) {
            console.warn('自动加载工作流失败:', error);
        }
    }

    // 保存应用状态
    saveAppState() {
        try {
            // 自动保存当前工作流
            if (window.workflowManager.nodes.size > 0) {
                const data = {
                    nodes: Array.from(window.workflowManager.nodes.values()).map(node => node.toJSON()),
                    connections: Array.from(window.workflowManager.connections.values()),
                    metadata: {
                        autoSaved: new Date().toISOString(),
                        version: this.version
                    }
                };

                localStorage.setItem('ai-workflow-autosave', JSON.stringify(data));
                localStorage.setItem('ai-workflow-last-saved', Date.now().toString());
            }
        } catch (error) {
            console.warn('保存应用状态失败:', error);
        }
    }

    // 显示设置向导
    showSetupWizard() {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-magic"></i> 欢迎使用AI工作流平台</h2>
                </div>
                <div class="modal-body">
                    <p>欢迎使用AI工作流平台！为了开始使用，请先配置您的API设置。</p>
                    <p>系统已为您预配置了默认API，您也可以使用自己的OpenAI兼容API。</p>
                    <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
                        <strong>默认配置：</strong><br>
                        <small>
                            URL: https://api.chatanywhere.tech/v1/chat/completions<br>
                            Model: gpt-5-mini
                        </small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="skipSetup">跳过设置</button>
                    <button class="btn btn-primary" id="openSettings">配置API</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const cleanup = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        };

        modal.querySelector('#skipSetup').onclick = () => {
            localStorage.setItem('ai-workflow-setup-completed', 'true');
            cleanup();
            Utils.showNotification('您可以随时通过设置按钮配置API', 'info');
        };

        modal.querySelector('#openSettings').onclick = () => {
            localStorage.setItem('ai-workflow-setup-completed', 'true');
            cleanup();
            window.uiManager.showSettingsModal();
        };
    }

    // 显示欢迎消息
    showWelcomeMessage() {
        // 检查是否是首次访问
        const isFirstVisit = !localStorage.getItem('ai-workflow-visited');

        if (isFirstVisit) {
            localStorage.setItem('ai-workflow-visited', 'true');

            setTimeout(() => {
                Utils.showNotification('🎉 欢迎使用AI工作流平台！您可以从左侧拖拽节点开始创建工作流。', 'info', 8000);
            }, 1500);

            // 显示快速指南
            setTimeout(() => {
                this.showQuickGuide();
            }, 10000);
        }
    }

    // 显示快速指南
    showQuickGuide() {
        const guide = document.createElement('div');
        guide.className = 'quick-guide';
        guide.innerHTML = `
            <div class="guide-content">
                <div class="guide-header">
                    <h3><i class="fas fa-lightbulb"></i> 快速指南</h3>
                    <button class="btn-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="guide-body">
                    <ol>
                        <li>从左侧节点库拖拽节点到工作区</li>
                        <li>点击节点配置属性</li>
                        <li>拖拽连接点创建连接</li>
                        <li>点击执行按钮运行工作流</li>
                    </ol>
                    <p><strong>快捷键：</strong></p>
                    <ul>
                        <li>F5 - 执行工作流</li>
                        <li>Ctrl+S - 保存</li>
                        <li>Ctrl+O - 加载</li>
                        <li>Delete - 删除选中节点</li>
                    </ul>
                </div>
            </div>
        `;

        // 样式
        Object.assign(guide.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: '4000',
            maxWidth: '400px',
            animation: 'slideInDown 0.3s ease'
        });

        guide.querySelector('.guide-content').style.padding = '0';
        guide.querySelector('.guide-header').style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid #e0e0e0;
            background: #f8f9fa;
            border-radius: 8px 8px 0 0;
        `;
        guide.querySelector('.guide-body').style.padding = '20px';

        document.body.appendChild(guide);

        // 自动关闭
        setTimeout(() => {
            if (guide.parentNode) {
                guide.style.animation = 'slideOutUp 0.3s ease';
                setTimeout(() => {
                    if (guide.parentNode) {
                        guide.parentNode.removeChild(guide);
                    }
                }, 300);
            }
        }, 15000);
    }

    // 获取应用信息
    getAppInfo() {
        return {
            version: this.version,
            initialized: this.initialized,
            nodeCount: window.workflowManager.nodes.size,
            connectionCount: window.workflowManager.connections.size,
            executionHistory: window.workflowExecutor.executionHistory.length,
            config: window.appConfig.getConfig()
        };
    }

    // 重置应用
    async reset() {
        const confirm = await Utils.confirm(
            '这将清空所有工作流、配置和历史记录。确定要重置吗？',
            '重置应用'
        );

        if (confirm) {
            // 清空工作流
            window.workflowManager.clear();

            // 重置配置
            window.appConfig.reset();

            // 清空执行历史
            window.workflowExecutor.clearExecutionHistory();

            // 清空本地存储
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('ai-workflow-')) {
                    localStorage.removeItem(key);
                }
            });

            Utils.showNotification('应用已重置', 'success');

            // 重新加载页面
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
    }

    // 导出应用数据
    exportAppData() {
        const data = {
            version: this.version,
            exportTime: new Date().toISOString(),
            workflow: {
                nodes: Array.from(window.workflowManager.nodes.values()).map(node => node.toJSON()),
                connections: Array.from(window.workflowManager.connections.values())
            },
            config: window.appConfig.getConfig(),
            executionHistory: window.workflowExecutor.executionHistory.slice(0, 10) // 只导出最近10次
        };

        const filename = `ai-workflow-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        Utils.downloadFile(JSON.stringify(data, null, 2), filename);

        Utils.showNotification('应用数据已导出', 'success');
    }

    // 导入应用数据
    async importAppData(file) {
        try {
            const content = await Utils.readFile(file);
            const data = JSON.parse(content);

            if (data.version && data.workflow) {
                // 确认导入
                const confirm = await Utils.confirm(
                    '导入数据将覆盖当前的工作流和配置。确定要继续吗？',
                    '导入应用数据'
                );

                if (!confirm) return;

                // 导入工作流
                if (data.workflow) {
                    window.workflowManager.clear();

                    if (data.workflow.nodes) {
                        data.workflow.nodes.forEach(nodeData => {
                            const node = WorkflowNode.fromJSON(nodeData);
                            window.workflowManager.nodes.set(node.id, node);
                            window.workflowManager.nodeContainer.appendChild(node.element);
                        });
                    }

                    if (data.workflow.connections) {
                        data.workflow.connections.forEach(connection => {
                            window.workflowManager.connections.set(connection.id, connection);

                            const fromNode = window.workflowManager.nodes.get(connection.from.nodeId);
                            const toNode = window.workflowManager.nodes.get(connection.to.nodeId);

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

                                window.workflowManager.drawConnection(connection);
                            }
                        });
                    }
                }

                // 导入配置（排除敏感信息）
                if (data.config) {
                    const configToImport = { ...data.config };
                    delete configToImport.apiKey; // 不导入API密钥
                    window.appConfig.saveConfig(configToImport);
                }

                Utils.showNotification('应用数据导入成功', 'success');

            } else {
                throw new Error('无效的应用数据格式');
            }

        } catch (error) {
            console.error('导入应用数据失败:', error);
            Utils.showNotification('导入应用数据失败: ' + error.message, 'error');
        }
    }

    // 调试模式
    enableDebugMode() {
        window.DEBUG_MODE = true;

        // 添加调试信息到控制台
        console.log('🐛 调试模式已启用');
        console.log('应用信息:', this.getAppInfo());

        // 添加调试面板
        this.createDebugPanel();

        Utils.showNotification('调试模式已启用，查看控制台获取详细信息', 'info');
    }

    // 创建调试面板
    createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = 'debugPanel';
        panel.innerHTML = `
            <div style="position: fixed; top: 10px; right: 10px; background: #000; color: #0f0; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; z-index: 9999; max-width: 300px;">
                <div style="margin-bottom: 5px; font-weight: bold;">🐛 DEBUG MODE</div>
                <div id="debugContent"></div>
                <button onclick="this.parentElement.parentElement.remove()" style="background: #f00; color: #fff; border: none; padding: 2px 6px; border-radius: 2px; margin-top: 5px;">关闭</button>
            </div>
        `;

        document.body.appendChild(panel);

        // 更新调试信息
        const updateDebugInfo = () => {
            const content = document.getElementById('debugContent');
            if (content) {
                const info = this.getAppInfo();
                content.innerHTML = `
                    节点: ${info.nodeCount}<br>
                    连接: ${info.connectionCount}<br>
                    执行历史: ${info.executionHistory}<br>
                    内存使用: ${(performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : 0).toFixed(1)}MB
                `;
            }
        };

        updateDebugInfo();
        setInterval(updateDebugInfo, 1000);
    }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 创建全局应用实例
    window.aiWorkflowApp = new AIWorkflowApp();

    // 初始化应用
    await window.aiWorkflowApp.initialize();

    // 调试：检查关键类是否加载
    console.log('=== 类加载状态检查 ===');
    console.log('CodeEditorWindow:', typeof window.CodeEditorWindow);
    console.log('ConversationWindow:', typeof window.ConversationWindow);
    console.log('JavaScriptCode:', typeof window.JavaScriptCode);
    console.log('PythonCode:', typeof window.PythonCode);
    console.log('WorkflowNode:', typeof window.WorkflowNode);
    console.log('BrowserWindow:', typeof window.BrowserWindow);
    console.log('BrowserNode:', typeof window.BrowserNode);
    console.log('========================');

    // 开发模式快捷键
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            window.aiWorkflowApp.enableDebugMode();
        }
    });
});



// 导出到全局作用域以便调试
if (typeof window !== 'undefined') {
    window.AI_WORKFLOW = {
        version: '1.0.0',
        app: () => window.aiWorkflowApp,
        config: () => window.appConfig,
        workflow: () => window.workflowManager,
        executor: () => window.workflowExecutor,
        ui: () => window.uiManager,
        utils: Utils
    };
}
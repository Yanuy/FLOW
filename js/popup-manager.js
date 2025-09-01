// 弹窗管理器
class PopupManager {
    constructor() {
        this.activePopups = new Map(); // 存储当前活跃的弹窗
        this.popupContainer = null;
        this.init();
    }
    
    // 初始化弹窗管理器
    init() {
        // 创建弹窗容器
        this.createPopupContainer();
        
        // 绑定全局事件
        this.bindGlobalEvents();
    }
    
    // 创建弹窗容器
    createPopupContainer() {
        this.popupContainer = document.createElement('div');
        this.popupContainer.id = 'popup-container';
        this.popupContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1500;
        `;
        document.body.appendChild(this.popupContainer);
    }
    
    // 绑定全局事件
    bindGlobalEvents() {
        // ESC键关闭所有弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllPopups();
            }
        });
    }
    
    // 显示变量输入弹窗
    async showVariableInputPopup(nodeId, variableName, currentValue, timeout = 30000) {
        const popupId = `input-${nodeId}-${variableName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`[弹窗管理] 创建输入弹窗: ${popupId} 用于节点 ${nodeId} 变量 ${variableName}`);
        
        // 检查是否已有相同节点的相同变量的弹窗
        const existingPopup = Array.from(this.activePopups.entries())
            .find(([id, data]) => 
                data.nodeId === nodeId && 
                data.variableName === variableName && 
                data.type === 'input'
            );
        
        if (existingPopup) {
            console.log(`[弹窗管理] 发现重复弹窗，关闭旧的: ${existingPopup[0]}`);
            this.forceClosePopup(existingPopup[0]);
        }
        
        // 创建弹窗
        const popup = this.createPopup(popupId, {
            type: 'input',
            title: `编辑输入: ${variableName}`,
            nodeId: nodeId
        });
        
        const content = `
            <div class="popup-form">
                <div class="form-group">
                    <label>变量名称:</label>
                    <input type="text" value="${variableName}" readonly class="readonly-input">
                </div>
                <div class="form-group">
                    <label>当前值:</label>
                    <textarea id="popup-input-${popupId}" rows="4" placeholder="请输入内容...">${currentValue || ''}</textarea>
                </div>
                <div class="popup-actions">
                    <button type="button" class="btn btn-primary" onclick="window.popupManager.confirmInputValue('${popupId}')">
                        <i class="fas fa-check"></i> 确认
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="window.popupManager.skipInputChange('${popupId}')">
                        <i class="fas fa-forward"></i> 跳过
                    </button>
                    <button type="button" class="btn btn-danger" onclick="window.popupManager.clearInputValue('${popupId}')">
                        <i class="fas fa-trash"></i> 清空
                    </button>
                </div>
            </div>
        `;
        
        popup.querySelector('.popup-body').innerHTML = content;
        
        // 位置定位到节点下方
        this.positionPopupNearNode(popup, nodeId);
        
        // 添加到容器
        this.popupContainer.appendChild(popup);
        
        // 启动倒计时
        this.startCountdown(popupId, timeout);
        
        // 聚焦到输入框
        setTimeout(() => {
            const input = popup.querySelector(`#popup-input-${popupId}`);
            if (input) {
                input.focus();
            }
        }, 100);
        
        return new Promise((resolve, reject) => {
            this.activePopups.set(popupId, {
                popup,
                resolve,
                reject,
                type: 'input',
                nodeId: nodeId,
                variableName,
                originalValue: currentValue,
                isProcessing: false
            });
        });
    }
    
    // 显示变量输出弹窗
    async showVariableOutputPopup(nodeId, variableName, currentValue, timeout = 30000) {
        const popupId = `output-${nodeId}-${variableName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`[弹窗管理] 创建输出弹窗: ${popupId} 用于节点 ${nodeId} 变量 ${variableName}`);
        
        // 检查是否已有相同节点的相同变量的弹窗
        const existingPopup = Array.from(this.activePopups.entries())
            .find(([id, data]) => 
                data.nodeId === nodeId && 
                data.variableName === variableName && 
                data.type === 'output'
            );
        
        if (existingPopup) {
            console.log(`[弹窗管理] 发现重复弹窗，关闭旧的: ${existingPopup[0]}`);
            this.forceClosePopup(existingPopup[0]);
        }
        
        // 创建弹窗
        const popup = this.createPopup(popupId, {
            type: 'output',
            title: `审核输出: ${variableName}`,
            nodeId: nodeId
        });
        
        const content = `
            <div class="popup-form">
                <div class="form-group">
                    <label>变量名称:</label>
                    <input type="text" value="${variableName}" readonly class="readonly-input">
                </div>
                <div class="form-group">
                    <label>输出值:</label>
                    <textarea id="popup-output-${popupId}" rows="4" placeholder="输出内容...">${currentValue || ''}</textarea>
                </div>
                <div class="popup-actions">
                    <button type="button" class="btn btn-primary" onclick="window.popupManager.confirmOutputValue('${popupId}')">
                        <i class="fas fa-check"></i> 确认
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="window.popupManager.skipOutputChange('${popupId}')">
                        <i class="fas fa-forward"></i> 跳过
                    </button>
                    <button type="button" class="btn btn-danger" onclick="window.popupManager.clearOutputValue('${popupId}')">
                        <i class="fas fa-trash"></i> 清空
                    </button>
                </div>
            </div>
        `;
        
        popup.querySelector('.popup-body').innerHTML = content;
        
        // 位置定位到节点下方
        this.positionPopupNearNode(popup, nodeId);
        
        // 添加到容器
        this.popupContainer.appendChild(popup);
        
        // 启动倒计时
        this.startCountdown(popupId, timeout);
        
        // 聚焦到输出框
        setTimeout(() => {
            const output = popup.querySelector(`#popup-output-${popupId}`);
            if (output) {
                output.focus();
            }
        }, 100);
        
        return new Promise((resolve, reject) => {
            this.activePopups.set(popupId, {
                popup,
                resolve,
                reject,
                type: 'output',
                nodeId: nodeId,
                variableName,
                originalValue: currentValue
            });
        });
    }
    
    // 创建即时输入弹窗
    async showImmediateInputPopup(nodeId, inputName, defaultValue = '', isOptional = false, timeout = 20000) {
        const popupId = `immediate-${nodeId}-${inputName}-${Date.now()}`;
        
        const popup = this.createPopup(popupId, {
            type: 'immediate',
            title: `${isOptional ? '可选' : '即时'}输入: ${inputName}`,
            nodeId,
            inputName,
            timeout,
            isOptional
        });
        
        const content = `
            <div class="popup-form">
                <div class="form-group">
                    <label>输入名称:</label>
                    <input type="text" value="${inputName}" readonly class="readonly-input">
                </div>
                <div class="form-group">
                    <label>输入值:</label>
                    <textarea id="popup-immediate-${popupId}" rows="4" placeholder="请输入内容...">${defaultValue}</textarea>
                </div>
                ${isOptional ? '<div class="optional-note"><i class="fas fa-info-circle"></i> 这是可选输入，可以留空或等待超时</div>' : ''}
                <div class="popup-actions">
                    <button type="button" class="btn btn-primary" onclick="window.popupManager.confirmImmediateInput('${popupId}')">
                        <i class="fas fa-check"></i> 确认
                    </button>
                    ${isOptional ? 
                        `<button type="button" class="btn btn-secondary" onclick="window.popupManager.skipImmediateInput('${popupId}')">
                            <i class="fas fa-forward"></i> 跳过
                        </button>` : 
                        `<button type="button" class="btn btn-secondary" onclick="window.popupManager.cancelPopup('${popupId}')">
                            <i class="fas fa-times"></i> 取消
                        </button>`
                    }
                </div>
            </div>
        `;
        
        popup.querySelector('.popup-body').innerHTML = content;
        
        // 位置定位到节点下方
        this.positionPopupNearNode(popup, nodeId);
        
        // 添加到容器
        this.popupContainer.appendChild(popup);
        
        // 启动倒计时
        this.startCountdown(popupId, timeout);
        
        // 聚焦到输入框
        setTimeout(() => {
            const input = popup.querySelector(`#popup-immediate-${popupId}`);
            if (input) {
                input.focus();
            }
        }, 100);
        
        return new Promise((resolve, reject) => {
            this.activePopups.set(popupId, {
                popup,
                resolve,
                reject,
                type: 'immediate',
                nodeId,
                inputName,
                defaultValue,
                isOptional
            });
        });
    }
    
    // 创建基础弹窗结构
    createPopup(popupId, options) {
        const popup = document.createElement('div');
        popup.className = 'node-popup';
        popup.id = popupId;
        popup.setAttribute('data-node-id', options.nodeId);
        
        popup.innerHTML = `
            <div class="popup-header">
                <div class="popup-title">
                    <i class="fas ${this.getPopupIcon(options.type)}"></i>
                    ${options.title}
                </div>
                <div class="popup-controls">
                    <div class="popup-countdown" id="countdown-${popupId}"></div>
                    <button type="button" class="popup-toggle" onclick="window.popupManager.togglePopup('${popupId}')">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                    <button type="button" class="popup-close" onclick="window.popupManager.closePopup('${popupId}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="popup-body">
                <!-- 内容将在外部填充 -->
            </div>
        `;
        
        return popup;
    }
    
    // 获取弹窗图标
    getPopupIcon(type) {
        const icons = {
            input: 'fa-edit',
            output: 'fa-check-circle',
            immediate: 'fa-keyboard',
            file: 'fa-file'
        };
        return icons[type] || 'fa-window-maximize';
    }
    
    // 将弹窗定位到节点附近
    positionPopupNearNode(popup, nodeId) {
        const node = window.workflowManager?.getNode(nodeId);
        if (!node || !node.element) {
            // 如果找不到节点，居中显示
            popup.style.cssText += `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: auto;
            `;
            return;
        }
        
        const nodeRect = node.element.getBoundingClientRect();
        const workspace = document.querySelector('.workspace');
        
        if (!workspace) {
            // 如果找不到工作区，居中显示
            popup.style.cssText += `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: auto;
            `;
            return;
        }
        
        const workspaceRect = workspace.getBoundingClientRect();
        
        // 计算相对于工作区的位置
        const relativeX = nodeRect.left - workspaceRect.left;
        const relativeY = nodeRect.bottom - workspaceRect.top + 10; // 节点下方10px
        
        popup.style.cssText += `
            position: absolute;
            left: ${relativeX}px;
            top: ${relativeY}px;
            pointer-events: auto;
            max-width: 350px;
            min-width: 300px;
        `;
    }
    
    // 启动倒计时
    startCountdown(popupId, timeout) {
        const countdownElement = document.getElementById(`countdown-${popupId}`);
        if (!countdownElement) return;
        
        let remaining = Math.ceil(timeout / 1000);
        
        const updateCountdown = () => {
            if (remaining <= 0) {
                this.timeoutPopup(popupId);
                return;
            }
            
            countdownElement.textContent = `${remaining}s`;
            remaining--;
        };
        
        // 立即显示初始倒计时
        updateCountdown();
        const intervalId = setInterval(updateCountdown, 1000);
        
        // 存储定时器ID以便清理
        const popupData = this.activePopups.get(popupId);
        if (popupData) {
            popupData.intervalId = intervalId;
        }
    }
    
    // 处理弹窗超时
    timeoutPopup(popupId) {
        const popupData = this.activePopups.get(popupId);
        if (!popupData) return;
        
        console.log(`[弹窗管理] 弹窗 ${popupId} 超时`);
        
        try {
            // 根据弹窗类型处理超时
            switch (popupData.type) {
                            case 'input':
                // 输入弹窗超时，跳过变更（不变动全局变量）
                console.log(`[弹窗管理] 输入弹窗超时 - 变量 ${popupData.variableName} 保持原值`);
                popupData.resolve({ action: 'timeout', value: popupData.originalValue });
                break;
                    
                case 'output':
                    // 输出弹窗超时，跳过变更（不变动全局变量）
                    console.log(`[弹窗管理] 输出弹窗超时 - 变量 ${popupData.variableName} 保持原值`);
                    popupData.resolve({ action: 'timeout', value: popupData.originalValue });
                    break;
                    
                case 'immediate':
                    // 即时输入弹窗超时
                    if (popupData.isOptional) {
                        // 可选输入超时，返回默认值
                        popupData.resolve({ action: 'timeout', value: popupData.defaultValue });
                    } else {
                        // 必填输入超时，返回当前值
                        const immediateElement = popupData.popup.querySelector(`#popup-immediate-${popupId}`);
                        const immediateValue = immediateElement ? immediateElement.value : popupData.defaultValue;
                        popupData.resolve({ action: 'timeout', value: immediateValue });
                    }
                    break;
            }
        } catch (error) {
            console.warn(`[弹窗管理] 处理超时时出错:`, error);
        } finally {
            // 确保弹窗被关闭
            this.forceClosePopup(popupId);
        }
    }
    
    // 确认输入值（将当前框内容存储到全局变量）
    confirmInputValue(popupId) {
        const popupData = this.activePopups.get(popupId);
        if (!popupData) {
            console.error(`[弹窗管理] confirmInputValue: 找不到弹窗数据 ${popupId}`);
            // 即使没有数据，也要尝试强制关闭弹窗
            this.forceClosePopup(popupId);
            return;
        }
        
        const inputElement = popupData.popup.querySelector(`#popup-input-${popupId}`);
        const value = inputElement ? inputElement.value : '';
        
        console.log(`[弹窗管理] 确认输入值: ${popupData.variableName} = "${value}"`);
        
        // 存储到全局变量
        try {
            if (!window.variableManager) {
                throw new Error('variableManager未初始化');
            }
            
            // 检查变量是否存在
            const existingVar = window.variableManager.getGlobalVariable(popupData.variableName);
            if (!existingVar) {
                throw new Error(`变量 ${popupData.variableName} 不存在`);
            }
            
            // 更新变量（标记为来自弹窗）
            window.variableManager.updateGlobalVariable(popupData.variableName, value, false, '', true);
            console.log(`[弹窗管理] ✅ 成功更新变量 ${popupData.variableName} = "${value}" (来自弹窗)`);
            
            // 验证更新结果
            const updatedVar = window.variableManager.getGlobalVariable(popupData.variableName);
            console.log(`[弹窗管理] 验证更新结果: ${popupData.variableName} = "${updatedVar.value}"`);
            
        } catch (error) {
            console.error(`[弹窗管理] ❌ 更新变量失败:`, error);
            console.error(`[弹窗管理] 变量名: ${popupData.variableName}, 值: "${value}"`);
        }
        
        popupData.resolve({ action: 'confirm', value });
        this.forceClosePopup(popupId);
    }
    
    // 跳过输入更改（不变动全局变量，原样传输）
    skipInputChange(popupId) {
        const popupData = this.activePopups.get(popupId);
        if (!popupData) return;
        
        console.log(`[弹窗管理] 跳过输入 - 变量 ${popupData.variableName} 保持原值`);
        
        popupData.resolve({ action: 'skip', value: popupData.originalValue });
        this.forceClosePopup(popupId);
    }
    
    // 清空输入值（将空值存储到全局变量）
    clearInputValue(popupId) {
        const popupData = this.activePopups.get(popupId);
        if (!popupData) {
            console.error(`[弹窗管理] clearInputValue: 找不到弹窗数据 ${popupId}`);
            // 即使没有数据，也要尝试强制关闭弹窗
            this.forceClosePopup(popupId);
            return;
        }
        
        console.log(`[弹窗管理] 清空输入值: ${popupData.variableName}`);
        
        // 存储空值到全局变量
        try {
            if (!window.variableManager) {
                throw new Error('variableManager未初始化');
            }
            
            // 检查变量是否存在
            const existingVar = window.variableManager.getGlobalVariable(popupData.variableName);
            if (!existingVar) {
                throw new Error(`变量 ${popupData.variableName} 不存在`);
            }
            
            // 清空变量（标记为来自弹窗）
            window.variableManager.updateGlobalVariable(popupData.variableName, '', false, '', true);
            console.log(`[弹窗管理] ✅ 成功清空变量 ${popupData.variableName} (来自弹窗)`);
            
            // 验证更新结果
            const updatedVar = window.variableManager.getGlobalVariable(popupData.variableName);
            console.log(`[弹窗管理] 验证清空结果: ${popupData.variableName} = "${updatedVar.value}"`);
            
        } catch (error) {
            console.error(`[弹窗管理] ❌ 清空变量失败:`, error);
            console.error(`[弹窗管理] 变量名: ${popupData.variableName}`);
        }
        
        popupData.resolve({ action: 'clear', value: '' });
        this.forceClosePopup(popupId);
    }
    
    // 确认输出值（将当前框内容存储到全局变量）
    confirmOutputValue(popupId) {
        const popupData = this.activePopups.get(popupId);
        if (!popupData) {
            console.error(`[弹窗管理] confirmOutputValue: 找不到弹窗数据 ${popupId}`);
            return;
        }
        
        const outputElement = popupData.popup.querySelector(`#popup-output-${popupId}`);
        const value = outputElement ? outputElement.value : '';
        
        console.log(`[弹窗管理] 确认输出值: ${popupData.variableName} = "${value}"`);
        
        // 存储到全局变量
        try {
            if (!window.variableManager) {
                throw new Error('variableManager未初始化');
            }
            
            // 检查变量是否存在
            const existingVar = window.variableManager.getGlobalVariable(popupData.variableName);
            if (!existingVar) {
                throw new Error(`变量 ${popupData.variableName} 不存在`);
            }
            
            // 更新变量（标记为来自弹窗）
            window.variableManager.updateGlobalVariable(popupData.variableName, value, false, '', true);
            console.log(`[弹窗管理] ✅ 成功更新变量 ${popupData.variableName} = "${value}" (来自弹窗)`);
            
            // 验证更新结果
            const updatedVar = window.variableManager.getGlobalVariable(popupData.variableName);
            console.log(`[弹窗管理] 验证更新结果: ${popupData.variableName} = "${updatedVar.value}"`);
            
        } catch (error) {
            console.error(`[弹窗管理] ❌ 更新变量失败:`, error);
            console.error(`[弹窗管理] 变量名: ${popupData.variableName}, 值: "${value}"`);
        }
        
        popupData.resolve({ action: 'confirm', value });
        this.forceClosePopup(popupId);
    }
    
    // 跳过输出更改（不变动全局变量，原样传输）
    skipOutputChange(popupId) {
        const popupData = this.activePopups.get(popupId);
        if (!popupData) return;
        
        console.log(`[弹窗管理] 跳过输出 - 变量 ${popupData.variableName} 保持原值`);
        
        popupData.resolve({ action: 'skip', value: popupData.originalValue });
        this.forceClosePopup(popupId);
    }
    
    // 清空输出值（将空值存储到全局变量）
    clearOutputValue(popupId) {
        const popupData = this.activePopups.get(popupId);
        if (!popupData) return;
        
        // 存储空值到全局变量
        try {
            window.variableManager.updateGlobalVariable(popupData.variableName, '', false, '', true);
            console.log(`[弹窗管理] 清空输出 - 已清空变量 ${popupData.variableName} (来自弹窗)`);
        } catch (error) {
            console.error(`[弹窗管理] 清空变量失败:`, error);
        }
        
        popupData.resolve({ action: 'clear', value: '' });
        this.forceClosePopup(popupId);
    }
    
    // 确认即时输入
    confirmImmediateInput(popupId) {
        const popupData = this.activePopups.get(popupId);
        if (!popupData) return;
        
        const immediateElement = popupData.popup.querySelector(`#popup-immediate-${popupId}`);
        const value = immediateElement ? immediateElement.value : popupData.defaultValue;
        
        popupData.resolve({ action: 'confirm', value });
        this.forceClosePopup(popupId);
    }
    
    // 跳过即时输入（仅限可选输入）
    skipImmediateInput(popupId) {
        const popupData = this.activePopups.get(popupId);
        if (!popupData || !popupData.isOptional) return;
        
        popupData.resolve({ action: 'skip', value: popupData.defaultValue });
        this.forceClosePopup(popupId);
    }
    
    // 取消弹窗
    cancelPopup(popupId) {
        const popupData = this.activePopups.get(popupId);
        if (!popupData) return;
        
        popupData.reject(new Error('用户取消'));
        this.forceClosePopup(popupId);
    }
    
    // 折叠/展开弹窗
    togglePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        const body = popup.querySelector('.popup-body');
        const toggleIcon = popup.querySelector('.popup-toggle i');
        
        if (body.style.display === 'none') {
            body.style.display = 'block';
            toggleIcon.className = 'fas fa-chevron-up';
        } else {
            body.style.display = 'none';
            toggleIcon.className = 'fas fa-chevron-down';
        }
    }
    
    // 关闭单个弹窗（增强版，带容错机制）
    closePopup(popupId) {
        const popupData = this.activePopups.get(popupId);
        
        try {
            // 即使没有弹窗数据，也要尝试清理DOM
            let popupElement = null;
            
            if (popupData) {
                // 清理定时器
                if (popupData.intervalId) {
                    clearInterval(popupData.intervalId);
                    popupData.intervalId = null;
                }
                popupElement = popupData.popup;
                
                // 从活跃弹窗中移除
                this.activePopups.delete(popupId);
            }
            
            // 尝试通过ID直接查找弹窗元素
            if (!popupElement) {
                popupElement = document.getElementById(popupId);
            }
            
            // 移除DOM元素
            if (popupElement && popupElement.parentNode) {
                popupElement.parentNode.removeChild(popupElement);
                console.log(`[弹窗管理] 成功移除DOM元素: ${popupId}`);
            } else if (popupElement) {
                // 如果parentNode不存在，尝试其他方式
                popupElement.remove();
                console.log(`[弹窗管理] 使用remove()方法移除元素: ${popupId}`);
            }
            
            console.log(`[弹窗管理] 关闭弹窗: ${popupId}`);
            
        } catch (error) {
            console.error(`[弹窗管理] 关闭弹窗时出错:`, error);
            
            // 强制清理：移除所有相关元素
            try {
                const allPopups = document.querySelectorAll(`[id*="${popupId.split('-')[0]}"]`);
                allPopups.forEach(p => {
                    if (p.id.includes(popupId.split('-')[1]) && p.id.includes(popupId.split('-')[2])) {
                        p.remove();
                        console.log(`[弹窗管理] 强制移除相关元素: ${p.id}`);
                    }
                });
            } catch (forceError) {
                console.error(`[弹窗管理] 强制清理失败:`, forceError);
            }
            
            // 强制从活跃弹窗中移除
            this.activePopups.delete(popupId);
        }
    }
    
    // 关闭所有弹窗
    closeAllPopups() {
        const popupIds = Array.from(this.activePopups.keys());
        popupIds.forEach(popupId => {
            this.closePopup(popupId);
        });
        
        console.log(`[弹窗管理] 关闭所有弹窗 (${popupIds.length} 个)`);
    }
    
    // 强制关闭弹窗（容错机制）
    forceClosePopup(popupId) {
        console.log(`[弹窗管理] 强制关闭弹窗: ${popupId}`);
        
        // 1. 尝试正常关闭
        this.closePopup(popupId);
        
        // 2. 检查是否还有残留的弹窗元素
        setTimeout(() => {
            const remainingElement = document.getElementById(popupId);
            if (remainingElement) {
                console.log(`[弹窗管理] 检测到残留元素，强制移除: ${popupId}`);
                try {
                    remainingElement.remove();
                } catch (error) {
                    console.error(`[弹窗管理] 强制移除失败:`, error);
                    // 最后手段：隐藏元素
                    remainingElement.style.display = 'none';
                    remainingElement.style.visibility = 'hidden';
                }
            }
        }, 100);
    }
    
    // 清理所有弹窗（包括残留的）
    cleanupAllPopups() {
        console.log(`[弹窗管理] 开始清理所有弹窗`);
        
        // 1. 关闭所有活跃弹窗
        this.closeAllPopups();
        
        // 2. 清理可能残留的弹窗元素
        setTimeout(() => {
            const allPopups = document.querySelectorAll('.node-popup');
            allPopups.forEach(popup => {
                if (popup.id && popup.id.includes('-')) {
                    console.log(`[弹窗管理] 清理残留弹窗: ${popup.id}`);
                    try {
                        popup.remove();
                    } catch (error) {
                        console.error(`[弹窗管理] 清理残留弹窗失败:`, error);
                        popup.style.display = 'none';
                    }
                }
            });
            
            // 3. 重置活跃弹窗集合
            this.activePopups.clear();
            console.log(`[弹窗管理] 弹窗清理完成`);
        }, 200);
    }
    
    // 获取活跃弹窗数量
    getActivePopupCount() {
        return this.activePopups.size;
    }
    
    // 获取指定节点的弹窗数量
    getNodePopupCount(nodeId) {
        let count = 0;
        this.activePopups.forEach(popupData => {
            if (popupData.nodeId === nodeId) {
                count++;
            }
        });
        return count;
    }
}

// 创建全局弹窗管理器实例
window.popupManager = new PopupManager();

// 全局测试函数
window.testConfigSave = function() {
    console.log('=== 弹窗配置测试 ===');
    console.log('弹窗管理器状态:', window.popupManager);
    console.log('活跃弹窗数量:', window.popupManager.getActivePopupCount());
    console.log('变量管理器状态:', window.variableManager);
    
    // 测试弹窗清理
    console.log('开始清理所有弹窗...');
    window.popupManager.cleanupAllPopups();
    
    // 延迟检查结果
    setTimeout(() => {
        console.log('清理后活跃弹窗数量:', window.popupManager.getActivePopupCount());
        console.log('DOM中弹窗元素数量:', document.querySelectorAll('.node-popup').length);
    }, 300);
};
